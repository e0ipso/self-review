import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { loadGitDiffWithUntracked } from './git-diff-loader';

describe('loadGitDiffWithUntracked', () => {
  let root: string;

  beforeEach(() => {
    // git reports the resolved top level, and temp dirs can be symlinked.
    root = realpathSync(mkdtempSync(join(tmpdir(), 'self-review-test-loader-')));
    execFileSync('git', ['init', '-q', root]);
    execFileSync('git', ['-C', root, 'config', 'user.email', 'test@example.com']);
    execFileSync('git', ['-C', root, 'config', 'user.name', 'Test']);
    mkdirSync(join(root, 'sub'));
    writeFileSync(join(root, 'tracked.txt'), 'original\n');
    execFileSync('git', ['-C', root, 'add', '-A']);
    execFileSync('git', ['-C', root, 'commit', '-qm', 'init']);

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
  ])('reviews each untracked file with its own bytes when launched from %s', async (_label, from) => {
    const { files, repository } = await loadGitDiffWithUntracked(
      [],
      join(root, from)
    );

    expect(repository).toBe(root);
    expect(untrackedContent(files)).toEqual({
      'dup.txt': 'ROOT CONTENT',
      'sub/dup.txt': 'NESTED CONTENT',
    });
  });

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
});
