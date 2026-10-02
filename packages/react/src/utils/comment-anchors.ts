import type { DiffFile, DiffLine, LineRange, ReviewComment } from '@self-review/types';

const lineNumberOn = (line: DiffLine, side: LineRange['side']): number | null =>
  side === 'old' ? line.oldLineNumber : line.newLineNumber;

/** Decides only placement; whether the whole range is visible is `collectVisibleRangeLines`. */
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

/**
 * The range's diff lines, or `null` when any line is hidden (gap between hunks) or the range is
 * malformed. Endpoint matching alone accepts a range spanning a gap, and partial code would
 * corrupt a suggestion's recorded original.
 */
export function collectVisibleRangeLines(file: DiffFile, range: LineRange): DiffLine[] | null {
  const { side, start, end } = range;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start > end) return null;

  const seen = new Set<number>();
  const lines: DiffLine[] = [];
  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      const n = lineNumberOn(line, side);
      if (n === null || n < start || n > end || seen.has(n)) continue;
      seen.add(n);
      lines.push(line);
    }
  }
  // `seen` holds distinct integers in [start, end], so a full count is full coverage.
  return seen.size === end - start + 1 ? lines : null;
}
