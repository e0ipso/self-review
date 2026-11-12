import type { FileReviewState, ReviewComment } from '@self-review/types';

/** Ordered lookups select the first canonical entry, including repeated display paths. */
export function createReviewStateQueries(files: FileReviewState[]) {
  const byPath = new Map<string, FileReviewState>();
  for (const file of files) if (!byPath.has(file.path)) byPath.set(file.path, file);

  const getCommentsForFile = (filePath: string): ReviewComment[] => {
    const file = byPath.get(filePath);
    return file ? file.comments : [];
  };

  const getCommentsForLine = (
    filePath: string,
    lineNumber: number,
    side: 'old' | 'new'
  ): ReviewComment[] => {
    const file = byPath.get(filePath);
    if (!file) return [];

    return file.comments.filter(comment => {
      if (!comment.lineRange) return false;
      if (comment.lineRange.side !== side) return false;
      return lineNumber >= comment.lineRange.start && lineNumber <= comment.lineRange.end;
    });
  };

  return { getCommentsForFile, getCommentsForLine };
}
