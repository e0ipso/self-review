import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  runGitDiff,
  getRepoRoot,
  validateGitAvailable,
  generateUntrackedDiffs,
} from './git';
import * as child_process from 'child_process';
import * as fs from 'fs';

vi.mock('child_process');
vi.mock('fs');

describe('git', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('runGitDiff', () => {
    it('executes git diff with provided arguments', () => {
      vi.mocked(child_process.execSync).mockReturnValue('diff output');

      const result = runGitDiff(['--staged']);

      expect(child_process.execSync).toHaveBeenCalledWith(
        'git diff --staged',
        expect.objectContaining({
          encoding: 'utf-8',
          maxBuffer: 50 * 1024 * 1024,
        })
      );
      expect(result).toBe('diff output');
    });

    it('checks git availability before running diff', () => {
      vi.mocked(child_process.execSync)
        .mockImplementationOnce(() => '') // git --version
        .mockImplementationOnce(() => '') // git rev-parse
        .mockImplementationOnce(() => 'diff output'); // git diff

      runGitDiff(['--staged']);

      expect(child_process.execSync).toHaveBeenNthCalledWith(
        1,
        'git --version',
        expect.objectContaining({ stdio: 'ignore' })
      );
    });

    it('checks repository before running diff', () => {
      vi.mocked(child_process.execSync)
        .mockImplementationOnce(() => '') // git --version
        .mockImplementationOnce(() => '') // git rev-parse
        .mockImplementationOnce(() => 'diff output'); // git diff

      runGitDiff(['--staged']);

      expect(child_process.execSync).toHaveBeenNthCalledWith(
        2,
        'git rev-parse --git-dir',
        expect.objectContaining({ stdio: 'ignore' })
      );
    });

    it('exits with error when git is not installed', () => {
      vi.mocked(child_process.execSync).mockImplementation(() => {
        throw new Error('command not found');
      });

      runGitDiff(['--staged']);

      expect(console.error).toHaveBeenCalledWith(
        'Error: git is not installed or not in PATH'
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('exits with error when not in git repository', () => {
      vi.mocked(child_process.execSync)
        .mockImplementationOnce(() => '') // git --version succeeds
        .mockImplementationOnce(() => {
          throw new Error('not a git repository');
        });

      runGitDiff(['--staged']);

      expect(console.error).toHaveBeenCalledWith(
        'Error: not a git repository (or any parent up to mount point)'
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('handles multiple git diff arguments', () => {
      vi.mocked(child_process.execSync).mockReturnValue('diff output');

      runGitDiff(['--staged', '--ignore-space-change', '--', 'src/']);

      expect(child_process.execSync).toHaveBeenCalledWith(
        'git diff --staged --ignore-space-change -- src/',
        expect.any(Object)
      );
    });

    it('exits with error on git diff failure', () => {
      vi.mocked(child_process.execSync)
        .mockImplementationOnce(() => '') // git --version
        .mockImplementationOnce(() => '') // git rev-parse
        .mockImplementationOnce(() => {
          throw new Error('invalid revision');
        });

      runGitDiff(['invalid..revision']);

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error running git diff')
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('getRepoRoot', () => {
    it('returns repository root path', () => {
      vi.mocked(child_process.execSync).mockReturnValue('/repo/path\n');

      const result = getRepoRoot();

      expect(child_process.execSync).toHaveBeenCalledWith(
        'git rev-parse --show-toplevel',
        expect.objectContaining({ encoding: 'utf-8' })
      );
      expect(result).toBe('/repo/path');
    });

    it('trims whitespace from git output', () => {
      vi.mocked(child_process.execSync).mockReturnValue('  /repo/path  \n  ');

      const result = getRepoRoot();

      expect(result).toBe('/repo/path');
    });

    it('exits with error when command fails', () => {
      vi.mocked(child_process.execSync).mockImplementation(() => {
        throw new Error('not a git repository');
      });

      getRepoRoot();

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error getting repository root')
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('validateGitAvailable', () => {
    it('validates git is available and in a repository', () => {
      vi.mocked(child_process.execSync)
        .mockImplementationOnce(() => '') // git --version
        .mockImplementationOnce(() => ''); // git rev-parse

      expect(() => validateGitAvailable()).not.toThrow();
    });

    it('exits when git is not available', () => {
      vi.mocked(child_process.execSync).mockImplementation(() => {
        throw new Error('command not found');
      });

      validateGitAvailable();

      expect(console.error).toHaveBeenCalledWith(
        'Error: git is not installed or not in PATH'
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('exits when not in git repository', () => {
      vi.mocked(child_process.execSync)
        .mockImplementationOnce(() => '') // git --version succeeds
        .mockImplementationOnce(() => {
          throw new Error('not a git repository');
        });

      validateGitAvailable();

      expect(console.error).toHaveBeenCalledWith(
        'Error: not a git repository (or any parent up to mount point)'
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });
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

      const result = generateUntrackedDiffs(
        ['file1.txt', 'file2.txt'],
        '/repo'
      );

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

      const result = generateUntrackedDiffs(
        ['file1.txt', 'deleted.txt', 'file3.txt'],
        '/repo'
      );

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
