import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  getRepoRoot,
  getRepoRootAsync,
  getUntrackedFilesAsync,
  runGitDiff,
  runGitDiffAsync,
} from './git';
import { gitSync } from './test-support/git-env';

// Exercise real child processes: mocked argv checks cannot detect shell expansion.
describe.each(['sync', 'async'] as const)('literal git diff arguments (%s)', mode => {
  const originalCwd = process.cwd();
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'self-review-test-diff-literal-'));
    gitSync(['init', '-q', root]);
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
    gitSync(['add', '--', filename, 'other.txt'], { cwd: root });
    const args = ['--cached', '--', filename];

    const diff = mode === 'sync' ? runGitDiff(args) : await runGitDiffAsync(args, root);

    expect(existsSync(join(root, 'SELF_REVIEW_INJECTION_MARKER'))).toBe(false);
    expect(diff).toContain('+selected content');
    expect(diff).not.toContain('+unselected content');
  });
});

// SR-0036: a root directory whose name has leading/trailing whitespace is
// real. `git rev-parse --show-toplevel` prints it followed by one newline;
// a blanket .trim() ate the whitespace along with that newline and reported
// a path that doesn't exist on disk.
describe.each(['sync', 'async'] as const)(
  'repository root with whitespace in its path (%s)',
  mode => {
    const originalCwd = process.cwd();
    let parent: string;
    let root: string;

    beforeEach(() => {
      // git reports the resolved top level, and temp dirs can be symlinked.
      parent = realpathSync(mkdtempSync(join(tmpdir(), 'self-review-test-root-space-')));
      root = join(parent, ' trailing and leading space ');
      mkdirSync(root);
      gitSync(['init', '-q', root]);
      if (mode === 'sync') process.chdir(root);
    });

    afterEach(() => {
      process.chdir(originalCwd);
      rmSync(parent, { recursive: true, force: true });
    });

    it('reports the exact root path, whitespace included', async () => {
      const reported = mode === 'sync' ? getRepoRoot() : await getRepoRootAsync(root);

      expect(reported).toBe(root);
    });
  }
);

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
    gitSync(['init', '-q', root]);
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
