import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { ReviewSourceIdentity } from './types';
import { gitSync } from './test-support/git-env';
import { resolveGitSourceIdentity, resolveLocalSourceIdentity } from './source-identity';
import { authorizeReviewedPath, readReviewedContent } from './snapshot-reader';
import type { ReviewedSnapshot } from './snapshot-reader';

const SENTINEL = 'PRIVATE SENTINEL\n';

function snapshot(
  sourceIdentity: ReviewSourceIdentity | null,
  paths: readonly string[]
): ReviewedSnapshot {
  return { sourceIdentity, reviewedPaths: new Set(paths) };
}

async function text(source: ReviewedSnapshot, filePath: string, side: 'old' | 'new') {
  const result = await readReviewedContent(source, filePath, side);
  if (!result.ok) throw new Error(`${result.reason}: ${result.message}`);
  return result.content.toString('utf-8');
}

async function refusal(
  source: ReviewedSnapshot,
  filePath: string,
  side: 'old' | 'new',
  maxBytes?: number
) {
  const result = await readReviewedContent(source, filePath, side, { maxBytes });
  if (result.ok) throw new Error(`expected a refusal, read ${result.content.length} bytes`);
  return result;
}

// src/a.txt differs in every snapshot (first, committed, staged, working), so a wrong-side read shows;
// gone.txt is deleted from the working tree; link.txt is an untracked link to a sentinel outside.
describe('readReviewedContent over git snapshots', () => {
  let tmp: string;
  let repo: string;
  let outside: string;
  let first: string;
  let second: string;
  let staged: ReviewedSnapshot;
  let working: ReviewedSnapshot;
  let range: ReviewedSnapshot;

  beforeAll(async () => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sr-snapshot-')));
    repo = path.join(tmp, 'repo');
    outside = path.join(tmp, 'outside');
    fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, 'target.txt'), SENTINEL);
    const git = (...args: string[]) => gitSync(args, { cwd: repo }).trim();
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'Test');
    fs.writeFileSync(path.join(repo, 'src', 'a.txt'), 'first\n');
    fs.writeFileSync(path.join(repo, 'gone.txt'), 'to delete\n');
    git('add', '-A');
    git('commit', '-qm', 'first');
    first = git('rev-parse', 'HEAD');
    fs.writeFileSync(path.join(repo, 'src', 'a.txt'), 'committed\n');
    git('commit', '-qam', 'second');
    second = git('rev-parse', 'HEAD');
    fs.writeFileSync(path.join(repo, 'src', 'a.txt'), 'staged\n');
    git('add', 'src/a.txt');
    fs.writeFileSync(path.join(repo, 'src', 'a.txt'), 'working\n');
    fs.rmSync(path.join(repo, 'gone.txt'));
    fs.symlinkSync(path.join(outside, 'target.txt'), path.join(repo, 'link.txt'));

    const reviewed = ['src/a.txt', 'gone.txt', 'link.txt', '../outside/target.txt'];
    const identityFor = (argv: string[]) =>
      resolveGitSourceIdentity({ repository: repo, gitDiffArgv: argv });
    staged = snapshot(await identityFor(['--staged']), reviewed);
    working = snapshot(await identityFor([]), reviewed);
    range = snapshot(await identityFor([`${first}..${second}`]), reviewed);
  });

  afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('reads the index for a staged review, not the working tree', async () => {
    expect(await text(staged, 'src/a.txt', 'new')).toBe('staged\n');
    expect(await text(staged, 'src/a.txt', 'old')).toBe('committed\n');
  });

  it('reads the working tree and the index for an unstaged review', async () => {
    expect(await text(working, 'src/a.txt', 'new')).toBe('working\n');
    expect(await text(working, 'src/a.txt', 'old')).toBe('staged\n');
  });

  it('reads the two commits of a range, whatever the working tree says', async () => {
    expect(await text(range, 'src/a.txt', 'old')).toBe('first\n');
    expect(await text(range, 'src/a.txt', 'new')).toBe('committed\n');
  });

  it('still reads a deleted file from the side that has it', async () => {
    expect(await text(working, 'gone.txt', 'old')).toBe('to delete\n');
    expect((await refusal(working, 'gone.txt', 'new')).reason).toBe('not-found');
  });

  it('refuses a working-tree symlink without reading through it', async () => {
    const result = await refusal(working, 'link.txt', 'new');
    expect(result.reason).toBe('unsafe-link');
    expect(result.message).not.toContain('PRIVATE');
  });

  it('refuses a path that leaves the source root, even one the set names', async () => {
    expect((await refusal(working, '../outside/target.txt', 'new')).reason).toBe('invalid-path');
    expect((await refusal(working, path.join(outside, 'target.txt'), 'new')).reason).toBe(
      'invalid-path'
    );
  });

  it('refuses a path the review never contained', async () => {
    expect((await refusal(working, 'src/other.txt', 'new')).reason).toBe('not-reviewed');
    expect(authorizeReviewedPath(working, 'src/other.txt')).toMatchObject({
      ok: false,
      reason: 'not-reviewed',
    });
    expect(authorizeReviewedPath(working, 'src/a.txt')).toEqual({
      ok: true,
      relativePath: 'src/a.txt',
      sourceRoot: repo,
    });
  });

  it('honours the byte budget on every kind of side', async () => {
    expect((await refusal(working, 'src/a.txt', 'new', 3)).reason).toBe('too-large');
    expect((await refusal(staged, 'src/a.txt', 'new', 3)).reason).toBe('too-large');
    expect((await refusal(range, 'src/a.txt', 'new', 3)).reason).toBe('too-large');
  });

  it('refuses a side it could not identify instead of falling back to the working tree', async () => {
    const unknown = snapshot(
      await resolveGitSourceIdentity({ repository: repo, gitDiffArgv: ['nope'] }),
      ['src/a.txt']
    );
    expect((await refusal(unknown, 'src/a.txt', 'old')).reason).toBe('side-unavailable');
    expect(await text(unknown, 'src/a.txt', 'new')).toBe('working\n');
  });

  it('refuses everything when the session has no source', async () => {
    expect((await refusal(snapshot(null, ['src/a.txt']), 'src/a.txt', 'new')).reason).toBe(
      'no-source'
    );
  });
});

describe('readReviewedContent over directory and file sources', () => {
  let tmp: string;
  let reviewed: string;
  let outside: string;

  beforeAll(() => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sr-snapshot-local-')));
    reviewed = path.join(tmp, 'reviewed');
    outside = path.join(tmp, 'outside');
    fs.mkdirSync(path.join(reviewed, 'sub'), { recursive: true });
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, 'target.txt'), SENTINEL);
    fs.writeFileSync(path.join(reviewed, 'sub', 'note.txt'), 'note\n');
    fs.symlinkSync(path.join(outside, 'target.txt'), path.join(reviewed, 'link.txt'));
    fs.symlinkSync(outside, path.join(reviewed, 'ancestor'));
  });

  afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('reads a scanned file under the physical directory and nothing on the old side', async () => {
    const source = snapshot(
      resolveLocalSourceIdentity({ type: 'directory', sourcePath: reviewed }),
      ['sub/note.txt']
    );
    expect(await text(source, 'sub/note.txt', 'new')).toBe('note\n');
    expect((await refusal(source, 'sub/note.txt', 'old')).reason).toBe('side-unavailable');
  });

  it('refuses a symlink leaf and a symlink ancestor in a scanned directory', async () => {
    const source = snapshot(
      resolveLocalSourceIdentity({ type: 'directory', sourcePath: reviewed }),
      ['link.txt', 'ancestor/target.txt']
    );
    expect((await refusal(source, 'link.txt', 'new')).reason).toBe('unsafe-link');
    expect((await refusal(source, 'ancestor/target.txt', 'new')).reason).toBe('unsafe-link');
  });

  it('reads the one file of a file review', async () => {
    const source = snapshot(
      resolveLocalSourceIdentity({
        type: 'file',
        sourcePath: path.join(reviewed, 'sub', 'note.txt'),
      }),
      ['note.txt']
    );
    expect(await text(source, 'note.txt', 'new')).toBe('note\n');
    expect((await refusal(source, 'link.txt', 'new')).reason).toBe('not-reviewed');
  });
});
