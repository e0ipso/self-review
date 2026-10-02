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
import {
  applySuggestionForSession,
  commitDiffData,
  createReviewSession,
  expandContext,
  loadImage,
} from './review-handlers';

// A minimal PNG whose last byte says which file it came from.
const PNG_HEAD = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const png = (tail: number) => Buffer.concat([PNG_HEAD, Buffer.from([tail])]);

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

    // Audit R07: expansion learned to restate `--relative` paths from the root
    // (above), but Apply and the image preview still resolved them there as
    // given, so in a review of `sub/` they reached the root's same-named
    // file. Every path-taking handler now maps through the identity's prefix.
    it('applies a suggestion of a `--relative` review to the nested file, not the root one', async () => {
      const cwd = path.join(repo, 'sub');
      const session = await loadSession(['--relative'], cwd);
      const rootBefore = fs.readFileSync(path.join(repo, 'x.txt'), 'utf-8');

      const outcome = applySuggestionForSession(session, {
        filePath: 'x.txt',
        lineRange: { side: 'new', start: 15, end: 15 },
        suggestion: { originalCode: 'nested-edit', proposedCode: 'nested-applied' },
      });

      expect(outcome).toEqual({ status: 'applied', filePath: 'x.txt', replacedLines: 1 });
      expect(fs.readFileSync(path.join(repo, 'sub', 'x.txt'), 'utf-8')).toContain(
        'nested-applied\n'
      );
      expect(fs.readFileSync(path.join(repo, 'x.txt'), 'utf-8')).toBe(rootBefore);
    });

    it('previews the image of a `--relative` review from the subdirectory, not the root', async () => {
      fs.writeFileSync(path.join(repo, 'pic.png'), png(0x01));
      fs.writeFileSync(path.join(repo, 'sub', 'pic.png'), png(0x02));
      git('add', 'pic.png', 'sub/pic.png');
      git('commit', '-qm', 'images');
      fs.writeFileSync(path.join(repo, 'pic.png'), png(0x11));
      fs.writeFileSync(path.join(repo, 'sub', 'pic.png'), png(0x12));

      const session = await loadSession(['--relative'], path.join(repo, 'sub'));
      expect(session.diffData!.files.map(f => f.newPath).sort()).toEqual(['pic.png', 'x.txt']);

      const result = await loadImage(session, 'pic.png');

      expect(result).toHaveProperty('dataUri');
      const bytes = Buffer.from((result as { dataUri: string }).dataUri.split(',')[1], 'base64');
      expect(bytes[bytes.length - 1]).toBe(0x12);
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
