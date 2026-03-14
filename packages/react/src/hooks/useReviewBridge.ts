import { useEffect, useImperativeHandle, useMemo, useRef, type ForwardedRef } from 'react';
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

  const comments = useMemo(
    () => files.flatMap((f) => f.comments),
    [files],
  );

  useEffect(() => {
    if (onReviewChange) {
      onReviewChange(comments);
    }
  }, [comments, onReviewChange]);
}
