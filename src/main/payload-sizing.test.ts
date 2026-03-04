import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computePayloadStats, countTotalLines } from './payload-sizing';
import type { AppConfig, DiffFile, DiffHunk, DiffLine } from '../shared/types';

// Minimal config factory — only maxFiles and maxTotalLines matter for sizing
function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    theme: 'system',
    diffView: 'split',
    fontSize: 14,
    outputFormat: 'xml',
    outputFile: './review.xml',
    ignore: [],
    categories: [],
    defaultDiffArgs: '',
    showUntracked: true,
    wordWrap: true,
    maxFiles: 500,
    maxTotalLines: 100000,
    ...overrides,
  };
}

function makeLine(type: DiffLine['type'] = 'context'): DiffLine {
  return { type, oldLineNumber: 1, newLineNumber: 1, content: 'x' };
}

function makeHunk(lineCount: number): DiffHunk {
  return {
    header: '@@ -1,1 +1,1 @@',
    oldStart: 1,
    oldLines: lineCount,
    newStart: 1,
    newLines: lineCount,
    lines: Array.from({ length: lineCount }, () => makeLine()),
  };
}

function makeFile(hunks: DiffHunk[]): DiffFile {
  return {
    oldPath: 'a.txt',
    newPath: 'a.txt',
    changeType: 'modified',
    isBinary: false,
    hunks,
  };
}

describe('computePayloadStats', () => {
  it('returns correct values below threshold', () => {
    const config = makeConfig({ maxFiles: 100, maxTotalLines: 1000 });
    const stats = computePayloadStats(10, 500, config);

    expect(stats.fileCount).toBe(10);
    expect(stats.totalLines).toBe(500);
    expect(stats.exceedsFiles).toBe(false);
    expect(stats.exceedsLines).toBe(false);
    expect(stats.exceedsAny).toBe(false);
  });

  it('detects file count exceeded', () => {
    const config = makeConfig({ maxFiles: 10, maxTotalLines: 100000 });
    const stats = computePayloadStats(15, 500, config);

    expect(stats.exceedsFiles).toBe(true);
    expect(stats.exceedsLines).toBe(false);
    expect(stats.exceedsAny).toBe(true);
  });

  it('detects line count exceeded', () => {
    const config = makeConfig({ maxFiles: 500, maxTotalLines: 1000 });
    const stats = computePayloadStats(5, 2000, config);

    expect(stats.exceedsFiles).toBe(false);
    expect(stats.exceedsLines).toBe(true);
    expect(stats.exceedsAny).toBe(true);
  });

  it('detects both exceeded', () => {
    const config = makeConfig({ maxFiles: 10, maxTotalLines: 1000 });
    const stats = computePayloadStats(20, 2000, config);

    expect(stats.exceedsFiles).toBe(true);
    expect(stats.exceedsLines).toBe(true);
    expect(stats.exceedsAny).toBe(true);
  });

  it('with maxFiles=0 disables file guard', () => {
    const config = makeConfig({ maxFiles: 0, maxTotalLines: 1000 });
    const stats = computePayloadStats(999999, 500, config);

    expect(stats.exceedsFiles).toBe(false);
    expect(stats.exceedsAny).toBe(false);
  });

  it('with maxTotalLines=0 disables line guard', () => {
    const config = makeConfig({ maxFiles: 500, maxTotalLines: 0 });
    const stats = computePayloadStats(5, 999999, config);

    expect(stats.exceedsLines).toBe(false);
    expect(stats.exceedsAny).toBe(false);
  });

  it('with both=0 never triggers', () => {
    const config = makeConfig({ maxFiles: 0, maxTotalLines: 0 });
    const stats = computePayloadStats(999999, 999999, config);

    expect(stats.exceedsFiles).toBe(false);
    expect(stats.exceedsLines).toBe(false);
    expect(stats.exceedsAny).toBe(false);
  });
});

describe('countTotalLines', () => {
  it('returns 0 for empty file array', () => {
    expect(countTotalLines([])).toBe(0);
  });

  it('counts lines in a single hunk', () => {
    const files = [makeFile([makeHunk(10)])];
    expect(countTotalLines(files)).toBe(10);
  });

  it('sums lines across multiple hunks in one file', () => {
    const files = [makeFile([makeHunk(5), makeHunk(3)])];
    expect(countTotalLines(files)).toBe(8);
  });

  it('sums lines across multiple files and hunks', () => {
    const files = [
      makeFile([makeHunk(10), makeHunk(20)]),
      makeFile([makeHunk(5)]),
      makeFile([makeHunk(15), makeHunk(2)]),
    ];
    expect(countTotalLines(files)).toBe(52);
  });

  it('handles files with no hunks', () => {
    const files = [makeFile([])];
    expect(countTotalLines(files)).toBe(0);
  });
});

describe('computePayloadStats edge cases', () => {
  it('exact threshold value does not trigger', () => {
    const config = makeConfig({ maxFiles: 10, maxTotalLines: 100 });
    const stats = computePayloadStats(10, 100, config);

    expect(stats.exceedsFiles).toBe(false);
    expect(stats.exceedsLines).toBe(false);
    expect(stats.exceedsAny).toBe(false);
  });

  it('one above threshold triggers', () => {
    const config = makeConfig({ maxFiles: 10, maxTotalLines: 100 });
    const stats = computePayloadStats(11, 101, config);

    expect(stats.exceedsFiles).toBe(true);
    expect(stats.exceedsLines).toBe(true);
    expect(stats.exceedsAny).toBe(true);
  });
});
