import { useLayoutEffect, useMemo, useRef } from 'react';
import type { ReviewAdapter } from '../adapter';
import type { UseReviewStateReturn } from '../hooks/useReviewState';
import { expandContext } from '../read-service';
import type { ReviewContextValue } from './ReviewContext';
import type { ReviewSessionStore } from './review-session';

export type ReviewCommands = Pick<
  ReviewContextValue,
  | 'addComment'
  | 'editComment'
  | 'deleteComment'
  | 'addReply'
  | 'updateReply'
  | 'deleteReply'
  | 'toggleViewed'
  | 'expandFileContext'
  | 'updateFileHunks'
  | 'setApplyDestination'
  | 'isCurrentSession'
>;

/** Commands capture one snapshot; read ownership follows the synchronous session owner. */
export function useSessionCommands(
  store: ReviewSessionStore,
  adapter: ReviewAdapter | null,
  review: UseReviewStateReturn,
  sessionId: number,
  snapshotId: number
): ReviewCommands {
  const live = useRef(true);
  const requests = useRef(new Set<AbortController>());
  useLayoutEffect(() => {
    live.current = true;
    const abort = () => {
      requests.current.forEach(controller => controller.abort());
      requests.current.clear();
    };
    const unsubscribe = store.subscribe(() => {
      const state = store.getSnapshot();
      if (state.sessionId !== sessionId || state.snapshotId !== snapshotId) abort();
    });
    return () => {
      live.current = false;
      unsubscribe();
      abort();
    };
  }, [store, adapter, sessionId, snapshotId]);
  return useMemo<ReviewCommands>(() => {
    const owner = sessionId;
    const snapshot = snapshotId;
    const current = () =>
      live.current &&
      store.getSnapshot().sessionId === owner &&
      store.getSnapshot().snapshotId === snapshot;
    return {
      addComment: review.addComment,
      editComment: review.updateComment,
      deleteComment: review.deleteComment,
      addReply: review.addReply,
      updateReply: review.updateReply,
      deleteReply: review.deleteReply,
      toggleViewed: review.toggleViewed,
      isCurrentSession: current,
      updateFileHunks: (filePath, hunks) => {
        if (current()) store.dispatch({ type: 'hunks', filePath, hunks });
      },
      setApplyDestination: destination => {
        if (current()) store.dispatch({ type: 'destination', destination });
      },
      expandFileContext: async (filePath, contextLines) => {
        if (!(adapter?.reads?.expandContext || adapter?.expandContext) || !current()) return null;
        const controller = new AbortController();
        requests.current.add(controller);
        try {
          const result = await expandContext(
            adapter,
            { filePath, contextLines },
            controller.signal
          );
          return current() && result
            ? { hunks: result.hunks, totalLines: result.totalLines }
            : null;
        } catch (error) {
          if (!controller.signal.aborted && current())
            console.error('[ReviewContext] Failed to expand context:', error);
          return null;
        } finally {
          requests.current.delete(controller);
        }
      },
    };
  }, [
    store,
    adapter,
    sessionId,
    snapshotId,
    review.addComment,
    review.updateComment,
    review.deleteComment,
    review.addReply,
    review.updateReply,
    review.deleteReply,
    review.toggleViewed,
  ]);
}
