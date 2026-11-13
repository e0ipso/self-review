import {
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  useLayoutEffect,
  useCallback,
} from 'react';
import type { SetStateAction } from 'react';
import { SessionStoreContext } from '../context/review-context';
import {
  createReviewDraftStore,
  draftKey,
  emptyDraftContent,
  type DraftContent,
  type DraftLocation,
} from '../context/review-drafts';
import { collectVisibleRangeLines } from '../utils/comment-anchors';

/** Synchronous close-event check, including edits queued before React commits. */
export function useReviewDraftGuard() {
  const session = useContext(SessionStoreContext);
  return useCallback(() => session?.drafts.hasWork() ?? false, [session]);
}

/** Narrow host dirty projection. The synchronous save boundary checks the same owner. */
export function useReviewDraftWork() {
  const session = useContext(SessionStoreContext);
  const hasWork = useReviewDraftGuard();
  return useSyncExternalStore(session?.drafts.subscribe ?? emptySubscribe, hasWork, () => false);
}
const emptySubscribe = () => () => {};

export function useReviewDraft(location: DraftLocation, initial: DraftContent) {
  const session = useContext(SessionStoreContext);
  // Standalone composers retain their previous local lifetime for custom compositions.
  const [local] = useState(() => createReviewDraftStore(() => ({ snapshotId: 0, locked: false })));
  const store = session?.drafts ?? local;
  const key = draftKey(location);
  const acquired = useMemo(() => store.acquire(location, initial), [store, key]);
  useLayoutEffect(() => store.mount(key), [store, key]);
  const cleared = useMemo(
    () => ({
      ...acquired,
      content: { ...emptyDraftContent(), category: acquired.initial.category },
      pending: false,
      stale: false,
      interrupted: false,
    }),
    [acquired]
  );
  const draft = useSyncExternalStore(
    store.subscribe,
    () => store.get(key) ?? cleared,
    () => store.get(key) ?? cleared
  );
  const { token, content } = draft;
  const current = () => {
    const live = store.get(key);
    if (!store.owns(key, token) || !live || live.stale || live.pending || live.interrupted)
      return false;
    if (session) {
      const state = session.getSnapshot();
      const target = live.target ?? live.location;
      const parentId = target.commentId ?? target.existingComment?.id;
      const comment = parentId
        ? state.files.flatMap(file => file.comments).find(c => c.id === parentId)
        : null;
      if (
        (parentId && !comment) ||
        (target.existingComment &&
          comment &&
          draftKey({
            filePath: target.existingComment.filePath,
            lineRange: target.existingComment.lineRange,
            existingComment: target.existingComment,
          }) !==
            draftKey({
              filePath: comment.filePath,
              lineRange: comment.lineRange,
              existingComment: comment,
            })) ||
        (!parentId && !state.reviewedPaths.has(target.filePath)) ||
        (target.existingReply &&
          !comment?.replies?.some(reply => reply.id === target.existingReply?.id))
      ) {
        store.invalidate(key, token);
        return false;
      }
    }
    return true;
  };
  const set =
    <K extends keyof DraftContent>(field: K) =>
    (update: SetStateAction<DraftContent[K]>) => {
      if (!store.get(key) && (draft !== cleared || field === 'attachments')) return;
      const live =
        store.get(key) ??
        store.acquire(location, { ...emptyDraftContent(), category: initial.category });
      if (store.get(key) && live.token !== token && draft !== cleared) return;
      store.update(key, draft === cleared ? live.token : token, previous => ({
        ...previous,
        [field]:
          typeof update === 'function'
            ? (update as (value: DraftContent[K]) => DraftContent[K])(previous[field])
            : update,
      }));
    };
  const currentLocation = () => {
    if (!session) return draft.location;
    const state = session.getSnapshot();
    const original = draft.target ?? draft.location;
    if (original.commentId) {
      const comment = state.files
        .flatMap(file => file.comments)
        .find(c => c.id === original.commentId);
      if (
        !comment ||
        (original.existingReply && !comment.replies?.some(r => r.id === original.existingReply?.id))
      )
        return null;
      return { ...original, filePath: comment.filePath };
    }
    if (!state.reviewedPaths.has(original.filePath)) return null;
    const existingComment = original.existingComment
      ? state.files.flatMap(file => file.comments).find(c => c.id === original.existingComment?.id)
      : undefined;
    if (original.existingComment && !existingComment) return null;
    const range = existingComment ? existingComment.lineRange : original.lineRange;
    if (!range)
      return original.lineRange
        ? null
        : { ...original, existingComment, lineRange: null, originalCode: undefined };
    const file = session.getDiffFile(original.filePath);
    const lines = file && collectVisibleRangeLines(file, range);
    if (!lines) return null;
    return {
      ...original,
      existingComment,
      lineRange: range,
      originalCode: lines.map(line => line.content).join('\n'),
    };
  };
  const target = draft.stale ? currentLocation() : null;
  return {
    draft,
    content,
    current,
    setBody: set('body'),
    setCategory: set('category'),
    setShowSuggestion: set('showSuggestion'),
    setProposedCode: set('proposedCode'),
    setAttachments: set('attachments'),
    clear: () => store.clear(key, token),
    onProcessingChange: (pending: boolean) => store.processing(key, token, pending),
    onAttachmentsAborted: () => store.interrupt(key, token),
    dismissInterrupted: () => store.dismissInterrupted(key, token),
    canRebind: target !== null,
    rebind: () => {
      if (target) store.rebind(key, token, target, content);
    },
    canMakeFileComment:
      !!session?.getSnapshot().reviewedPaths.has(draft.location.filePath) &&
      !draft.location.commentId,
    makeFileComment: () => {
      if (
        !session?.getSnapshot().reviewedPaths.has(draft.location.filePath) ||
        draft.location.commentId
      )
        return;
      const body = content.showSuggestion
        ? `${content.body}\n\n\`\`\`suggestion\n${content.proposedCode}\n\`\`\``
        : content.body;
      store.rebind(
        key,
        token,
        {
          ...draft.location,
          existingComment: session
            .getSnapshot()
            .files.flatMap(file => file.comments)
            .find(c => c.id === draft.location.existingComment?.id),
          lineRange: null,
          originalCode: undefined,
        },
        { ...content, body, showSuggestion: false, proposedCode: '' }
      );
    },
  };
}
