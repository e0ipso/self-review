import { useEffect, useImperativeHandle, useRef, type ForwardedRef } from 'react';
import type { ReviewComment, ReviewState } from '@self-review/types';
import { useReview } from '../context/ReviewContext';

export interface ReviewHandle {
  /** Return the current review state (comments, viewed flags, source metadata). */
  getReviewState: () => ReviewState;
}

/**
 * Bridges ReviewProvider context state to both consumer access patterns:
 * - Imperative ref handle (`ref.current.getReviewState()`)
 * - Reactive callback (`onReviewChange(comments)`)
 *
 * Must be called from a component that is inside the ReviewProvider tree.
 */
export function useReviewBridge(
  ref: ForwardedRef<ReviewHandle>,
  onReviewChange?: (comments: ReviewComment[]) => void,
): void {
  const { files, diffSource } = useReview();

  // Stable refs so getReviewState() never closes over stale values
  const filesRef = useRef(files);
  const diffSourceRef = useRef(diffSource);
  filesRef.current = files;
  diffSourceRef.current = diffSource;

  useImperativeHandle(ref, () => ({
    getReviewState: (): ReviewState => ({
      timestamp: new Date().toISOString(),
      source: diffSourceRef.current,
      files: filesRef.current,
    }),
  }));

  // Stabilize onReviewChange via ref so it doesn't trigger the effect
  const onReviewChangeRef = useRef(onReviewChange);
  onReviewChangeRef.current = onReviewChange;

  // Track previous comment objects to avoid firing on unrelated state changes.
  // Review mutations replace the affected comment immutably, including nested
  // reply changes, while viewed-only file updates preserve comment references.
  const prevCommentsRef = useRef<ReviewComment[] | null>(null);

  useEffect(() => {
    const comments = files.flatMap((f) => f.comments);
    const previousComments = prevCommentsRef.current;
    const commentsChanged =
      previousComments === null ||
      previousComments.length !== comments.length ||
      comments.some((comment, index) => comment !== previousComments[index]);

    if (commentsChanged) {
      prevCommentsRef.current = comments;
      onReviewChangeRef.current?.(comments);
    }
  }, [files]);
}
