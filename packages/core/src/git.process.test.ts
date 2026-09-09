import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { getUntrackedFilesAsync, runGitDiff, runGitDiffAsync } from './git';

// Exercise real child processes: mocked argv checks cannot detect shell expansion.
describe.each(['sync', 'async'] as const)('literal git diff arguments (%s)', mode => {
  const originalCwd = process.cwd();
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'self-review-test-diff-literal-'));
    execFileSync('git', ['init', '-q', root]);
    // The async wrapper receives an explicit cwd; the sync wrapper inherits it.
    if (mode === 'sync') process.chdir(root);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(root, { recursive: true, force: true });
  });

  it.each([
    '$(touch${IFS}SELF_REVIEW_INJECTION_MARKER)',
    '`touch${IFS}SELF_REVIEW_INJECTION_MARKER`',
    'file with spaces.txt',
    'file "with quotes".txt',
    "file 'with quotes'.txt",
  ])('reviews the literal filename without executing shell syntax: %s', async filename => {
    writeFileSync(join(root, filename), 'selected content\n');
    writeFileSync(join(root, 'other.txt'), 'unselected content\n');
    execFileSync('git', ['add', '--', filename, 'other.txt'], { cwd: root });
    const args = ['--cached', '--', filename];

    const diff = mode === 'sync' ? runGitDiff(args) : await runGitDiffAsync(args, root);

    expect(existsSync(join(root, 'SELF_REVIEW_INJECTION_MARKER'))).toBe(false);
    expect(diff).toContain('+selected content');
    expect(diff).not.toContain('+unselected content');
  });
});

// Names git quotes, plus names that survive only NUL-terminated output.
const LITERAL_NAMES = [
  'plain.txt',
  'my file.txt',
  ' leading-space.txt',
  'trailing-space .txt',
  'café.txt',
  'tab\there.txt',
  'new\nline.txt',
  'quote".txt',
  'back\\slash.txt',
];

describe('getUntrackedFilesAsync', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'self-review-test-untracked-'));
    execFileSync('git', ['init', '-q', root]);
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('returns untracked names exactly as they are on disk', async () => {
    for (const name of LITERAL_NAMES) {
      writeFileSync(join(root, name), 'content\n');
    }

    const listed = await getUntrackedFilesAsync(root);

    expect(listed.sort()).toEqual([...LITERAL_NAMES].sort());
  });

  it('reads the listed names back without repair', async () => {
    for (const name of LITERAL_NAMES) {
      writeFileSync(join(root, name), `content of ${name}\n`);
    }

    const listed = await getUntrackedFilesAsync(root);

    for (const name of listed) {
      expect(readFileSync(join(root, name), 'utf-8')).toBe(`content of ${name}\n`);
    }
  });

  it('lists the whole repository when run from the root', async () => {
    mkdirSync(join(root, 'nested'));
    writeFileSync(join(root, 'nested', 'deep.txt'), 'deep\n');
    writeFileSync(join(root, 'top.txt'), 'top\n');

    const listed = await getUntrackedFilesAsync(root);

    expect(listed.sort()).toEqual(['nested/deep.txt', 'top.txt']);
  });

  it('ignores gitignored files', async () => {
    writeFileSync(join(root, '.gitignore'), 'ignored.txt\n');
    writeFileSync(join(root, 'ignored.txt'), 'nope\n');
    writeFileSync(join(root, 'kept.txt'), 'yes\n');

    const listed = await getUntrackedFilesAsync(root);

    expect(listed.sort()).toEqual(['.gitignore', 'kept.txt']);
  });
});
