import { expect, it } from 'vitest';
import type { DiffHunk } from '@self-review/types';
import { expansionAnchor, planExpansion } from './expansion-plan';
import { getHunkChangeRange, trimHunkContext } from './diff-utils';
function hunk(start: number): DiffHunk {
  return {
    header: '',
    oldStart: start,
    oldLines: 1,
    newStart: start,
    newLines: 1,
    lines: [
      { type: 'deletion', oldLineNumber: start, newLineNumber: null, content: 'old' },
      { type: 'addition', oldLineNumber: null, newLineNumber: start, content: 'new' },
    ],
  };
}
it('targets the original outer ranges of a merged hunk and preserves independent budgets', () => {
  const original = [hunk(10), hunk(20)];
  const ranges = original.map(getHunkChangeRange);
  const merged = { ...original[0], lines: [...original[0].lines, ...original[1].lines] };
  const budgets = [
    { above: 3, below: 3 },
    { above: 3, below: 3 },
  ];
  const up = planExpansion([merged], ranges, budgets, 'up', 0, 'top');
  expect(up.budgets).toEqual([
    { above: 8, below: 3 },
    { above: 3, below: 3 },
  ]);
  const down = planExpansion([merged], ranges, up.budgets, 'down', 0, 'bottom');
  expect(down.budgets).toEqual([
    { above: 8, below: 3 },
    { above: 3, below: 8 },
  ]);
  expect(budgets).toEqual([
    { above: 3, below: 3 },
    { above: 3, below: 3 },
  ]);
  expect(trimHunkContext([merged], ranges, down.budgets).flatMap(h => h.lines)).toEqual(
    merged.lines
  );
});
it('opens both facing sides of a gap without widening the outer context', () => {
  const hunks = [hunk(10), hunk(20)];
  const plan = planExpansion(
    hunks,
    hunks.map(getHunkChangeRange),
    [
      { above: 3, below: 3 },
      { above: 3, below: 3 },
    ],
    'all',
    1,
    'between'
  );
  expect(plan.budgets).toEqual([
    { above: 3, below: 99999 },
    { above: 99999, below: 3 },
  ]);
  expect(plan.maxBudget).toBe(99999);
  expect(expansionAnchor(hunks, 'up', 1, 'between')).toEqual({ lineNumber: 20, side: 'old' });
  expect(expansionAnchor(hunks, 'down', 1, 'between')).toEqual({ lineNumber: 10, side: 'new' });
  expect(expansionAnchor(hunks, 'all', 1, 'between')).toEqual({ lineNumber: 20, side: 'old' });
});
