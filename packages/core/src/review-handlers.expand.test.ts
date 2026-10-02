// Context expansion against real git (audit R07). Expansion re-runs the
// review's own `git diff` over one file with more context; these cases are
// the ones where re-running it naively changed what was being compared or
// which file came back.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { DiffHunk } from './types';
import { gitSync } from './test-support/git-env';
import { loadGitDiffWithUntracked } from './git-diff-loader';
import { formatGitDiffArgs, normalizeGitDiffArgs } from './git-diff-args';
import { commitDiffData, createReviewSession, expandContext } from './review-handlers';

/** `count` numbered lines, `prefix1` .. `prefixN`, newline-terminated. */
function numbered(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}${i + 1}`);
}

function text(lines: string[]): string {
  return lines.map(line => `${line}\n`).join('');
}

/** `lines` with the 1-based line `at` replaced. */
function withLine(lines: string[], at: number, replacement: string): string[] {
  return lines.map((line, i) => (i === at - 1 ? replacement : line));
}

function contentOf(hunks: DiffHunk[], type: 'addition' | 'deletion' | 'context'): string[] {
  return hunks.flatMap(h => h.lines.filter(l => l.type === type).map(l => l.content));
}

describe('expandContext re-runs the reviewed comparison', () => {
  let tmp: string;
  let repo: string;
  const git = (...args: string[]) => gitSync(args, { cwd: repo }).trim();
  const write = (rel: string, lines: string[]) => {
    fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true });
    fs.writeFileSync(path.join(repo, rel), text(lines));
  };

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sr-expand-')));
    repo = path.join(tmp, 'repo');
    fs.mkdirSync(repo);
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'Test');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  /** Load a review the way the front ends do: normalized argv, run from `cwd`. */
  async function loadSession(argv: string[], cwd: string = repo) {
    const args = normalizeGitDiffArgs(argv, cwd);
    const { files, repository, identity } = await loadGitDiffWithUntracked(args, cwd, {
      includeUntracked: false,
    });
    const session = createReviewSession();
    commitDiffData(
      session,
      { files, source: { type: 'git', gitDiffArgs: formatGitDiffArgs(args), repository } },
      identity
    );
    return session;
  }

  it('keeps HEAD as the old side of a `-U HEAD` review (staged and working tree differ)', async () => {
    const base = numbered('line', 30);
    write('notes.txt', base);
    git('add', '-A');
    git('commit', '-qm', 'base');
    write('notes.txt', withLine(base, 15, 'index-version'));
    git('add', 'notes.txt');
    write('notes.txt', withLine(base, 15, 'work-version'));

    // A bare -U takes no separate value: HEAD is the revision.
    const session = await loadSession(['-U', 'HEAD']);
    expect(contentOf(session.diffData!.files[0].hunks, 'deletion')).toEqual(['line15']);

    const result = await expandContext(session, { filePath: 'notes.txt', contextLines: 100 });

    expect(result).not.toBeNull();
    expect(contentOf(result!.hunks, 'deletion')).toEqual(['line15']);
    expect(contentOf(result!.hunks, 'addition')).toEqual(['work-version']);
    expect(result!.hunks[0].oldStart).toBe(1);
    expect(contentOf(result!.hunks, 'context')).toHaveLength(29);
  });

  it('expands an edited staged rename into rename hunks, not a full addition', async () => {
    const base = numbered('row', 30);
    write('old-name.txt', base);
    git('add', '-A');
    git('commit', '-qm', 'base');
    git('mv', 'old-name.txt', 'new-name.txt');
    write('new-name.txt', withLine(base, 15, 'renamed-edit'));
    git('add', '-A');

    const session = await loadSession(['--staged']);
    const [renamed] = session.diffData!.files;
    expect(renamed).toMatchObject({
      oldPath: 'old-name.txt',
      newPath: 'new-name.txt',
      changeType: 'renamed',
    });

    const result = await expandContext(session, { filePath: 'new-name.txt', contextLines: 100 });

    expect(result).not.toBeNull();
    expect(contentOf(result!.hunks, 'deletion')).toEqual(['row15']);
    expect(contentOf(result!.hunks, 'addition')).toEqual(['renamed-edit']);
    expect(contentOf(result!.hunks, 'context')).toHaveLength(29);
    expect(result!.totalLines).toBe(30);
    // Written back to the rename, not to some other entry.
    expect(session.diffData!.files[0].hunks).toEqual(result!.hunks);
  });

  it('returns the copy it was asked for when git also reports the modified source', async () => {
    const base = numbered('src', 30);
    write('a-source.txt', base);
    git('add', '-A');
    git('commit', '-qm', 'base');
    write('b-copy.txt', withLine(base, 20, 'copy-edit'));
    write('a-source.txt', withLine(base, 3, 'source-edit'));
    git('add', '-A');

    const session = await loadSession(['--staged', '-C']);
    const copy = session.diffData!.files.find(f => f.newPath === 'b-copy.txt');
    expect(copy).toMatchObject({ oldPath: 'a-source.txt', changeType: 'copied' });

    const result = await expandContext(session, { filePath: 'b-copy.txt', contextLines: 100 });

    // git lists the modified source first; the copy is the one requested.
    expect(result).not.toBeNull();
    expect(contentOf(result!.hunks, 'addition')).toEqual(['copy-edit']);
    expect(contentOf(result!.hunks, 'deletion')).toEqual(['src20']);
    const source = session.diffData!.files.find(f => f.newPath === 'a-source.txt');
    expect(contentOf(source!.hunks, 'addition')).toEqual(['source-edit']);
  });

  describe('relative paths and same-named files', () => {
    beforeEach(() => {
      write('x.txt', numbered('root', 30));
      write('sub/x.txt', numbered('nested', 40));
      git('add', '-A');
      git('commit', '-qm', 'base');
      write('x.txt', withLine(numbered('root', 30), 15, 'root-edit'));
      write('sub/x.txt', withLine(numbered('nested', 40), 15, 'nested-edit'));
    });

    async function expectNestedExpansion(argv: string[], cwd: string) {
      const session = await loadSession(argv, cwd);
      expect(session.diffData!.files.map(f => f.newPath)).toEqual(['x.txt']);

      const result = await expandContext(session, { filePath: 'x.txt', contextLines: 100 });

      expect(result).not.toBeNull();
      expect(contentOf(result!.hunks, 'addition')).toEqual(['nested-edit']);
      expect(result!.totalLines).toBe(40);
    }

    it('expands `--relative` launched from a subdirectory into the nested file', async () => {
      await expectNestedExpansion(['--relative'], path.join(repo, 'sub'));
    });

    it('expands `--relative=<dir>` launched from the root into the nested file', async () => {
      await expectNestedExpansion(['--relative=sub'], repo);
    });

    it('selects root and nested same-named files for a review launched from a subdirectory', async () => {
      const session = await loadSession([], path.join(repo, 'sub'));
      expect(session.diffData!.files.map(f => f.newPath).sort()).toEqual(['sub/x.txt', 'x.txt']);

      const root = await expandContext(session, { filePath: 'x.txt', contextLines: 100 });
      const nested = await expandContext(session, { filePath: 'sub/x.txt', contextLines: 100 });

      expect(contentOf(root!.hunks, 'addition')).toEqual(['root-edit']);
      expect(root!.totalLines).toBe(30);
      expect(contentOf(nested!.hunks, 'addition')).toEqual(['nested-edit']);
      expect(nested!.totalLines).toBe(40);
    });
  });
});
