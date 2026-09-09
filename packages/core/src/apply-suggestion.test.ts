// apply-suggestion.test.ts
// The apply engine writes real bytes, so these tests use a real temporary
// destination directory rather than a mocked `fs`: the assertions that matter
// most ("nothing was written", "the trailing newline survived") are about the
// file on disk, and a mock cannot witness them.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { applySuggestion } from './apply-suggestion';
import type { LineRange, Suggestion } from './types';

const FILE = 'src/app.ts';
const ORIGINAL = ['const a = 1;', 'const b = 2;', 'const c = 3;'];

let root: string;

/** Write `content` verbatim at `relative` under the destination root. */
function seed(relative: string, content: string): string {
  const absolute = join(root, relative);
  mkdirSync(join(absolute, '..'), { recursive: true });
  writeFileSync(absolute, content, 'utf8');
  return absolute;
}

function read(relative: string): string {
  return readFileSync(join(root, relative), 'utf8');
}

function request(overrides: {
  filePath?: string;
  destinationRoot?: string;
  lineRange?: LineRange | null;
  suggestion?: Suggestion;
}) {
  return {
    destinationRoot: overrides.destinationRoot ?? root,
    filePath: overrides.filePath ?? FILE,
    lineRange:
      overrides.lineRange === undefined
        ? { side: 'new' as const, start: 2, end: 2 }
        : overrides.lineRange,
    suggestion: overrides.suggestion ?? {
      originalCode: 'const b = 2;',
      proposedCode: 'const b = 22;',
    },
  };
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'self-review-apply-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('applySuggestion', () => {
  describe('applied', () => {
    it('replaces only the anchored line and keeps the trailing newline', () => {
      seed(FILE, `${ORIGINAL.join('\n')}\n`);

      const result = applySuggestion(request({}));

      expect(result).toEqual({
        status: 'applied',
        filePath: FILE,
        absolutePath: join(root, FILE),
        replacedLines: 1,
      });
      expect(read(FILE)).toBe('const a = 1;\nconst b = 22;\nconst c = 3;\n');
    });

    it('leaves a file that ended without a newline still ending without one', () => {
      seed(FILE, ORIGINAL.join('\n'));

      const result = applySuggestion(
        request({
          lineRange: { side: 'new', start: 3, end: 3 },
          suggestion: { originalCode: 'const c = 3;', proposedCode: 'const c = 33;' },
        })
      );

      expect(result.status).toBe('applied');
      expect(read(FILE)).toBe('const a = 1;\nconst b = 2;\nconst c = 33;');
    });

    it('replaces a multi-line anchor with a proposal of a different length', () => {
      seed(FILE, `${ORIGINAL.join('\n')}\n`);

      const result = applySuggestion(
        request({
          lineRange: { side: 'new', start: 1, end: 2 },
          suggestion: {
            originalCode: 'const a = 1;\nconst b = 2;',
            proposedCode: 'const [a, b] = [1, 2];',
          },
        })
      );

      expect(result).toMatchObject({ status: 'applied', replacedLines: 2 });
      expect(read(FILE)).toBe('const [a, b] = [1, 2];\nconst c = 3;\n');
    });

    it('keeps CRLF terminators when the whole anchored region is CRLF', () => {
      seed(FILE, 'const a = 1;\r\nconst b = 2;\r\nconst c = 3;\r\n');

      const result = applySuggestion(
        request({
          // The diff parser hands the `\r` through in DiffLine.content, so the
          // recorded original code carries it too.
          suggestion: { originalCode: 'const b = 2;\r', proposedCode: 'const b = 22;' },
        })
      );

      expect(result.status).toBe('applied');
      expect(read(FILE)).toBe('const a = 1;\r\nconst b = 22;\r\nconst c = 3;\r\n');
    });
  });

  describe('refused', () => {
    it('refuses a file-level suggestion and writes nothing', () => {
      const before = `${ORIGINAL.join('\n')}\n`;
      seed(FILE, before);

      const result = applySuggestion(request({ lineRange: null }));

      expect(result).toMatchObject({ status: 'refused', reason: 'no-anchor', filePath: FILE });
      expect(read(FILE)).toBe(before);
    });

    it('refuses an old-side anchor, which names lines the working file does not have', () => {
      const before = `${ORIGINAL.join('\n')}\n`;
      seed(FILE, before);

      const result = applySuggestion(request({ lineRange: { side: 'old', start: 2, end: 2 } }));

      expect(result).toMatchObject({ status: 'refused', reason: 'old-side-anchor' });
      expect(read(FILE)).toBe(before);
    });

    it('refuses when the on-disk lines drifted from the recorded original code', () => {
      const before = 'const a = 1;\nconst b = 999;\nconst c = 3;\n';
      seed(FILE, before);

      const result = applySuggestion(request({}));

      expect(result).toMatchObject({ status: 'refused', reason: 'context-mismatch' });
      expect(read(FILE)).toBe(before);
    });

    it('refuses on whitespace-only drift: the comparison is byte for byte', () => {
      const before = 'const a = 1;\n  const b = 2;\nconst c = 3;\n';
      seed(FILE, before);

      const result = applySuggestion(request({}));

      expect(result).toMatchObject({ status: 'refused', reason: 'context-mismatch' });
      expect(read(FILE)).toBe(before);
    });

    it('refuses when the file is not in the destination directory', () => {
      const result = applySuggestion(request({ filePath: 'src/gone.ts' }));

      expect(result).toMatchObject({ status: 'refused', reason: 'file-missing' });
    });

    it('refuses a relative destination root instead of resolving it against the cwd', () => {
      const result = applySuggestion(request({ destinationRoot: 'relative/root' }));

      expect(result).toMatchObject({ status: 'refused', reason: 'destination-not-absolute' });
    });

    it('refuses a path that escapes the destination root', () => {
      const outside = join(root, 'outside.txt');
      writeFileSync(outside, 'untouched\n', 'utf8');
      const inner = join(root, 'repo');
      mkdirSync(inner, { recursive: true });

      const result = applySuggestion(
        request({
          destinationRoot: inner,
          filePath: '../outside.txt',
          lineRange: { side: 'new', start: 1, end: 1 },
          suggestion: { originalCode: 'untouched', proposedCode: 'clobbered' },
        })
      );

      expect(result).toMatchObject({ status: 'refused', reason: 'path-escapes-destination' });
      expect(readFileSync(outside, 'utf8')).toBe('untouched\n');
    });

    it('refuses an absolute file path', () => {
      const result = applySuggestion(request({ filePath: join(root, FILE) }));

      expect(result).toMatchObject({ status: 'refused', reason: 'path-escapes-destination' });
    });

    it('refuses an anchor past the end of the file', () => {
      const before = `${ORIGINAL.join('\n')}\n`;
      seed(FILE, before);

      const result = applySuggestion(
        request({
          lineRange: { side: 'new', start: 9, end: 9 },
          suggestion: { originalCode: 'const b = 2;', proposedCode: 'const b = 22;' },
        })
      );

      expect(result).toMatchObject({ status: 'refused', reason: 'anchor-out-of-range' });
      expect(read(FILE)).toBe(before);
    });

    it('refuses a file that is not valid UTF-8 rather than rewriting it lossily', () => {
      const absolute = join(root, 'blob.bin');
      writeFileSync(absolute, Buffer.from([0xff, 0xfe, 0x0a]));

      const result = applySuggestion(
        request({
          filePath: 'blob.bin',
          lineRange: { side: 'new', start: 1, end: 1 },
          suggestion: { originalCode: 'anything', proposedCode: 'else' },
        })
      );

      expect(result).toMatchObject({ status: 'refused', reason: 'file-not-utf8' });
      expect(readFileSync(absolute)).toEqual(Buffer.from([0xff, 0xfe, 0x0a]));
    });

    it('refuses a directory rather than treating it as a file', () => {
      mkdirSync(join(root, 'src'), { recursive: true });

      const result = applySuggestion(
        request({
          filePath: 'src',
          lineRange: { side: 'new', start: 1, end: 1 },
          suggestion: { originalCode: '', proposedCode: 'x' },
        })
      );

      expect(result).toMatchObject({ status: 'refused', reason: 'file-unreadable' });
    });

    it('names no file contents in the refusal detail', () => {
      seed(FILE, 'const a = 1;\nsecret = "hunter2";\nconst c = 3;\n');

      const result = applySuggestion(request({}));

      expect(result.status).toBe('refused');
      if (result.status === 'refused') {
        expect(result.detail).not.toContain('hunter2');
      }
    });
  });
});
