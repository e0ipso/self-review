import { useMemo } from 'react';
import type { DiffFile, ReviewComment } from '@self-review/types';
import { useFileReview } from '../../context/ReviewContext';
import { createCommentAnchorMatcher } from '../../utils/comment-anchors';
const EMPTY: ReviewComment[] = [];

/** Index each thread once, rather than searching review state for every rendered diff row. */
export function useFileCommentIndex(file: DiffFile) {
  const comments = useFileReview(file.newPath || file.oldPath)?.comments ?? EMPTY;
  return useMemo(() => {
    const ends = new Map<string, ReviewComment[]>();
    const covered = new Set<string>();
    const hasAnchor = createCommentAnchorMatcher(file);
    for (const comment of comments) {
      const range = comment.lineRange;
      if (!range || !hasAnchor(comment)) continue;
      const key = `${range.side}:${range.end}`;
      ends.set(key, [...(ends.get(key) ?? []), comment]);
      for (let line = range.start; line <= range.end; line++) covered.add(`${range.side}:${line}`);
    }
    return {
      endingAt: (line: number | null | undefined, side: 'old' | 'new') =>
        ends.get(`${side}:${line}`) ?? EMPTY,
      covers: (line: number | null | undefined, side: 'old' | 'new') =>
        covered.has(`${side}:${line}`),
    };
  }, [file, comments]);
}
