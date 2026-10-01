import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateUntrackedDiffs } from './git';
import * as fs from 'fs';

vi.mock('fs');

describe('git', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('generateUntrackedDiffs', () => {
    it('generates synthetic diff for text file', () => {
      const fileContent = 'line1\nline2\nline3\n';
      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from(fileContent));

      const result = generateUntrackedDiffs(['new.txt'], '/repo');

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
      const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0xff]);
      vi.mocked(fs.readFileSync).mockReturnValue(binaryContent);

      const result = generateUntrackedDiffs(['image.png'], '/repo');

      expect(result).toContain('diff --git a/image.png b/image.png');
      expect(result).toContain('new file mode 100644');
      expect(result).toContain('Binary files /dev/null and b/image.png differ');
    });

    it('handles file without trailing newline', () => {
      const fileContent = 'line1\nline2';
      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from(fileContent));

      const result = generateUntrackedDiffs(['new.txt'], '/repo');

      expect(result).toContain('\\ No newline at end of file');
    });

    it('handles multiple files', () => {
      vi.mocked(fs.readFileSync)
        .mockReturnValueOnce(Buffer.from('content1\n'))
        .mockReturnValueOnce(Buffer.from('content2\n'));

      const result = generateUntrackedDiffs(['file1.txt', 'file2.txt'], '/repo');

      expect(result).toContain('diff --git a/file1.txt b/file1.txt');
      expect(result).toContain('diff --git a/file2.txt b/file2.txt');
    });

    it('skips files that fail to read', () => {
      vi.mocked(fs.readFileSync)
        .mockImplementationOnce(() => Buffer.from('content1\n'))
        .mockImplementationOnce(() => {
          throw new Error('ENOENT');
        })
        .mockImplementationOnce(() => Buffer.from('content3\n'));

      const result = generateUntrackedDiffs(['file1.txt', 'deleted.txt', 'file3.txt'], '/repo');

      expect(result).toContain('file1.txt');
      expect(result).not.toContain('deleted.txt');
      expect(result).toContain('file3.txt');
    });

    it('handles empty file', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from(''));

      const result = generateUntrackedDiffs(['empty.txt'], '/repo');

      expect(result).toContain('diff --git a/empty.txt b/empty.txt');
      expect(result).toContain('@@ -0,0 +1,0 @@');
    });

    it('correctly handles files with single line', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('single line\n'));

      const result = generateUntrackedDiffs(['single.txt'], '/repo');

      expect(result).toContain('@@ -0,0 +1,1 @@');
      expect(result).toContain('+single line');
    });
  });
});
