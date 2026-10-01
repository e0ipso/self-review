import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { loadGitDiffWithUntracked } from './git-diff-loader';
import { gitSync } from './test-support/git-env';

describe('loadGitDiffWithUntracked', () => {
  let root: string;

  beforeEach(() => {
    // git reports the resolved top level, and temp dirs can be symlinked.
    root = realpathSync(mkdtempSync(join(tmpdir(), 'self-review-test-loader-')));
    gitSync(['init', '-q', root]);
    gitSync(['-C', root, 'config', 'user.email', 'test@example.com']);
    gitSync(['-C', root, 'config', 'user.name', 'Test']);
    mkdirSync(join(root, 'sub'));
    writeFileSync(join(root, 'tracked.txt'), 'original\n');
    gitSync(['-C', root, 'add', '-A']);
    gitSync(['-C', root, 'commit', '-qm', 'init']);

    // Same basename at two depths, different bytes.
    writeFileSync(join(root, 'dup.txt'), 'ROOT CONTENT\n');
    writeFileSync(join(root, 'sub', 'dup.txt'), 'NESTED CONTENT\n');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function untrackedContent(
    files: { newPath: string; isUntracked?: boolean; hunks: { lines: { content: string }[] }[] }[]
  ): Record<string, string> {
    return Object.fromEntries(
      files
        .filter(file => file.isUntracked)
        .map(file => [file.newPath, file.hunks[0]?.lines[0]?.content])
    );
  }

  it.each([
    ['the repository root', ''],
    ['a nested directory', 'sub'],
  ])(
    'reviews each untracked file with its own bytes when launched from %s',
    async (_label, from) => {
      const { files, repository } = await loadGitDiffWithUntracked([], join(root, from));

      expect(repository).toBe(root);
      expect(untrackedContent(files)).toEqual({
        'dup.txt': 'ROOT CONTENT',
        'sub/dup.txt': 'NESTED CONTENT',
      });
    }
  );

  it('reports tracked changes outside the launch directory', async () => {
    writeFileSync(join(root, 'tracked.txt'), 'changed\n');

    const { files } = await loadGitDiffWithUntracked([], join(root, 'sub'));

    expect(files.map(file => file.newPath)).toContain('tracked.txt');
  });

  it('omits untracked files when includeUntracked is false', async () => {
    const { files } = await loadGitDiffWithUntracked([], join(root, 'sub'), {
      includeUntracked: false,
    });

    expect(files).toEqual([]);
  });

  // SR-0036: a root directory with a trailing space is real. Trimming
  // git's `--show-toplevel` output reported a path short by that space, so
  // every consumer resolved against a directory that doesn't exist.
  it('lists and reads untracked files when the repository root has trailing whitespace', async () => {
    const parent = realpathSync(mkdtempSync(join(tmpdir(), 'self-review-test-loader-space-')));
    const spacedRoot = join(parent, 'trailing space ');
    mkdirSync(spacedRoot);
    gitSync(['init', '-q', spacedRoot]);
    writeFileSync(join(spacedRoot, 'untracked.txt'), 'content\n');

    try {
      const { files, repository } = await loadGitDiffWithUntracked([], spacedRoot);

      expect(repository).toBe(spacedRoot);
      expect(untrackedContent(files)).toEqual({ 'untracked.txt': 'content' });
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});

// R12: a path appears once. `git rm --cached` leaves the file on disk as an
// untracked file while HEAD still tracks it, so a HEAD comparison carried a
// tracked deletion and a synthetic untracked addition under one path.
describe('loadGitDiffWithUntracked gives each path one entry', () => {
  let root: string;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'self-review-test-loader-dedup-')));
    gitSync(['init', '-q', root]);
    gitSync(['-C', root, 'config', 'user.email', 'test@example.com']);
    gitSync(['-C', root, 'config', 'user.name', 'Test']);
    writeFileSync(join(root, 'f.txt'), 'content\n');
    gitSync(['-C', root, 'add', '-A']);
    gitSync(['-C', root, 'commit', '-qm', 'init']);
    gitSync(['-C', root, 'rm', '-q', '--cached', 'f.txt']);
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it.each([
    ['on', true],
    ['off', false],
  ])(
    'yields one tracked entry for a path git rm --cached left on disk (untracked %s)',
    async (_label, includeUntracked) => {
      const { files, diagnostics } = await loadGitDiffWithUntracked(
        ['--no-renames', 'HEAD'],
        root,
        {
          includeUntracked,
        }
      );

      expect(diagnostics).toEqual([]);
      expect(files.map(file => [file.oldPath || file.newPath, file.changeType])).toEqual([
        ['f.txt', 'deleted'],
      ]);
      expect(files[0].isUntracked).toBeFalsy();
    }
  );

  it('still reports untracked files whose paths are not in the tracked diff', async () => {
    writeFileSync(join(root, 'brand-new.txt'), 'new\n');

    const { files } = await loadGitDiffWithUntracked(['--no-renames', 'HEAD'], root);

    expect(files.map(file => [file.newPath || file.oldPath, file.isUntracked ?? false])).toEqual([
      ['f.txt', false],
      ['brand-new.txt', true],
    ]);
  });
});

describe('loadGitDiffWithUntracked diagnostics', () => {
  let root: string;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'self-review-test-loader-diag-')));
    gitSync(['init', '-q', root]);
    gitSync(['-C', root, 'config', 'user.email', 'test@example.com']);
    gitSync(['-C', root, 'config', 'user.name', 'Test']);
    writeFileSync(join(root, 'f.txt'), 'old\n');
    gitSync(['-C', root, 'add', '-A']);
    gitSync(['-C', root, 'commit', '-qm', 'init']);
    writeFileSync(join(root, 'f.txt'), 'new\n');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('rejects an output format the parser cannot consume, naming the flag', async () => {
    const { files, repository, diagnostics } = await loadGitDiffWithUntracked(['--stat'], root);

    expect(repository).toBe(root);
    expect(files).toEqual([]);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toContain('--stat');
  });

  it('returns no diagnostics for an ordinary patch', async () => {
    const { files, diagnostics } = await loadGitDiffWithUntracked([], root);

    expect(diagnostics).toEqual([]);
    expect(files.map(file => file.newPath)).toEqual(['f.txt']);
  });
});
