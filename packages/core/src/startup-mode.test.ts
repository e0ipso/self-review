import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync, execSync } from 'child_process';
import { determineMode } from './startup-mode';
import { loadConfig } from './config';
import { normalizeGitDiffArgs } from './git-diff-args';

// determineMode reads the process CWD, so each suite runs from a temp tree.
// The vitest main config runs in a forked process, where chdir is allowed.

function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe('determineMode', () => {
  const originalCwd = process.cwd();

  describe('outside a git repository', () => {
    let root: string;

    beforeAll(() => {
      root = makeTempDir('self-review-test-mode-plain-');
      fs.mkdirSync(path.join(root, 'sub'));
      fs.writeFileSync(path.join(root, 'notes.md'), '# notes\n');
      process.chdir(root);
    });

    afterAll(() => {
      process.chdir(originalCwd);
      fs.rmSync(root, { recursive: true, force: true });
    });

    it('falls back to the welcome screen with no positional argument', () => {
      expect(determineMode([])).toBe('welcome');
      expect(determineMode(['--staged'])).toBe('welcome');
    });

    it('picks directory mode for an existing directory', () => {
      expect(determineMode(['sub'])).toBe('directory');
      expect(determineMode(['--', 'sub'])).toBe('directory');
    });

    it('picks file mode for an existing file', () => {
      expect(determineMode(['notes.md'])).toBe('file');
    });

    it('falls back to the welcome screen for a path that does not exist', () => {
      expect(determineMode(['missing'])).toBe('welcome');
    });
  });

  describe('inside a git repository', () => {
    let root: string;

    beforeAll(() => {
      root = makeTempDir('self-review-test-mode-git-');
      fs.writeFileSync(path.join(root, 'tracked.ts'), 'export {};\n');
      fs.writeFileSync(path.join(root, 'untracked.ts'), 'export {};\n');
      const git = (cmd: string) =>
        execSync(`git ${cmd}`, { cwd: root, stdio: 'ignore' });
      git('init -q');
      git('add tracked.ts');
      git('-c user.name=test -c user.email=test@example.com commit -q -m init');
      process.chdir(root);
    });

    afterAll(() => {
      process.chdir(originalCwd);
      fs.rmSync(root, { recursive: true, force: true });
    });

    it('picks git mode with no positional argument', () => {
      expect(determineMode([])).toBe('git');
      expect(determineMode(['--staged'])).toBe('git');
    });

    it('routes a tracked file through git diff', () => {
      expect(determineMode(['tracked.ts'])).toBe('git');
      expect(determineMode(['--', 'tracked.ts'])).toBe('git');
    });

    it('picks file mode for an untracked file', () => {
      expect(determineMode(['untracked.ts'])).toBe('file');
    });

    it('stays in git mode for a directory argument', () => {
      fs.mkdirSync(path.join(root, 'sub'));
      expect(determineMode(['sub'])).toBe('git');
    });
  });

  describe('literal filenames', () => {
    let root: string;
    const marker = 'SELF_REVIEW_INJECTION_MARKER';

    beforeEach(() => {
      root = makeTempDir('self-review-mode-literal-');
      execFileSync('git', ['init', '-q', root]);
      process.chdir(root);
    });

    afterEach(() => {
      process.chdir(originalCwd);
      fs.rmSync(root, { recursive: true, force: true });
    });

    it.each([
      '$(touch${IFS}SELF_REVIEW_INJECTION_MARKER)',
      '`touch${IFS}SELF_REVIEW_INJECTION_MARKER`',
      'file with spaces.txt',
      'file "with quotes".txt',
      "file 'with quotes'.txt",
    ])('detects tracked and untracked files literally: %s', filename => {
      fs.writeFileSync(filename, 'content\n');
      expect(determineMode(['--', filename])).toBe('file');
      expect(fs.existsSync(marker)).toBe(false);

      execFileSync('git', ['add', '--', filename]);
      expect(determineMode(['--', filename])).toBe('git');
      expect(fs.existsSync(marker)).toBe(false);
    });

    it.each([
      '$(touch${IFS}SELF_REVIEW_INJECTION_MARKER)',
      '`touch${IFS}SELF_REVIEW_INJECTION_MARKER`',
    ])('does not execute filenames selected by configuration: %s', filename => {
      fs.writeFileSync(filename, 'content\n');
      fs.writeFileSync('.self-review.yaml', `default-diff-args: '${filename}'\n`);
      const args = normalizeGitDiffArgs(
        loadConfig().defaultDiffArgs.split(' ').filter(Boolean)
      );

      expect(determineMode(args)).toBe('file');
      expect(fs.existsSync(marker)).toBe(false);
    });
  });
});
