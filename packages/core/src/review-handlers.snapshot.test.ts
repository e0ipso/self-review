// The handlers that read reviewed content, against real git snapshots. No git
// mock here: the point is that the bytes come from the reviewed side.

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { DiffFile, DiffLoadPayload } from './types';
import { gitSync } from './test-support/git-env';
import { resolveGitSourceIdentity } from './source-identity';
import { commitDiffData, createReviewSession, expandContext, loadImage } from './review-handlers';

// A minimal PNG, with its last byte free to say which snapshot it came from.
const PNG_HEAD = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const png = (tail: number) => Buffer.concat([PNG_HEAD, Buffer.from([tail])]);

function file(newPath: string, changeType: DiffFile['changeType'] = 'modified'): DiffFile {
  return {
    oldPath: changeType === 'added' ? '' : newPath,
    newPath: changeType === 'deleted' ? '' : newPath,
    changeType,
    isBinary: false,
    hunks: [],
  };
}

function lastByteOf(dataUri: string): number {
  const bytes = Buffer.from(dataUri.split(',')[1], 'base64');
  return bytes[bytes.length - 1];
}

describe('loadImage and expandContext read the reviewed snapshot', () => {
  let tmp: string;
  let repo: string;
  let mainSha: string;
  let featureSha: string;

  beforeAll(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sr-handlers-snapshot-')));
    repo = path.join(tmp, 'repo');
    fs.mkdirSync(repo);
    const git = (...args: string[]) => gitSync(args, { cwd: repo }).trim();
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'Test');
    // main: a three-line file and an image ending 01.
    fs.writeFileSync(path.join(repo, 'notes.txt'), 'one\ntwo\nthree\n');
    fs.writeFileSync(path.join(repo, 'pic.png'), png(0x01));
    fs.writeFileSync(path.join(repo, 'old.png'), png(0x0a));
    git('add', '-A');
    git('commit', '-qm', 'main');
    mainSha = git('rev-parse', 'HEAD');
    // feature: the file grows to seven lines. main stays checked out.
    git('checkout', '-qb', 'feature');
    fs.writeFileSync(path.join(repo, 'notes.txt'), 'one\ntwo\nthree\nfour\nfive\nsix\nseven\n');
    git('commit', '-qam', 'feature');
    featureSha = git('rev-parse', 'HEAD');
    git('checkout', '-q', 'main');
    // The audit probe: stage an image ending 02, then change the working
    // file to end 03. Stage five lines of notes, then nine in the tree.
    fs.writeFileSync(path.join(repo, 'pic.png'), png(0x02));
    fs.writeFileSync(path.join(repo, 'notes.txt'), 'a\nb\nc\nd\ne\n');
    git('add', 'pic.png', 'notes.txt');
    fs.writeFileSync(path.join(repo, 'pic.png'), png(0x03));
    fs.writeFileSync(path.join(repo, 'notes.txt'), 'a\nb\nc\nd\ne\nf\ng\nh\ni\n');
    fs.rmSync(path.join(repo, 'old.png'));
  });

  afterAll(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  async function gitSession(argv: string[], files: DiffFile[], remote?: DiffLoadPayload['remote']) {
    const session = createReviewSession();
    const identity = await resolveGitSourceIdentity({ repository: repo, gitDiffArgv: argv });
    const payload: DiffLoadPayload = {
      files,
      source: { type: 'git', gitDiffArgs: argv.join(' '), repository: repo },
      ...(remote ? { remote } : {}),
    };
    commitDiffData(session, payload, remote ? { ...identity, mode: 'remote' } : identity);
    return session;
  }

  it('previews the staged image, not the one in the working tree (audit R13 probe)', async () => {
    const session = await gitSession(['--staged'], [file('pic.png')]);

    const result = await loadImage(session, 'pic.png');

    expect(result).toHaveProperty('dataUri');
    expect(lastByteOf((result as { dataUri: string }).dataUri)).toBe(0x02);
  });

  it('previews the working-tree image for an unstaged review', async () => {
    const session = await gitSession([], [file('pic.png')]);

    const result = await loadImage(session, 'pic.png');

    expect(lastByteOf((result as { dataUri: string }).dataUri)).toBe(0x03);
  });

  it('previews a deleted image from the side that still has it', async () => {
    const session = await gitSession([], [file('old.png', 'deleted')]);

    const result = await loadImage(session, 'old.png');

    expect(lastByteOf((result as { dataUri: string }).dataUri)).toBe(0x0a);
  });

  it('refuses a path the review does not contain, and one that is not an image', async () => {
    const session = await gitSession(['--staged'], [file('pic.png'), file('notes.txt')]);

    expect(await loadImage(session, 'other.png')).toEqual({
      error: expect.stringContaining('not part of the reviewed diff'),
    });
    expect(await loadImage(session, 'notes.txt')).toEqual({
      error: expect.stringContaining('not a previewable image'),
    });
  });

  it('counts the lines of the staged file for a staged expansion', async () => {
    const session = await gitSession(['--staged'], [file('notes.txt')]);

    const result = await expandContext(session, { filePath: 'notes.txt', contextLines: 10 });

    expect(result?.totalLines).toBe(5);
    expect(result?.hunks.length).toBeGreaterThan(0);
  });

  it('counts the lines at the PR head for a remote session, not the checked-out branch', async () => {
    const session = await gitSession([`${mainSha}...${featureSha}`], [file('notes.txt')], {
      remoteUrl: 'https://github.com/owner/repo/pull/1',
      remoteBaseSha: mainSha,
      remoteHeadSha: featureSha,
      remoteForge: 'github',
      threadSyncAvailable: false,
      temporaryClone: true,
    });

    const result = await expandContext(session, { filePath: 'notes.txt', contextLines: 10 });

    // The working tree is on main (nine lines after the edits above); the
    // reviewed head has seven.
    expect(result?.totalLines).toBe(7);
  });
});
