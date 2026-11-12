import type { DiffHunk } from '@self-review/types';
import type { HunkChangeRange, HunkContextBudget } from './diff-utils';

export type ExpansionDirection = 'up' | 'down' | 'all';
export type ExpansionPosition = 'top' | 'between' | 'bottom';

/** Plan against original change ranges, even after neighboring hunks have merged. */
export function planExpansion(
  currentHunks: DiffHunk[],
  originalRanges: HunkChangeRange[],
  previousBudgets: HunkContextBudget[],
  direction: ExpansionDirection,
  hunkIndex: number,
  position: ExpansionPosition
) {
  const budgets = previousBudgets.map(budget => ({ ...budget }));
  // --- Update per-hunk budgets for the clicked direction ---
  // Map current hunkIndex back to original hunk indices via change ranges.
  const currentHunk = currentHunks[hunkIndex];
  const findOriginalIndices = (h: DiffHunk): number[] => {
    const indices: number[] = [];
    for (let i = 0; i < originalRanges.length; i++) {
      const range = originalRanges[i];
      for (const line of h.lines) {
        if (line.type === 'context') continue;
        if (
          range.oldRange &&
          line.oldLineNumber !== null &&
          line.oldLineNumber >= range.oldRange[0] &&
          line.oldLineNumber <= range.oldRange[1]
        ) {
          indices.push(i);
          break;
        }
        if (
          range.newRange &&
          line.newLineNumber !== null &&
          line.newLineNumber >= range.newRange[0] &&
          line.newLineNumber <= range.newRange[1]
        ) {
          indices.push(i);
          break;
        }
      }
    }
    return indices;
  };

  const STEP = 5;
  const MAX_CONTEXT = 99999;

  if (direction === 'up') {
    // Increase `above` for the first original hunk in currentHunk
    const indices = findOriginalIndices(currentHunk);
    if (indices.length > 0) {
      budgets[indices[0]].above += STEP;
    }
  } else if (direction === 'down') {
    // The hunk ABOVE the bar:
    //   bottom bar: hunkIndex IS the hunk above
    //   between bar: hunkIndex is the hunk below, so above = hunkIndex - 1
    const aboveIdx = position === 'bottom' ? hunkIndex : hunkIndex - 1;
    const aboveHunk = currentHunks[Math.max(0, aboveIdx)];
    const indices = findOriginalIndices(aboveHunk);
    if (indices.length > 0) {
      budgets[indices[indices.length - 1]].below += STEP;
    }
  } else {
    // 'all' — expand both sides fully
    if (position === 'top') {
      const indices = findOriginalIndices(currentHunk);
      if (indices.length > 0) budgets[indices[0]].above = MAX_CONTEXT;
    } else if (position === 'bottom') {
      const indices = findOriginalIndices(currentHunk);
      if (indices.length > 0) budgets[indices[indices.length - 1]].below = MAX_CONTEXT;
    } else {
      // between: expand below of hunk above AND above of hunk below
      const aboveHunk = currentHunks[hunkIndex - 1];
      const aboveIndices = findOriginalIndices(aboveHunk);
      if (aboveIndices.length > 0)
        budgets[aboveIndices[aboveIndices.length - 1]].below = MAX_CONTEXT;
      const belowIndices = findOriginalIndices(currentHunk);
      if (belowIndices.length > 0) budgets[belowIndices[0]].above = MAX_CONTEXT;
    }
  }

  let maxBudget = 0;
  for (const budget of budgets) maxBudget = Math.max(maxBudget, budget.above, budget.below);
  return { budgets, maxBudget };
}

/** Deleted lines anchor to the old side; context and additions anchor to the new side. */
export function expansionAnchor(
  hunks: DiffHunk[],
  direction: ExpansionDirection,
  hunkIndex: number,
  position: ExpansionPosition
) {
  const index =
    direction === 'down'
      ? Math.max(0, position === 'bottom' ? hunkIndex : hunkIndex - 1)
      : hunkIndex;
  const lines = hunks[index]?.lines;
  const line = direction === 'down' ? lines?.[lines.length - 1] : lines?.[0];
  if (!line) return null;
  const side = line.type === 'deletion' ? ('old' as const) : ('new' as const);
  const lineNumber = side === 'old' ? line.oldLineNumber : line.newLineNumber;
  return lineNumber === null ? null : { lineNumber, side };
}
