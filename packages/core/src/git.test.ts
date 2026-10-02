import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { generateUntrackedDiffs, isOutputLimitError } from './git';

describe('git', () => {
  describe('generateUntrackedDiffs', () => {
    let repo: string;

    beforeEach(() => {
      repo = mkdtempSync(join(tmpdir(), 'self-review-test-git-untracked-'));
    });

    afterEach(() => {
      rmSync(repo, { recursive: true, force: true });
    });

    function untracked(files: Record<string, string | Buffer>, paths = Object.keys(files)) {
      for (const [name, content] of Object.entries(files)) {
        writeFileSync(join(repo, name), content);
      }
      return generateUntrackedDiffs(paths, repo).diff;
    }

    it('generates synthetic diff for text file', () => {
      const result = untracked({ 'new.txt': 'line1\nline2\nline3\n' });

      expect(result).toContain('diff --git a/new.txt b/new.txt');
      expect(result).toContain('new file mode 100644');
      expect(result).toContain('--- /dev/null');
      expect(result).toContain('+++ b/new.txt');
      expect(result).toContain('@@ -0,0 +1,3 @@');
      expect(result).toContain('+line1');
      expect(result).toContain('+line2');
      expect(result).toContain('+line3');
    });

    it('detects binary files and generates binary diff', () => {
      const result = untracked({ 'image.png': Buffer.from([0x00, 0x01, 0x02, 0xff]) });

      expect(result).toContain('diff --git a/image.png b/image.png');
      expect(result).toContain('new file mode 100644');
      expect(result).toContain('Binary files /dev/null and b/image.png differ');
    });

    it('handles file without trailing newline', () => {
      const result = untracked({ 'new.txt': 'line1\nline2' });

      expect(result).toContain('\\ No newline at end of file');
    });

    it('handles multiple files', () => {
      const result = untracked({ 'file1.txt': 'content1\n', 'file2.txt': 'content2\n' });

      expect(result).toContain('diff --git a/file1.txt b/file1.txt');
      expect(result).toContain('diff --git a/file2.txt b/file2.txt');
    });

    it('skips files that disappeared before they were read', () => {
      const result = untracked({ 'file1.txt': 'content1\n', 'file3.txt': 'content3\n' }, [
        'file1.txt',
        'deleted.txt',
        'file3.txt',
      ]);

      expect(result).toContain('file1.txt');
      expect(result).not.toContain('deleted.txt');
      expect(result).toContain('file3.txt');
    });

    it('handles empty file', () => {
      const result = untracked({ 'empty.txt': '' });

      expect(result).toContain('diff --git a/empty.txt b/empty.txt');
      expect(result).toContain('@@ -0,0 +1,0 @@');
    });

    it('correctly handles files with single line', () => {
      const result = untracked({ 'single.txt': 'single line\n' });

      expect(result).toContain('@@ -0,0 +1,1 @@');
      expect(result).toContain('+single line');
    });
  });

  describe('isOutputLimitError', () => {
    it('recognizes a child process stopped at its maxBuffer, and nothing else', () => {
      const limit = Object.assign(new Error('stdout maxBuffer length exceeded'), {
        code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER',
      });
      const other = Object.assign(new Error('fatal: bad revision'), { code: 128 });

      expect(isOutputLimitError(limit)).toBe(true);
      expect(isOutputLimitError(other)).toBe(false);
      expect(isOutputLimitError(undefined)).toBe(false);
    });
  });
});
