import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parseCliArgs, checkEarlyExit, normalizeGitDiffArgs } from './cli';

describe('cli', () => {
  const originalArgv = process.argv;
  const originalDefaultApp = (process as any).defaultApp;

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
  });

  afterEach(() => {
    process.argv = originalArgv;
    (process as any).defaultApp = originalDefaultApp;
    vi.clearAllMocks();
  });

  describe('parseCliArgs', () => {
    it('returns empty gitDiffArgs when no arguments provided (packaged mode)', () => {
      (process as any).defaultApp = false;
      process.argv = ['/path/to/app'];

      const args = parseCliArgs();

      expect(args.gitDiffArgs).toEqual([]);
      expect(args.resumeFrom).toBeNull();
    });

    it('parses --resume-from flag', () => {
      (process as any).defaultApp = false;
      process.argv = ['/path/to/app', '--resume-from', 'review.xml'];

      const args = parseCliArgs();

      expect(args.resumeFrom).toBe('review.xml');
      expect(args.gitDiffArgs).toEqual([]);
    });

    it('parses --resume-from with additional git args', () => {
      (process as any).defaultApp = false;
      process.argv = [
        '/path/to/app',
        '--resume-from',
        'review.xml',
        '--staged',
      ];

      const args = parseCliArgs();

      expect(args.resumeFrom).toBe('review.xml');
      expect(args.gitDiffArgs).toEqual(['--staged']);
    });

    it('passes through git diff arguments', () => {
      (process as any).defaultApp = false;
      process.argv = ['/path/to/app', 'main..feature'];

      const args = parseCliArgs();

      expect(args.gitDiffArgs).toEqual(['main..feature']);
      expect(args.resumeFrom).toBeNull();
    });

    it('passes through multiple git diff arguments', () => {
      (process as any).defaultApp = false;
      process.argv = [
        '/path/to/app',
        '--staged',
        '--ignore-space-change',
        '--',
        'src/',
      ];

      const args = parseCliArgs();

      expect(args.gitDiffArgs).toEqual([
        '--staged',
        '--ignore-space-change',
        '--',
        'src/',
      ]);
      expect(args.resumeFrom).toBeNull();
    });

    it('handles dev mode with electron binary', () => {
      (process as any).defaultApp = true;
      process.argv = [
        '/path/to/electron',
        '--inspect',
        '/path/to/main.js',
        '--staged',
      ];

      const args = parseCliArgs();

      expect(args.gitDiffArgs).toEqual(['--staged']);
    });

    it('handles dev mode with multiple chromium flags', () => {
      (process as any).defaultApp = true;
      process.argv = [
        '/path/to/electron',
        '--inspect',
        '--remote-debugging-port=9222',
        '/path/to/main.js',
        'main..feature',
        '--staged',
      ];

      const args = parseCliArgs();

      expect(args.gitDiffArgs).toEqual(['main..feature', '--staged']);
    });

    it('exits with error when --resume-from has no argument', () => {
      (process as any).defaultApp = false;
      process.argv = ['/path/to/app', '--resume-from'];

      parseCliArgs();

      expect(console.error).toHaveBeenCalledWith(
        'Error: --resume-from requires a file path argument'
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('treats --resume-from value correctly when followed by git args', () => {
      (process as any).defaultApp = false;
      process.argv = ['/path/to/app', '--resume-from', 'review.xml', 'HEAD~3'];

      const args = parseCliArgs();

      expect(args.resumeFrom).toBe('review.xml');
      expect(args.gitDiffArgs).toEqual(['HEAD~3']);
    });

    it('handles git args before --resume-from', () => {
      (process as any).defaultApp = false;
      process.argv = [
        '/path/to/app',
        '--staged',
        '--resume-from',
        'review.xml',
      ];

      const args = parseCliArgs();

      expect(args.resumeFrom).toBe('review.xml');
      expect(args.gitDiffArgs).toEqual(['--staged']);
    });
  });

  describe('parseCliArgs subcommand routing', () => {
    it('recognizes fetch-comments with a URL', () => {
      (process as any).defaultApp = false;
      process.argv = [
        '/path/to/app',
        'fetch-comments',
        'https://github.com/owner/repo/pull/42',
      ];

      const args = parseCliArgs();

      expect(args.subcommand).toBe('fetch-comments');
      expect(args.remoteUrl).toBe('https://github.com/owner/repo/pull/42');
      expect(args.allThreads).toBe(false);
      expect(args.gitDiffArgs).toEqual([]);
      expect(args.resumeFrom).toBeNull();
    });

    it('exits with error when fetch-comments has no URL', () => {
      (process as any).defaultApp = false;
      process.argv = ['/path/to/app', 'fetch-comments'];

      parseCliArgs();

      expect(console.error).toHaveBeenCalledWith(
        'Error: fetch-comments requires a pull/merge request URL argument'
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('parses --all-threads for fetch-comments', () => {
      (process as any).defaultApp = false;
      process.argv = [
        '/path/to/app',
        'fetch-comments',
        '--all-threads',
        'https://gitlab.com/group/project/-/merge_requests/7',
      ];

      const args = parseCliArgs();

      expect(args.subcommand).toBe('fetch-comments');
      expect(args.remoteUrl).toBe(
        'https://gitlab.com/group/project/-/merge_requests/7'
      );
      expect(args.allThreads).toBe(true);
    });

    it('recognizes a bare GitHub PR URL as remote GUI mode', () => {
      (process as any).defaultApp = false;
      process.argv = ['/path/to/app', 'https://github.com/owner/repo/pull/42'];

      const args = parseCliArgs();

      expect(args.subcommand).toBeNull();
      expect(args.remoteUrl).toBe('https://github.com/owner/repo/pull/42');
      expect(args.gitDiffArgs).toEqual([]);
    });

    it('recognizes a self-hosted GitLab MR URL as remote GUI mode', () => {
      (process as any).defaultApp = false;
      process.argv = [
        '/path/to/app',
        'https://git.drupalcode.org/project/drupal/-/merge_requests/123',
      ];

      const args = parseCliArgs();

      expect(args.subcommand).toBeNull();
      expect(args.remoteUrl).toBe(
        'https://git.drupalcode.org/project/drupal/-/merge_requests/123'
      );
      expect(args.gitDiffArgs).toEqual([]);
    });

    it('combines a bare forge URL with --resume-from', () => {
      (process as any).defaultApp = false;
      process.argv = [
        '/path/to/app',
        '--resume-from',
        'review.xml',
        'https://github.com/owner/repo/pull/42',
      ];

      const args = parseCliArgs();

      expect(args.resumeFrom).toBe('review.xml');
      expect(args.remoteUrl).toBe('https://github.com/owner/repo/pull/42');
      expect(args.gitDiffArgs).toEqual([]);
    });

    it('keeps non-URL positionals as git pass-through with null remote fields', () => {
      (process as any).defaultApp = false;
      process.argv = ['/path/to/app', 'main..feature'];

      const args = parseCliArgs();

      expect(args.subcommand).toBeNull();
      expect(args.remoteUrl).toBeNull();
      expect(args.gitDiffArgs).toEqual(['main..feature']);
    });

    it('does not treat a URL after a non-URL first positional as remote', () => {
      (process as any).defaultApp = false;
      process.argv = [
        '/path/to/app',
        'main..feature',
        'https://github.com/owner/repo/pull/42',
      ];

      const args = parseCliArgs();

      expect(args.remoteUrl).toBeNull();
      expect(args.gitDiffArgs).toEqual([
        'main..feature',
        'https://github.com/owner/repo/pull/42',
      ]);
    });

    it('does not detect URLs after the -- separator', () => {
      (process as any).defaultApp = false;
      process.argv = [
        '/path/to/app',
        '--',
        'https://github.com/owner/repo/pull/42',
      ];

      const args = parseCliArgs();

      expect(args.remoteUrl).toBeNull();
      expect(args.gitDiffArgs).toEqual([
        '--',
        'https://github.com/owner/repo/pull/42',
      ]);
    });

    it('keeps subcommand-like unknown tokens as git pass-through', () => {
      (process as any).defaultApp = false;
      process.argv = ['/path/to/app', 'fetch-commentz'];

      const args = parseCliArgs();

      expect(args.subcommand).toBeNull();
      expect(args.remoteUrl).toBeNull();
      expect(args.gitDiffArgs).toEqual(['fetch-commentz']);
    });
  });

  describe('normalizeGitDiffArgs', () => {
    it('returns unchanged when no positional path args', () => {
      const args = ['--staged', '--ignore-space-change'];
      expect(normalizeGitDiffArgs(args, '/nonexistent')).toEqual(args);
    });

    it('returns unchanged for revision-style args', () => {
      const args = ['main..feature'];
      // 'main..feature' won't exist on the filesystem
      expect(normalizeGitDiffArgs(args, '/nonexistent')).toEqual(args);
    });

    it('inserts -- before an existing path arg', () => {
      // Use a directory that definitely exists
      const args = ['src'];
      const result = normalizeGitDiffArgs(args, process.cwd());
      expect(result).toEqual(['--', 'src']);
    });

    it('preserves flags before the path arg', () => {
      const args = ['--staged', 'src'];
      const result = normalizeGitDiffArgs(args, process.cwd());
      expect(result).toEqual(['--staged', '--', 'src']);
    });

    it('returns unchanged when -- is already present (idempotent)', () => {
      const args = ['--staged', '--', 'src'];
      expect(normalizeGitDiffArgs(args, process.cwd())).toEqual(args);
    });

    it('returns unchanged for empty array', () => {
      expect(normalizeGitDiffArgs([], process.cwd())).toEqual([]);
    });
  });

  describe('checkEarlyExit', () => {
    it('detects --help flag', () => {
      (process as any).defaultApp = false;
      process.argv = ['/path/to/app', '--help'];

      const result = checkEarlyExit();

      expect(result.shouldExit).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Usage: self-review')
      );
    });

    it('detects -h flag', () => {
      (process as any).defaultApp = false;
      process.argv = ['/path/to/app', '-h'];

      const result = checkEarlyExit();

      expect(result.shouldExit).toBe(true);
      expect(result.exitCode).toBe(0);
    });

    it('detects --version flag', () => {
      (process as any).defaultApp = false;
      process.argv = ['/path/to/app', '--version'];

      const result = checkEarlyExit();

      expect(result.shouldExit).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringMatching(/self-review v\d+\.\d+\.\d+/)
      );
    });

    it('detects -v flag', () => {
      (process as any).defaultApp = false;
      process.argv = ['/path/to/app', '-v'];

      const result = checkEarlyExit();

      expect(result.shouldExit).toBe(true);
      expect(result.exitCode).toBe(0);
    });

    it('returns false when no early exit flags', () => {
      (process as any).defaultApp = false;
      process.argv = ['/path/to/app', '--staged'];

      const result = checkEarlyExit();

      expect(result.shouldExit).toBe(false);
      expect(result.exitCode).toBe(0);
    });

    it('handles dev mode correctly for --help', () => {
      (process as any).defaultApp = true;
      process.argv = ['/path/to/electron', '/path/to/main.js', '--help'];

      const result = checkEarlyExit();

      expect(result.shouldExit).toBe(true);
      expect(result.exitCode).toBe(0);
    });
  });
});
