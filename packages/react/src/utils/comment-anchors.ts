import type { DiffFile, ReviewComment } from '@self-review/types';

/** Match recorded range endpoints exactly, without changing saved anchors. */
export function createCommentAnchorMatcher(file: DiffFile) {
  const lines = { old: new Set<number>(), new: new Set<number>() };
  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      if (line.oldLineNumber != null) lines.old.add(line.oldLineNumber);
      if (line.newLineNumber != null) lines.new.add(line.newLineNumber);
    }
  }
  return (comment: ReviewComment): boolean => {
    const range = comment.lineRange;
    return (
      range === null || (lines[range.side].has(range.start) && lines[range.side].has(range.end))
    );
  };
}
