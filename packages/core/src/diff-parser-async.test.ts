import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { parseDiff, parseDiffWithDiagnostics } from './diff-parser';
import { parseDiffWithDiagnosticsAsync } from './diff-parser-async';
import { CommandCancelledError } from './forge-provider';
import { gitSync } from './test-support/git-env';

function addition(content: string, count: number): string {
  return `diff --git a/file b/file\nnew file mode 100644\n--- /dev/null\n+++ b/file\n@@ -0,0 +1,${count} @@\n${content}`;
}

const cases = [
  '',
  ' \n\t\r\n',
  addition('+one\r\n+\ufefftwo\n\\ No newline at end of file', 2),
  addition('+short\n', 2),
  addition('+first\n+extra\nraw\n@@ broken\n', 1),
  'diff --cc conflict\n@@@ -1,1 -1,1 +1,1 @@@\n++merge\n',
  'diff --git a/a b/a\nnew mode 100755\n',
  'diff --git a/a b/b\nrename from a\nrename to b\n',
  'diff --git a/a b/b\ncopy from a\ncopy to b\n',
  'diff --git a/bin b/bin\nGIT binary patch\nliteral 1\nabc\n',
  'diff --git "a/caf\\303\\251" "b/caf\\303\\251"\nBinary files a and b differ',
  addition('+\n', 1),
  addition('', 0),
];

let root: string | undefined;
afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true });
  root = undefined;
});

describe('cooperative patch parsing', () => {
  it.each(cases)('matches synchronous files and diagnostics for input %#', async patch => {
    const expected = parseDiffWithDiagnostics(patch);
    expect(await parseDiffWithDiagnosticsAsync(patch)).toEqual(expected);
    expect(parseDiff(patch)).toEqual(expected.files);
  });

  it.each([65535, 65536, 65537])(
    'preserves line boundaries and Unicode at character %i',
    async boundary => {
      const prefix = addition('', 2);
      const first = 'x'.repeat(boundary - prefix.length - 1);
      for (const content of [`${first}\n+last`, `${first}😀\r\n+last`]) {
        const patch = prefix + '+' + content;
        const result = await parseDiffWithDiagnosticsAsync(patch);
        expect(result.diagnostics).toEqual([]);
        expect(result.files[0].hunks[0].lines.map(line => line.content)).toEqual(
          content.split('\n+')
        );
      }
    }
  );

  it('matches real git patches with modes, renames, binary data and unusual paths', async () => {
    root = mkdtempSync(join(tmpdir(), 'sr-parser-'));
    gitSync(['init', '-q', root]);
    writeFileSync(join(root, 'original'), 'same\r\n');
    writeFileSync(join(root, 'deleted'), 'removed\n');
    gitSync(['-C', root, 'add', '--', 'original', 'deleted']);
    gitSync([
      '-C',
      root,
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.com',
      'commit',
      '-qm',
      'base',
    ]);
    gitSync(['-C', root, 'mv', 'original', 'renamed']);
    gitSync(['-C', root, 'rm', 'deleted']);
    writeFileSync(join(root, 'café\nfile'), '\ufefffirst\r\nlast');
    writeFileSync(join(root, 'binary'), Buffer.from([0, 1, 255]));
    writeFileSync(join(root, 'executable'), '#!/bin/sh\n', { mode: 0o755 });
    gitSync(['-C', root, 'add', '--all']);
    const patch = gitSync([
      '-C',
      root,
      '-c',
      'diff.mnemonicPrefix=false',
      'diff',
      '--cached',
      '--binary',
      '--find-renames',
    ]);
    const expected = parseDiffWithDiagnostics(patch);
    expect(expected.files.some(file => file.changeType === 'renamed')).toBe(true);
    expect(expected.files.some(file => file.isBinary)).toBe(true);
    expect(await parseDiffWithDiagnosticsAsync(patch)).toEqual(expected);
  });

  it.each(['many lines', 'one long line'])(
    'lets scheduled work progress before finishing a single file with %s',
    async shape => {
      const patch =
        shape === 'many lines'
          ? addition('+line\n'.repeat(20_000), 20_000)
          : addition('+' + 'x'.repeat(8 * 1024 * 1024), 1);
      let pending = true;
      let turns = 0;
      let timerRanWhilePending = false;
      const timer = setTimeout(() => {
        timerRanWhilePending = pending;
      }, 0);
      let immediate: NodeJS.Immediate;
      const tick = () => {
        if (pending) {
          turns++;
          immediate = setImmediate(tick);
        }
      };
      immediate = setImmediate(tick);
      try {
        const result = await parseDiffWithDiagnosticsAsync(patch);
        expect(result.files).toHaveLength(1);
        expect(result.diagnostics).toEqual([]);
        expect(turns).toBeGreaterThan(3);
        expect(timerRanWhilePending).toBe(true);
      } finally {
        pending = false;
        clearImmediate(immediate);
        clearTimeout(timer);
      }
    }
  );

  it.each([undefined, new Error('session replaced')])(
    'normalizes cancellation during a single-file parse, reason %s',
    async reason => {
      const controller = new AbortController();
      const patch = addition('+line\n'.repeat(20_000), 20_000);
      // Abort after parsing has yielded more than once, rather than only at admission.
      setImmediate(() => setImmediate(() => controller.abort(reason)));
      await expect(
        parseDiffWithDiagnosticsAsync(patch, { signal: controller.signal })
      ).rejects.toMatchObject({ name: 'CommandCancelledError', reason: 'aborted' });
    }
  );

  it('rejects pre-aborted parsing even for empty input', async () => {
    await expect(
      parseDiffWithDiagnosticsAsync('', { signal: AbortSignal.abort() })
    ).rejects.toBeInstanceOf(CommandCancelledError);
  });
});
