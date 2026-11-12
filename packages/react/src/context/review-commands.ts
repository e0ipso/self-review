import { useLayoutEffect, useMemo } from 'react';
import type { ReviewAdapter } from '../adapter';
import type { UseReviewStateReturn } from '../hooks/useReviewState';
import type {
  Attachment,
  DiffHunk,
  LineRange,
  Reply,
  ReviewComment,
  Suggestion,
} from '@self-review/types';
import type { ReviewSessionStore } from './review-session';
import {
  createReviewSessionController,
  type ReviewSessionController,
} from './review-session-controller';
import type { createReviewStateCommands } from './review-state-commands';

/** Stable mutation contract shared by narrow consumers and the compatibility context. */
export interface ReviewCommands {
  addComment: (
    filePath: string,
    lineRange: LineRange | null,
    body: string,
    category: string,
    suggestion: Suggestion | null,
    attachments?: Attachment[]
  ) => void;
  editComment: (id: string, updates: Partial<ReviewComment>) => void;
  deleteComment: (id: string) => void;
  addReply: (commentId: string, body: string, author?: string, attachments?: Attachment[]) => void;
  updateReply: (commentId: string, replyId: string, updates: Partial<Reply>) => void;
  deleteReply: (commentId: string, replyId: string) => void;
  toggleViewed: (filePath: string) => void;
  expandFileContext: (
    filePath: string,
    contextLines: number
  ) => Promise<{ hunks: DiffHunk[]; totalLines: number } | null>;
  updateFileHunks: (filePath: string, hunks: DiffHunk[]) => void;
  /** Record the destination the host accepted. */
  setApplyDestination: (destinationRoot: string) => void;
  /** Checks synchronously, including before a replacement has committed in React. */
  isCurrentSession?: () => boolean;
}

/** Mutations keep their stable identities. Snapshot commands use the same request owner as loading. */
export function createSessionCommands(
  store: ReviewSessionStore,
  controller: ReviewSessionController,
  review: ReturnType<typeof createReviewStateCommands>
): ReviewCommands {
  const owner = controller.capture();
  return {
    addComment: review.addComment,
    editComment: review.updateComment,
    deleteComment: review.deleteComment,
    addReply: review.addReply,
    updateReply: review.updateReply,
    deleteReply: review.deleteReply,
    toggleViewed: review.toggleViewed,
    isCurrentSession: owner.current,
    expandFileContext: owner.expandFileContext,
    updateFileHunks: (filePath, hunks) => {
      if (owner.current()) store.dispatch({ type: 'hunks', filePath, hunks });
    },
    setApplyDestination: destination => {
      if (owner.current()) store.dispatch({ type: 'destination', destination });
    },
  };
}

/** Retained for custom hook compositions. The provider binds its existing controller directly. */
export function useSessionCommands(
  store: ReviewSessionStore,
  adapter: ReviewAdapter | null,
  review: UseReviewStateReturn,
  sessionId: number,
  snapshotId: number
): ReviewCommands {
  const controller = useMemo(() => createReviewSessionController(store, adapter), [store, adapter]);
  useLayoutEffect(() => controller.activate(), [controller]);
  return useMemo(
    () => createSessionCommands(store, controller, review),
    [
      store,
      controller,
      sessionId,
      snapshotId,
      review.addComment,
      review.updateComment,
      review.deleteComment,
      review.addReply,
      review.updateReply,
      review.deleteReply,
      review.toggleViewed,
    ]
  );
}
