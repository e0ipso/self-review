import { describe, expect, it } from 'vitest';
import { parseDiff, parseDiffWithDiagnostics } from './diff-parser';
import { parseDiffWithDiagnosticsAsync } from './diff-parser-async';
import { createReviewSession, commitDiffData, getFileHunks } from './review-session';
import { MAX_SOURCE_FILE_LINES } from './input-budgets';
import type { SourceBudgets } from './input-budgets';

function patch(name: string, body = '+\n+\n', count = 2): string {
  return `diff --git a/${name} b/${name}\nnew file mode 100644\n@@ -0,0 +1,${count} @@\n${body}`;
}

async function parse(raw: string, budgets: Partial<SourceBudgets>) {
  const sync = parseDiffWithDiagnostics(raw, { budgets });
  expect(await parseDiffWithDiagnosticsAsync(raw, { budgets })).toEqual(sync);
  if (
    sync.files.some(file => file.omittedReason) ||
    sync.diagnostics.some(message => message.includes('Parsing stopped'))
  ) {
    expect(() => parseDiff(raw, { budgets })).toThrow(RangeError);
  } else {
    expect(parseDiff(raw, { budgets })).toEqual(sync.files);
  }
  return sync;
}

describe('finite patch representations', () => {
  it('accepts the exact per-file boundary and refuses one over without a partial hunk', async () => {
    const result = await parse(patch('edge') + patch('over', '+\n+\n+\n', 3), {
      maxFileLines: 2,
    });
    expect(result.files[0].hunks[0].lines).toHaveLength(2);
    expect(result.files[1]).toMatchObject({ newPath: 'over', isBinary: false, hunks: [] });
    expect(result.files[1].omittedReason).toContain('2-line per-file');
    expect(result.diagnostics.join(' ')).toContain('over');
  });

  it('counts additions and deletions as separate objects even when each header side fits', async () => {
    const raw = 'diff --git a/f b/f\n@@ -1,2 +1,2 @@\n-a\n-b\n+c\n+d\n';
    expect((await parse(raw, { maxFileLines: 4 })).files[0].hunks[0].lines).toHaveLength(4);
    const over = await parse(raw, { maxFileLines: 3 });
    expect(over.files[0].hunks).toEqual([]);
    expect(over.files[0].omittedReason).toContain('3-line per-file');
  });

  it('limits total lines across tiny files and reports where aggregate parsing stopped', async () => {
    const result = await parse(patch('a') + patch('b') + patch('never'), { maxTotalLines: 3 });
    expect(result.files.map(f => f.newPath)).toEqual(['a', 'b']);
    expect(result.files[0].hunks[0].lines).toHaveLength(2);
    expect(result.files[1].hunks).toEqual([]);
    expect(result.files[1].omittedReason).toContain('3-line total');
    expect(result.diagnostics.join(' ')).toContain('remaining input was not loaded');
  });

  it('bounds repeated empty hunks, including the hunk being built', async () => {
    const raw = patch('f', '@@ -0,0 +1,0 @@\n'.repeat(4), 0);
    const exact = await parse(raw, { maxDiffHunks: 5 });
    expect(exact.files[0].hunks).toHaveLength(5);
    const over = await parse(raw, { maxDiffHunks: 4 });
    expect(over.files[0].hunks).toEqual([]);
    expect(over.files[0].omittedReason).toContain('4-hunk total');
  });

  it('bounds all file-header attempts, including metadata that produces no file', async () => {
    const raw = 'diff --git a/empty b/empty\n'.repeat(10) + patch('hidden');
    const result = await parse(raw, { maxDiffFiles: 3 });
    expect(result.files).toEqual([]);
    expect(result.diagnostics.join(' ')).toContain('3-file');
    expect((await parse(patch('a') + patch('b'), { maxDiffFiles: 2 })).files).toHaveLength(2);
  });

  it.each([
    patch('f', '@@ broken\n'.repeat(20), 0),
    patch('f', 'malformed\n'.repeat(20), 1),
    'diff --cc conflict\n'.repeat(20),
    patch('f', '+extra\n'.repeat(20), 0),
    patch('f', '+short\n', 2),
  ])('bounds malformed diagnostics, including the final short-hunk flush %#', async raw => {
    const result = await parse(raw, { maxDiagnostics: 0 });
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toContain('Parsing stopped');
    expect(result.files.every(f => f.hunks.length === 0)).toBe(true);
  });

  it('allows exactly the diagnostic limit and reserves one aggregate stop message', async () => {
    const raw = patch('f', 'bad\nbad\n', 0);
    expect((await parse(raw, { maxDiagnostics: 2 })).diagnostics).toHaveLength(2);
    const over = await parse(raw, { maxDiagnostics: 1 });
    expect(over.diagnostics).toHaveLength(2);
    expect(over.files[0].hunks).toEqual([]);
  });

  it.each(['99999999999999999999999', String(Number.MAX_SAFE_INTEGER)])(
    'refuses unsafe hunk coordinates %s',
    async coordinate => {
      const result = await parse(`diff --git a/f b/f\n@@ -${coordinate},2 +1,2 @@\n-x\n+y\n`, {});
      expect(result.files[0].hunks).toEqual([]);
      expect(result.files[0].omittedReason).toContain('safe-integer');
    }
  );

  it('never lets lazy delivery reconstruct refused content', async () => {
    const result = await parse(patch('f', '+\n'.repeat(20), 20), { maxFileLines: 2 });
    const session = createReviewSession();
    commitDiffData(
      session,
      { ...result, source: { type: 'directory', sourcePath: '/review' } },
      null
    );
    expect(getFileHunks(session, 'f')).toEqual([]);
    expect(getFileHunks(session, 'f')).toEqual([]);
    expect(session.diffData!.files[0].omittedReason).toContain('per-file');
  });

  it('bounds a dense newline patch with defaults, regardless of transport thresholds', () => {
    const result = parseDiffWithDiagnostics(patch('f', '', MAX_SOURCE_FILE_LINES + 1));
    expect(result.files[0].hunks).toEqual([]);
    expect(result.files[0].omittedReason).toContain('per-file');
  });
});

describe('diagnostic string growth', () => {
  it('refuses a diagnostic containing an enormous header before retaining copies of it', async () => {
    const raw = patch('f', '@@ -0,0 +1,0 @@' + 'x'.repeat(9000) + '\n+extra\n'.repeat(10), 0);
    const result = await parse(raw, {});
    expect(result.files[0].hunks).toEqual([]);
    expect(result.files[0].omittedReason).toContain('character diagnostic');
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].length).toBeLessThan(200);
  });
});

describe('omitted file identity', () => {
  it('never reads refused content as replacement file metadata', async () => {
    const result = await parse(patch('original', '+++ b/spoofed\n--- a/spoofed\n+last\n', 3), {
      maxFileLines: 2,
    });
    expect(result.files[0]).toMatchObject({
      oldPath: '',
      newPath: 'original',
      changeType: 'added',
      hunks: [],
    });
    expect(result.files[0].omittedReason).toContain('per-file');
  });
});

describe('legacy parser safety refusal', () => {
  it('throws rather than silently returning an incomplete list without diagnostics', () => {
    expect(() => parseDiff(patch('a') + patch('b'), { budgets: { maxDiffFiles: 1 } })).toThrow(
      '1-file'
    );
    expect(() => parseDiff(patch('f'), { budgets: { maxFileLines: 1 } })).toThrow(
      '1-line per-file'
    );
  });
});
