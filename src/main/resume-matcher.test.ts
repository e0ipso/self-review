// src/main/resume-matcher.test.ts
// Unit tests for matchResumeComments and normalizeResumePath.

import { describe, it, expect } from 'vitest';
import { matchResumeComments } from './resume-matcher';
import { normalizeResumePath } from '../shared/path-utils';
import type { DiffFile, DiffHunk, DiffLine, ReviewComment } from '../shared/types';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

type LineSpec = {
  type: 'context' | 'addition' | 'deletion';
  content: string;
  old: number | null;
  new: number | null;
};

function makeLines(specs: LineSpec[]): DiffLine[] {
  return specs.map(s => ({
    type: s.type,
    content: s.content,
    oldLineNumber: s.old,
    newLineNumber: s.new,
  }));
}

function makeDiffFile(
  lines: LineSpec[],
  opts: { newPath?: string; oldPath?: string } = {}
): DiffFile {
  const newPath = opts.newPath ?? 'test.ts';
  const oldPath = opts.oldPath ?? 'test.ts';
  const builtLines = makeLines(lines);
  const hunk: DiffHunk = {
    header: '@@ -1 +1 @@',
    oldStart: 1,
    oldLines: builtLines.filter(l => l.oldLineNumber !== null).length,
    newStart: 1,
    newLines: builtLines.filter(l => l.newLineNumber !== null).length,
    lines: builtLines,
  };
  return { newPath, oldPath, changeType: 'modified', isBinary: false, hunks: [hunk] };
}

function makeComment(
  overrides: Partial<ReviewComment> & { filePath?: string }
): ReviewComment {
  return {
    id: 'test-id',
    filePath: 'test.ts',
    lineRange: { side: 'new', start: 10, end: 10 },
    body: 'test comment',
    category: 'issue',
    suggestion: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Build a simple file: lines 1-20 of context, comment at line 10
// ---------------------------------------------------------------------------

function buildSimpleFile(commentLineNo: number): LineSpec[] {
  const lines: LineSpec[] = [];
  for (let i = 1; i <= 20; i++) {
    lines.push({ type: 'context', content: `line ${i}`, old: i, new: i });
  }
  return lines;
}

// ---------------------------------------------------------------------------
// matchResumeComments scenarios
// ---------------------------------------------------------------------------

describe('matchResumeComments', () => {
  it('passes through file-level comments unchanged', () => {
    const comment = makeComment({ lineRange: null });
    const diffFile = makeDiffFile(buildSimpleFile(10));
    const result = matchResumeComments([comment], [diffFile]);
    expect(result[0].lineRange).toBeNull();
    expect(result[0].orphaned).toBeUndefined();
  });

  it('no edit above comment — comment stays at same position', () => {
    // Lines 1-20, context throughout, comment at line 10
    const specs = buildSimpleFile(10);
    const diffFile = makeDiffFile(specs);
    const comment = makeComment({ lineRange: { side: 'new', start: 10, end: 10 } });

    const result = matchResumeComments([comment], [diffFile]);

    expect(result[0].orphaned).toBeUndefined();
    expect(result[0].lineRange?.start).toBe(10);
  });

  it('lines inserted above — comment relocates downward', () => {
    // Original: comment at new line 10 with context lines 7-9 above and 11-13 below.
    // After 5 insertions above line 10, the same context lines are now at 12-14 and 16-18.
    // Build a diff where 5 addition lines were inserted (old lines 1-5 → new lines 1-5 are
    // additions, then old lines 1-15 map to new lines 6-20).

    const specs: LineSpec[] = [];
    // 5 added lines at the top (no old line numbers)
    for (let i = 1; i <= 5; i++) {
      specs.push({ type: 'addition', content: `new line ${i}`, old: null, new: i });
    }
    // Original lines 1-15 now appear at new lines 6-20
    for (let i = 1; i <= 15; i++) {
      specs.push({ type: 'context', content: `line ${i}`, old: i, new: i + 5 });
    }

    const diffFile = makeDiffFile(specs);
    // Comment was at new line 10 in the original (= "line 5" in the old numbering)
    // After 5 insertions above, "line 5" is now at new line 10 (old line 5, new line 10).
    // We put the comment at old side so we're testing the relocation.
    // Actually: in the original file context lines 7,8,9 above and 11,12,13 below were around
    // line 10 (new side). In the new diff, those context lines are at new 12,13,14 and 16,17,18.
    // So the comment should relocate from new:10 to new:15.
    const comment = makeComment({ lineRange: { side: 'new', start: 10, end: 10 } });

    const result = matchResumeComments([comment], [diffFile]);

    expect(result[0].orphaned).toBeUndefined();
    expect(result[0].lineRange?.start).toBe(15);
  });

  it('lines deleted above — comment relocates upward', () => {
    // Original: comment at new line 10.
    // 3 lines deleted above line 10 in the new diff means lines that were at
    // new 1-3 are now deletions (only oldLineNumber, no newLineNumber).
    // Original context lines 7,8,9 (above comment) are now at new 4,5,6.
    // Original context lines 11,12,13 (below comment) are now at new 8,9,10.
    // So the comment should relocate from new:10 to new:7.

    const specs: LineSpec[] = [];
    // 3 deleted lines (only old line numbers)
    for (let i = 1; i <= 3; i++) {
      specs.push({ type: 'deletion', content: `line ${i}`, old: i, new: null });
    }
    // Old lines 4-17 → new lines 1-14 (shift of -3)
    for (let i = 4; i <= 17; i++) {
      specs.push({ type: 'context', content: `line ${i}`, old: i, new: i - 3 });
    }

    const diffFile = makeDiffFile(specs);
    const comment = makeComment({ lineRange: { side: 'new', start: 10, end: 10 } });

    const result = matchResumeComments([comment], [diffFile]);

    expect(result[0].orphaned).toBeUndefined();
    expect(result[0].lineRange?.start).toBe(7);
  });

  it('comment line itself changed — marks orphaned', () => {
    // Build a file where the context lines around original line 10 are gone.
    // All lines are additions — no context lines at all.
    const specs: LineSpec[] = [];
    for (let i = 1; i <= 20; i++) {
      specs.push({ type: 'addition', content: `totally new line ${i}`, old: null, new: i });
    }
    const diffFile = makeDiffFile(specs);
    const comment = makeComment({ lineRange: { side: 'new', start: 10, end: 10 } });

    const result = matchResumeComments([comment], [diffFile]);

    expect(result[0].orphaned).toBe(true);
  });

  it('renamed file — matches via oldPath', () => {
    // Comment references 'old-name.ts'; DiffFile has oldPath='old-name.ts', newPath='new-name.ts'
    const specs = buildSimpleFile(5);
    const diffFile = makeDiffFile(specs, { oldPath: 'old-name.ts', newPath: 'new-name.ts' });
    const comment = makeComment({
      filePath: 'old-name.ts',
      lineRange: { side: 'new', start: 5, end: 5 },
    });

    const result = matchResumeComments([comment], [diffFile]);

    expect(result[0].orphaned).toBeUndefined();
    expect(result[0].lineRange?.start).toBe(5);
  });

  it('sparse context (all-additions) — marks orphaned', () => {
    // File with only addition lines — no context lines for fingerprinting
    const specs: LineSpec[] = [];
    for (let i = 1; i <= 10; i++) {
      specs.push({ type: 'addition', content: `added ${i}`, old: null, new: i });
    }
    const diffFile = makeDiffFile(specs);
    const comment = makeComment({ lineRange: { side: 'new', start: 5, end: 5 } });

    const result = matchResumeComments([comment], [diffFile]);

    expect(result[0].orphaned).toBe(true);
  });

  it('multi-line comment — span preserved after relocation', () => {
    // 5 insertions above, comment spans lines 10-12 (span = 2).
    // After shift of +5, should relocate to 15-17.

    const specs: LineSpec[] = [];
    for (let i = 1; i <= 5; i++) {
      specs.push({ type: 'addition', content: `new line ${i}`, old: null, new: i });
    }
    for (let i = 1; i <= 15; i++) {
      specs.push({ type: 'context', content: `line ${i}`, old: i, new: i + 5 });
    }

    const diffFile = makeDiffFile(specs);
    const comment = makeComment({ lineRange: { side: 'new', start: 10, end: 12 } });

    const result = matchResumeComments([comment], [diffFile]);

    expect(result[0].orphaned).toBeUndefined();
    expect(result[0].lineRange?.start).toBe(15);
    expect(result[0].lineRange?.end).toBe(17);
  });

  it('file not found in diff — marks orphaned', () => {
    const specs = buildSimpleFile(10);
    const diffFile = makeDiffFile(specs, { newPath: 'other.ts', oldPath: 'other.ts' });
    const comment = makeComment({
      filePath: 'nonexistent.ts',
      lineRange: { side: 'new', start: 10, end: 10 },
    });

    const result = matchResumeComments([comment], [diffFile]);

    expect(result[0].orphaned).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// normalizeResumePath scenarios
// ---------------------------------------------------------------------------

describe('normalizeResumePath', () => {
  it('passes through a bare basename unchanged', () => {
    expect(normalizeResumePath('claude-code-dx-tools.md')).toBe('claude-code-dx-tools.md');
  });

  it('extracts basename from a relative path', () => {
    expect(normalizeResumePath('src/foo/bar.ts')).toBe('bar.ts');
  });

  it('extracts basename from an absolute path', () => {
    expect(normalizeResumePath('/home/user/Downloads/review.md')).toBe('review.md');
  });
});
