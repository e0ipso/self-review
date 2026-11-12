import type { Attachment, LineRange, Reply, ReviewComment } from '@self-review/types';

export interface DraftContent {
  body: string;
  category: string;
  showSuggestion: boolean;
  proposedCode: string;
  attachments: Attachment[];
}
export interface DraftLocation {
  filePath: string;
  lineRange: LineRange | null;
  existingComment?: ReviewComment;
  originalCode?: string;
  commentId?: string;
  existingReply?: Reply;
}
export interface ReviewDraft {
  key: string;
  token: symbol;
  content: DraftContent;
  initial: DraftContent;
  location: DraftLocation;
  target?: DraftLocation;
  snapshotId: number;
  stale: boolean;
  pending: boolean;
  interrupted: boolean;
  controller: AbortController;
}
export const emptyDraftContent = (): DraftContent => ({
  body: '',
  category: '',
  showSuggestion: false,
  proposedCode: '',
  attachments: [],
});
export function draftKey(location: DraftLocation) {
  return JSON.stringify(
    location.commentId
      ? ['reply', location.commentId, location.existingReply?.id]
      : [
          'comment',
          location.filePath,
          location.lineRange
            ? [location.lineRange.side, location.lineRange.start, location.lineRange.end]
            : null,
          location.existingComment?.id,
        ]
  );
}
export function draftHasWork(draft: ReviewDraft): boolean {
  const { content: value, initial } = draft;
  return (
    draft.pending ||
    draft.interrupted ||
    value.body !== initial.body ||
    value.category !== initial.category ||
    value.showSuggestion !== initial.showSuggestion ||
    value.proposedCode !== initial.proposedCode ||
    value.attachments !== initial.attachments
  );
}

/** Session memory only. Every mutation and async completion must still own its draft token. */
export function createReviewDraftStore(owner: () => { snapshotId: number; locked: boolean }) {
  let drafts: readonly ReviewDraft[] = [];
  const mounted = new Map<string, Set<symbol>>();
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach(listener => listener());
  const get = (key: string) => drafts.find(draft => draft.key === key);
  const owns = (key: string, token: symbol) => get(key)?.token === token && !owner().locked;
  const replace = (draft: ReviewDraft) => {
    drafts = drafts.map(previous => (previous.key === draft.key ? draft : previous));
    emit();
  };
  return {
    get,
    owns,
    isMounted: (key: string) => !!mounted.get(key)?.size,
    mount(key: string) {
      const id = Symbol('composer');
      const registrations = mounted.get(key) ?? new Set<symbol>();
      registrations.add(id);
      mounted.set(key, registrations);
      drafts = [...drafts];
      emit();
      return () => {
        registrations.delete(id);
        drafts = [...drafts];
        emit();
      };
    },
    getSnapshot: () => drafts,
    hasWork: () => drafts.some(draftHasWork),
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    acquire(location: DraftLocation, content: DraftContent) {
      const key = draftKey(location);
      const previous = get(key);
      if (previous) return previous;
      const draft: ReviewDraft = {
        key,
        token: Symbol('draft'),
        content,
        initial: content,
        location,
        snapshotId: owner().snapshotId,
        stale: false,
        pending: false,
        interrupted: false,
        controller: new AbortController(),
      };
      // Opening an untouched editor is not a mutation. Subscribers observe its first edit.
      drafts = [...drafts, draft];
      return draft;
    },
    update(key: string, token: symbol, update: (content: DraftContent) => DraftContent) {
      const draft = get(key);
      if (draft && owns(key, token)) replace({ ...draft, content: update(draft.content) });
    },
    processing(key: string, token: symbol, pending: boolean) {
      const draft = get(key);
      if (draft && owns(key, token) && draft.pending !== pending) replace({ ...draft, pending });
    },
    interrupt(key: string, token: symbol) {
      const draft = get(key);
      if (draft && owns(key, token) && draft.pending)
        replace({ ...draft, pending: false, interrupted: true });
    },
    dismissInterrupted(key: string, token: symbol) {
      const draft = get(key);
      if (draft && owns(key, token)) replace({ ...draft, interrupted: false });
    },
    clear(key: string, token: symbol) {
      const draft = get(key);
      if (!draft || !owns(key, token)) return;
      drafts = drafts.filter(item => item !== draft);
      draft.controller.abort();
      emit();
    },
    invalidate(key: string, token: symbol) {
      const draft = get(key);
      if (draft && owns(key, token)) replace({ ...draft, stale: true });
    },
    rebind(key: string, token: symbol, location: DraftLocation, content: DraftContent) {
      const draft = get(key);
      if (!draft || !owns(key, token)) return;
      draft.controller.abort();
      replace({
        ...draft,
        token: Symbol('draft'),
        target: location,
        content,
        stale: false,
        pending: false,
        interrupted: draft.interrupted || draft.pending,
        snapshotId: owner().snapshotId,
        controller: new AbortController(),
      });
    },
    transition(replacement: boolean) {
      const previous = drafts;
      drafts = replacement
        ? []
        : drafts.map(draft => ({
            ...draft,
            token: Symbol('draft'),
            stale: true,
            snapshotId: owner().snapshotId,
            pending: false,
            interrupted: draft.interrupted || draft.pending,
            controller: new AbortController(),
          }));
      previous.forEach(draft => draft.controller.abort());
      emit();
    },
    abortPending() {
      const previous = drafts;
      drafts = drafts.map(draft =>
        draft.pending ? { ...draft, pending: false, interrupted: true } : draft
      );
      previous.filter(draft => draft.pending).forEach(draft => draft.controller.abort());
    },
  };
}
export type ReviewDraftStore = ReturnType<typeof createReviewDraftStore>;

export class UnfinishedReviewDraftError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnfinishedReviewDraftError';
  }
}
