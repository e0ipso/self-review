import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { normalizeGitDiffArgs, singleFileRediffArgs, parseGitDiffArgs } from './git-diff-args';
import { gitSync } from './test-support/git-env';

describe('git argument paths and installed Git semantics', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'self-review-argv-git-'));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('resolves paths from the supplied cwd while skipping existing option values', () => {
    mkdirSync(join(root, 'sub'));
    writeFileSync(join(root, 'sub', 'file with spaces'), 'text');
    writeFileSync(join(root, 'order'), 'text');
    expect(normalizeGitDiffArgs(['-O', 'order', 'HEAD', 'sub/file with spaces'], root)).toEqual([
      '-O',
      'order',
      'HEAD',
      '--',
      'sub/file with spaces',
    ]);
    expect(normalizeGitDiffArgs(['file with spaces'], join(root, 'sub'))).toEqual([
      '--',
      'file with spaces',
    ]);
    expect(normalizeGitDiffArgs(['file with spaces'], root)).toEqual(['file with spaces']);
  });

  it('matches Git for grouped attached search, optional values and relative prefixes', () => {
    const git = (args: string[], cwd = root) => gitSync(args, { cwd });
    git(['init', '-q']);
    git(['config', 'user.name', 'Argument Test']);
    git(['config', 'user.email', 'argument-test@example.com']);
    mkdirSync(join(root, 'sub'));
    writeFileSync(join(root, 'sub', 'file with spaces'), 'before\n');
    git(['add', '.']);
    git(['commit', '-qm', 'initial']);
    writeFileSync(join(root, 'sub', 'file with spaces'), 'before\n--\n');
    const patch = git(['diff', '-pS--', '-U', 'HEAD']);
    expect(patch).toContain('+--');
    expect(git(['diff', '-pS--', '-M', 'HEAD'])).toBe(patch);
    expect(parseGitDiffArgs(['-pS--', '-U', 'HEAD']).positionalIndices).toEqual([2]);
    const args = [
      '--relative',
      '--relative=sub/',
      '--src-prefix=old/',
      '--dst-prefix',
      'new/',
      'HEAD',
    ];
    const relativePatch = git(['diff', ...args]);
    expect(relativePatch).toContain('diff --git old/file with spaces new/file with spaces');
    const rediff = singleFileRediffArgs(args);
    expect(rediff.relative).toEqual({ kind: 'directory', directory: 'sub/' });
    expect(git(['diff', ...rediff.args, '--', 'sub/file with spaces'])).toContain('+--');
    expect(git(['diff', '--relative', '--no-relative', 'HEAD'], join(root, 'sub'))).toContain(
      'a/sub/file with spaces'
    );
    expect(git(['diff', 'HEAD', '--', '--quiet'])).toBe('');
  });
});
