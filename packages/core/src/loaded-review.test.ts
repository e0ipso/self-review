import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { gitSync } from './test-support/git-env';
import { loadLocalReview } from './startup';
import { commitDiffData, commitLoadedReview, createReviewSession } from './review-session';
import { loadedReviewIdentity, loadedReviewPaths } from './loaded-snapshot';
import { readLoadedReviewContent, readReviewedContent } from './snapshot-reader';
import { loadImage } from './review-content';
import { expandContext } from './review-context';
import { nodeScanFsLayer } from './node-scan-fs';
import { runGitDiffAsync } from './git';

let root: string;
const initial = Buffer.from([0, 1, 2, 3]);
const later = Buffer.from([0, 4, 5, 6, 7]);
const git = (...args: string[]) => gitSync(args, { cwd: root });
const write = (name: string, bytes: string | Buffer) =>
  fs.writeFileSync(path.join(root, name), bytes);
beforeEach(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sr-explicit-load-')));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(root, { recursive: true, force: true });
});
async function load(mode: 'directory' | 'file' | 'git' = 'directory') {
  return loadLocalReview(
    mode === 'git'
      ? { mode }
      : { mode, sourcePath: mode === 'file' ? path.join(root, 'image.png') : root },
    mode === 'git' ? ['--cached'] : [],
    { ignore: [] },
    root,
    () => {}
  );
}
function initializeGit() {
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Test');
  write('source.txt', 'top\nold\nbottom\n');
  git('add', 'source.txt');
  git('commit', '-qm', 'base');
}
it.each(['directory', 'file'] as const)(
  'retains separate capture across logical %s identity copies',
  async mode => {
    write('image.png', initial);
    const loaded = await load(mode);
    const handle = loaded.loadedReview!;
    expect(loadedReviewIdentity(handle)).toBe(loaded.identity);
    const paths = loadedReviewPaths(handle) as Set<string>;
    paths.add('outside.png');
    expect(loadedReviewPaths(handle).has('outside.png')).toBe(false);
    const session = createReviewSession();
    commitLoadedReview(session, loaded.payload, handle);
    expect(session.diffData).toBe(loaded.payload);
    expect(session.sourceIdentity).toBe(loaded.identity);
    expect(Object.isFrozen(loaded.payload)).toBe(false);
    expect(Object.isFrozen(loaded.identity)).toBe(false);
    expect(JSON.stringify(handle)).toBe('{}');
    expect(() => loadedReviewIdentity({ ...handle })).toThrow('LoadedReview capability');
    expect(await readLoadedReviewContent(handle, '../escape', 'new')).toMatchObject({
      ok: false,
      reason: 'invalid-path',
    });
    expect(await readLoadedReviewContent(handle, 'outside.png', 'new')).toMatchObject({
      ok: false,
      reason: 'not-reviewed',
    });
    session.sourceIdentity = { ...loaded.identity! };
    expect(await readReviewedContent(session, 'image.png', 'new')).toMatchObject({
      ok: false,
      reason: 'read-failed',
    });
    write('image.png', later);
    expect(await readLoadedReviewContent(handle, 'image.png', 'new')).toMatchObject({
      ok: false,
      reason: 'read-failed',
    });
    // Explicitly taking the old route discards the capability; structural identities remain live.
    commitDiffData(session, loaded.payload, { ...loaded.identity! });
    expect(session.loadedReview).toBeNull();
    expect(await readReviewedContent(session, 'image.png', 'new')).toEqual({
      ok: true,
      content: later,
    });
  }
);
it('pins exact index bytes and refuses logical identity mutation without freezing its aliases', async () => {
  initializeGit();
  write('image.png', initial);
  git('add', 'image.png');
  const loaded = await load('git');
  const session = createReviewSession();
  commitLoadedReview(session, loaded.payload, loaded.loadedReview!);
  write('image.png', later);
  git('add', 'image.png');
  expect(await readLoadedReviewContent(loaded.loadedReview!, 'image.png', 'new')).toEqual({
    ok: true,
    content: initial,
  });
  loaded.identity!.pathPrefix = 'changed';
  loaded.payload.isLargePayload = true;
  expect(session.diffData!.isLargePayload).toBe(true);
  expect(session.sourceIdentity!.pathPrefix).toBe('changed');
  expect(await readLoadedReviewContent(loaded.loadedReview!, 'image.png', 'new')).toMatchObject({
    ok: false,
    reason: 'read-failed',
  });
});
it('drops a preview result after the same payload and identity are recommitted', async () => {
  write('image.png', initial);
  let pause = false;
  let entered: () => void = () => {};
  const reading = new Promise<void>(resolve => {
    entered = resolve;
  });
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  const loaded = await loadLocalReview(
    { mode: 'directory', sourcePath: root },
    [],
    { ignore: [] },
    root,
    () => {},
    {},
    {
      scanFs: {
        ...nodeScanFsLayer,
        async open(...args) {
          const handle = await nodeScanFsLayer.open(...args);
          return {
            stat: () => handle.stat(),
            close: () => handle.close(),
            async read(...input) {
              if (pause) {
                entered();
                await gate;
              }
              return handle.read(...input);
            },
          };
        },
      },
    }
  );
  const session = createReviewSession();
  commitLoadedReview(session, loaded.payload, loaded.loadedReview!);
  pause = true;
  const pending = loadImage(session, 'image.png');
  try {
    await reading;
    commitLoadedReview(session, loaded.payload, loaded.loadedReview!);
  } finally {
    release();
  }
  expect(await pending).toEqual({ error: expect.stringContaining('loaded review changed') });
});
it('does not merge explicit context after line counting replaces the session', async () => {
  initializeGit();
  write('source.txt', 'top\nnew\nbottom\n');
  git('add', 'source.txt');
  const loaded = await load('git');
  const session = createReviewSession();
  commitLoadedReview(session, loaded.payload, loaded.loadedReview!);
  expect(
    await expandContext(
      session,
      { filePath: 'source.txt', contextLines: 20 },
      {
        runDiff: (args, cwd, options) => runGitDiffAsync(args, cwd, undefined, options),
        async readContent(...args) {
          const result = await readReviewedContent(...args);
          commitLoadedReview(session, loaded.payload, loaded.loadedReview!);
          return result;
        },
        report: () => {},
      }
    )
  ).toBeNull();
  expect(session.diffData).toBe(loaded.payload);
});

it('restricts the local capability to the files remaining after ignore filtering', async () => {
  initializeGit();
  write('image.png', initial);
  git('add', 'image.png');
  const loaded = await loadLocalReview(
    { mode: 'git' },
    ['--cached'],
    { ignore: ['image.png'] },
    root,
    () => {}
  );
  expect(loaded.payload.files).toEqual([]);
  expect([...loadedReviewPaths(loaded.loadedReview!)]).toEqual([]);
  expect(await readLoadedReviewContent(loaded.loadedReview!, 'image.png', 'new')).toMatchObject({
    ok: false,
    reason: 'not-reviewed',
  });
});

it('uses the current context lifetime after a completed load signal is aborted', async () => {
  initializeGit();
  write('source.txt', 'top\nnew\nbottom\n');
  git('add', 'source.txt');
  const loadOwner = new AbortController();
  const loaded = await loadLocalReview(
    { mode: 'git' },
    ['--cached'],
    { ignore: [] },
    root,
    () => {},
    { signal: loadOwner.signal }
  );
  const session = createReviewSession();
  commitLoadedReview(session, loaded.payload, loaded.loadedReview!);
  loadOwner.abort(new Error('load finished'));
  expect(await expandContext(session, { filePath: 'source.txt', contextLines: 20 })).toMatchObject({
    totalLines: 3,
  });
});
