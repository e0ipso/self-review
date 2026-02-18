import type { DiffFile, DiffHunk, LineRange } from '../../../shared/types';

/**
 * Extract the original code content for a given line range from a DiffFile.
 * Used to provide originalCode for the Suggest feature in both SplitView and UnifiedView.
 */
export function extractOriginalCode(
  file: DiffFile,
  lineRange: LineRange
): string | undefined {
  const { start, end, side } = lineRange;
  const lines: string[] = [];
  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      const lineNum =
        side === 'old' ? line.oldLineNumber : line.newLineNumber;
      if (lineNum !== null && lineNum >= start && lineNum <= end) {
        lines.push(line.content);
      }
    }
  }
  return lines.length > 0 ? lines.join('\n') : undefined;
}

// ===== Hunk context trimming for directional expansion =====

export interface HunkChangeRange {
  oldRange: [number, number] | null; // [min, max] of deletion line numbers
  newRange: [number, number] | null; // [min, max] of addition line numbers
}

export interface HunkContextBudget {
  above: number;
  below: number;
}

/** Extract the line number ranges of non-context (changed) lines in a hunk. */
export function getHunkChangeRange(hunk: DiffHunk): HunkChangeRange {
  let minOld = Infinity, maxOld = -Infinity;
  let minNew = Infinity, maxNew = -Infinity;
  for (const line of hunk.lines) {
    if (line.type === 'context') continue;
    if (line.oldLineNumber !== null) {
      minOld = Math.min(minOld, line.oldLineNumber);
      maxOld = Math.max(maxOld, line.oldLineNumber);
    }
    if (line.newLineNumber !== null) {
      minNew = Math.min(minNew, line.newLineNumber);
      maxNew = Math.max(maxNew, line.newLineNumber);
    }
  }
  return {
    oldRange: minOld <= maxOld ? [minOld, maxOld] : null,
    newRange: minNew <= maxNew ? [minNew, maxNew] : null,
  };
}

/** Count leading context lines at the start of a hunk. */
export function countLeadingContext(hunk: DiffHunk): number {
  let count = 0;
  for (const line of hunk.lines) {
    if (line.type === 'context') count++;
    else break;
  }
  return count;
}

/** Count trailing context lines at the end of a hunk. */
export function countTrailingContext(hunk: DiffHunk): number {
  let count = 0;
  for (let i = hunk.lines.length - 1; i >= 0; i--) {
    if (hunk.lines[i].type === 'context') count++;
    else break;
  }
  return count;
}

/** Check if an expanded hunk contains a given original change range. */
function hunkContainsRange(hunk: DiffHunk, range: HunkChangeRange): boolean {
  for (const line of hunk.lines) {
    if (line.type === 'context') continue;
    if (range.oldRange && line.oldLineNumber !== null &&
        line.oldLineNumber >= range.oldRange[0] && line.oldLineNumber <= range.oldRange[1]) {
      return true;
    }
    if (range.newRange && line.newLineNumber !== null &&
        line.newLineNumber >= range.newRange[0] && line.newLineNumber <= range.newRange[1]) {
      return true;
    }
  }
  return false;
}

/**
 * Trim expanded hunks to match per-hunk context budgets.
 *
 * After git returns hunks with symmetric context (-U<N>), this trims leading
 * and trailing context lines per hunk to match the directional budgets.
 * Handles hunk merging: if two original hunks merged into one expanded hunk,
 * the leading context uses the first original's `above` budget and the
 * trailing context uses the last original's `below` budget.
 */
export function trimHunkContext(
  expandedHunks: DiffHunk[],
  originalRanges: HunkChangeRange[],
  budgets: HunkContextBudget[],
): DiffHunk[] {
  return expandedHunks.map(hunk => {
    // Find which original hunks this expanded hunk contains
    const containedIndices: number[] = [];
    for (let i = 0; i < originalRanges.length; i++) {
      if (hunkContainsRange(hunk, originalRanges[i])) {
        containedIndices.push(i);
      }
    }

    if (containedIndices.length === 0) return hunk;

    const firstBudget = budgets[containedIndices[0]];
    const lastBudget = budgets[containedIndices[containedIndices.length - 1]];

    const leadingContext = countLeadingContext(hunk);
    const trailingContext = countTrailingContext(hunk);

    const trimFromStart = Math.max(0, leadingContext - firstBudget.above);
    const trimFromEnd = Math.max(0, trailingContext - lastBudget.below);

    if (trimFromStart === 0 && trimFromEnd === 0) return hunk;

    const endIdx = trimFromEnd > 0 ? hunk.lines.length - trimFromEnd : hunk.lines.length;
    const trimmedLines = hunk.lines.slice(trimFromStart, endIdx);

    if (trimmedLines.length === 0) return hunk;

    // Recompute hunk metadata from actual trimmed lines
    let newOldLines = 0, newNewLines = 0;
    for (const line of trimmedLines) {
      if (line.type === 'context' || line.type === 'deletion') newOldLines++;
      if (line.type === 'context' || line.type === 'addition') newNewLines++;
    }

    const newOldStart = hunk.oldStart + trimFromStart;
    const newNewStart = hunk.newStart + trimFromStart;

    return {
      ...hunk,
      lines: trimmedLines,
      oldStart: newOldStart,
      newStart: newNewStart,
      oldLines: newOldLines,
      newLines: newNewLines,
      header: `@@ -${newOldStart},${newOldLines} +${newNewStart},${newNewLines} @@`,
    };
  });
}
