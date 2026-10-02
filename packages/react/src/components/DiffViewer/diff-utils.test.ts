import { describe, it, expect } from 'vitest';
import type { DiffFile, DiffLine } from '@self-review/types';
import { extractOriginalCode } from './diff-utils';

const ctx = (oldN: number, newN: number): DiffLine => ({
  type: 'context',
  oldLineNumber: oldN,
  newLineNumber: newN,
  content: `ctx ${oldN}/${newN}`,
});
const del = (oldN: number): DiffLine => ({
  type: 'deletion',
  oldLineNumber: oldN,
  newLineNumber: null,
  content: `del ${oldN}`,
});
const add = (newN: number): DiffLine => ({
  type: 'addition',
  oldLineNumber: null,
  newLineNumber: newN,
  content: `add ${newN}`,
});

// Two hunks with a hidden gap between them on both sides:
//   hunk 1: old 1–3, new 1–3
//   hunk 2: old 10–12, new 11–13 (old 11 deleted, new 12 added)
const file: DiffFile = {
  oldPath: 'src/a.ts',
  newPath: 'src/a.ts',
  changeType: 'modified',
  isBinary: false,
  hunks: [
    {
      header: '@@ -1,3 +1,3 @@',
      oldStart: 1,
      oldLines: 3,
      newStart: 1,
      newLines: 3,
      lines: [ctx(1, 1), ctx(2, 2), ctx(3, 3)],
    },
    {
      header: '@@ -10,3 +11,3 @@',
      oldStart: 10,
      oldLines: 3,
      newStart: 11,
      newLines: 3,
      lines: [ctx(10, 11), del(11), add(12), ctx(12, 13)],
    },
  ],
};

describe('extractOriginalCode coverage', () => {
  it('returns the visible code when every line of a new-side range is shown', () => {
    expect(extractOriginalCode(file, { side: 'new', start: 11, end: 13 })).toBe(
      'ctx 10/11\nadd 12\nctx 12/13'
    );
  });

  it('returns the visible code when every line of an old-side range is shown', () => {
    expect(extractOriginalCode(file, { side: 'old', start: 10, end: 12 })).toBe(
      'ctx 10/11\ndel 11\nctx 12/13'
    );
  });

  it('refuses a new-side range whose endpoints are visible but which spans the hunk gap', () => {
    expect(extractOriginalCode(file, { side: 'new', start: 2, end: 12 })).toBeUndefined();
  });

  it('refuses an old-side range whose endpoints are visible but which spans the hunk gap', () => {
    expect(extractOriginalCode(file, { side: 'old', start: 3, end: 10 })).toBeUndefined();
  });

  it('refuses a range whose end line is not in any hunk', () => {
    expect(extractOriginalCode(file, { side: 'new', start: 2, end: 5 })).toBeUndefined();
  });

  it('refuses a range whose start line is not in any hunk', () => {
    expect(extractOriginalCode(file, { side: 'old', start: 8, end: 10 })).toBeUndefined();
  });

  it('counts only lines on the selected side', () => {
    // new 12 exists only as an addition; old 12 is the context line after the deletion.
    expect(extractOriginalCode(file, { side: 'old', start: 11, end: 11 })).toBe('del 11');
    expect(extractOriginalCode(file, { side: 'new', start: 12, end: 12 })).toBe('add 12');
  });

  it('refuses an inverted range', () => {
    expect(extractOriginalCode(file, { side: 'new', start: 3, end: 1 })).toBeUndefined();
  });
});
