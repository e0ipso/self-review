import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { gitSync } from './test-support/git-env';
import { defaultGitRunner } from './command-runner';
import { loadLocalReview } from './startup';
import { commitDiffData, createReviewSession } from './review-session';
import { prepareDirectoryReview } from './review-start';
import { loadImage } from './review-content';
import { readReviewedContent } from './snapshot-reader';
import { expandContext } from './review-context';
import { runGitDiffAsync } from './git';
import { applySuggestionForSessionAsync } from './review-suggestions';
import { nodeAsyncFsLayer } from './safe-fs-async';
import { nodeScanFsLayer } from './node-scan-fs';
import type { GitExecutionOptions } from './git';
import type { ReviewSession } from './review-session';

let root: string;
const original = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0xff, 0x80, 1]);
const mutated = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0xfe, 0x81, 2]);
const git = (...args: string[]) => gitSync(args, { cwd: root }).trim();
const write = (file: string, bytes: string | Buffer) =>
  fs.writeFileSync(path.join(root, file), bytes);

beforeEach(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sr-loaded-review-')));
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Test');
  write('image.png', Buffer.from([0, 1, 2]));
  write('source.txt', 'top\nold\nbottom\n');
  git('add', 'image.png', 'source.txt');
  git('commit', '-qm', 'base');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(root, { recursive: true, force: true });
});

async function load(args: string[] = [], cwd = root, options: GitExecutionOptions = {}) {
  const { payload, identity } = await loadLocalReview(
    { mode: 'git' },
    args,
    { ignore: [] },
    cwd,
    () => {},
    options
  );
  const session = createReviewSession();
  commitDiffData(session, payload, identity);
  return session;
}

async function imageBytes(session: ReviewSession, file = 'image.png') {
  const image = await loadImage(session, file);
  if (!('dataUri' in image)) throw new Error(image.error);
  return Buffer.from(image.dataUri.split(',')[1], 'base64');
}

const request = { filePath: 'source.txt', contextLines: 20 };

describe('loaded source consistency through shared host operations', () => {
  it('keeps the exact nontext index blob after restaging an image', async () => {
    write('image.png', original);
    git('add', 'image.png');
    const session = await load(['--cached']);
    write('image.png', mutated);
    git('add', 'image.png');
    expect(await imageBytes(session)).toEqual(original);
    expect(await imageBytes(session)).not.toEqual(mutated);
  });

  it('pins the old index side of a working-tree comparison', async () => {
    write('image.png', original);
    git('add', 'image.png');
    write('image.png', mutated);
    const session = await load();
    git('add', 'image.png');
    const old = await readReviewedContent(session, 'image.png', 'old');
    expect(old).toEqual({ ok: true, content: original });
    expect(await imageBytes(session)).toEqual(mutated);
  });

  it.each(['git', 'directory', 'file'] as const)(
    'refuses changed binary bytes in a %s review',
    async mode => {
      write('image.png', original);
      const session = mode === 'git' ? await load() : createReviewSession();
      if (mode !== 'git') {
        const loaded = await loadLocalReview(
          { mode, sourcePath: mode === 'file' ? path.join(root, 'image.png') : root },
          [],
          { ignore: ['.git/'] },
          root,
          () => {}
        );
        commitDiffData(session, loaded.payload, loaded.identity);
      }
      expect(await imageBytes(session)).toEqual(original);
      const before = fs.statSync(path.join(root, 'image.png'));
      write('image.png', mutated);
      fs.utimesSync(path.join(root, 'image.png'), before.atime, before.mtime);
      expect(await loadImage(session, 'image.png')).toEqual({
        error: expect.stringContaining('Reload the review'),
      });
    }
  );

  it('detects changes past the sniff prefix of an untracked binary', async () => {
    const bytes = Buffer.alloc(20_000, 0xff);
    bytes[0] = 0;
    write('untracked.png', bytes);
    const session = await load(['--cached']);
    expect(await imageBytes(session, 'untracked.png')).toEqual(bytes);
    const changed = Buffer.from(bytes);
    changed[19_999] = 1;
    write('untracked.png', changed);
    expect(await loadImage(session, 'untracked.png')).toEqual({
      error: expect.stringContaining('Reload the review'),
    });
  });

  it('pins staged rename and deletion bytes with diff-relative mapping', async () => {
    fs.mkdirSync(path.join(root, 'sub'));
    write('sub/old.png', original);
    git('add', 'sub/old.png');
    git('commit', '-qm', 'image');
    git('mv', 'sub/old.png', 'sub/new.png');
    const rename = await load(['--cached', '--relative'], path.join(root, 'sub'));
    expect(rename.diffData!.files[0].changeType).toBe('renamed');
    write('sub/new.png', mutated);
    git('add', 'sub/new.png');
    expect(await imageBytes(rename, 'new.png')).toEqual(original);
    git('rm', '-f', 'sub/new.png');
    fs.mkdirSync(path.join(root, 'sub'), { recursive: true });
    const deleted = await load(['--cached', '--relative'], path.join(root, 'sub'));
    expect(await imageBytes(deleted, 'old.png')).toEqual(original);
  });

  it('pins an unborn index without creating tree objects or refs', async () => {
    git('checkout', '--orphan', 'unborn');
    git('rm', '-rf', '.');
    write('image.png', original);
    git('add', 'image.png');
    const before = git('ls-files', '--stage');
    const refs = git('for-each-ref');
    const objects = git('count-objects', '-v');
    const session = await load(['--cached']);
    expect(git('ls-files', '--stage')).toBe(before);
    expect(git('for-each-ref')).toBe(refs);
    expect(git('count-objects', '-v')).toBe(objects);
    write('image.png', mutated);
    git('add', 'image.png');
    expect(await imageBytes(session)).toEqual(original);
  });

  it('keeps immutable commit previews and expansion after working files change', async () => {
    const base = git('rev-parse', 'HEAD');
    write('image.png', original);
    write('source.txt', 'top\nnew\nbottom\n');
    git('commit', '-qam', 'next');
    const session = await load([`${base}..HEAD`]);
    write('image.png', mutated);
    write('source.txt', 'unrelated\n');
    expect(await imageBytes(session)).toEqual(original);
    expect(await expandContext(session, request)).toMatchObject({ totalLines: 3 });
  });

  it.each(['working', 'index'])(
    'refuses %s drift before expansion without changing the loaded payload',
    async kind => {
      write('source.txt', 'top\nnew\nbottom\n');
      if (kind === 'index') git('add', 'source.txt');
      const session = await load(kind === 'index' ? ['--cached'] : []);
      const payload = session.diffData;
      write('source.txt', 'different\n');
      if (kind === 'index') git('add', 'source.txt');
      expect(await expandContext(session, request)).toBeNull();
      expect(session.diffData).toBe(payload);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Reload the review'));
    }
  );

  it('rejects drift during expansion and keeps context and line totals from one snapshot', async () => {
    write('source.txt', 'top\nnew\nbottom\n');
    const session = await load();
    const initial = await expandContext(session, request);
    expect(initial).toMatchObject({ totalLines: 3 });
    expect(initial!.hunks[0].lines.map(line => line.content)).toContain('new');
    const payload = session.diffData;
    expect(
      await expandContext(session, request, {
        runDiff: async (args, cwd, options) => {
          const raw = await runGitDiffAsync(args, cwd, undefined, options);
          write('source.txt', 'drift\nextra\nlines\nnow\n');
          return raw;
        },
        readContent: readReviewedContent,
        report: () => {},
      })
    ).toBeNull();
    expect(session.diffData).toBe(payload);
  });

  it.each(['working', 'index'])(
    'refuses %s changes between the diff read and load admission',
    async kind => {
      write('source.txt', 'top\nnew\nbottom\n');
      if (kind === 'index') git('add', 'source.txt');
      await expect(
        load(kind === 'index' ? ['--cached'] : [], root, {
          runner: async (command, args, options) => {
            const result = await defaultGitRunner(command, args, options);
            if (args.includes('diff')) {
              write('source.txt', 'post-diff\n');
              if (kind === 'index') git('add', 'source.txt');
            }
            return result;
          },
        })
      ).rejects.toThrow('Reload the review');
    }
  );

  it('rejects restage/restore cycles during loading even when final index OIDs match', async () => {
    write('image.png', original);
    git('add', 'image.png');
    await expect(
      load(['--cached'], root, {
        runner: async (command, args, options) => {
          if (!args.includes('diff')) return defaultGitRunner(command, args, options);
          write('image.png', mutated);
          git('add', 'image.png');
          const result = await defaultGitRunner(command, args, options);
          write('image.png', original);
          git('add', 'image.png');
          return result;
        },
      })
    ).rejects.toThrow('Reload the review');
  });

  it('rejects transient restaging during expansion without replacing admitted hunks', async () => {
    write('source.txt', 'top\nnew\nbottom\n');
    git('add', 'source.txt');
    const session = await load(['--cached']);
    const payload = session.diffData;
    expect(
      await expandContext(session, request, {
        async runDiff(args, cwd, options) {
          write('source.txt', 'transient\n');
          git('add', 'source.txt');
          const result = await runGitDiffAsync(args, cwd, undefined, options);
          write('source.txt', 'top\nnew\nbottom\n');
          git('add', 'source.txt');
          return result;
        },
        readContent: readReviewedContent,
        report: () => {},
      })
    ).toBeNull();
    expect(session.diffData).toBe(payload);
  });

  it('keeps payload and identity aliases and accepts old mutable injected identities', async () => {
    write('image.png', original);
    const session = await load();
    const payload = session.diffData!;
    const identity = session.sourceIdentity!;
    commitDiffData(session, payload, identity);
    expect(session.diffData).toBe(payload);
    expect(session.sourceIdentity).toBe(identity);
    identity.pathPrefix = 'changed';
    expect(await readReviewedContent(session, 'image.png', 'new')).toMatchObject({
      ok: false,
      reason: 'read-failed',
    });
    const legacy = { ...identity, pathPrefix: '' };
    commitDiffData(session, payload, legacy);
    write('image.png', mutated);
    expect(await imageBytes(session)).toEqual(mutated);
  });

  it('keeps committed Apply successful when ownership changes at rename and never replays', async () => {
    write('source.txt', 'top\nnew\nbottom\n');
    const session = await load();
    let renames = 0;
    const outcome = await applySuggestionForSessionAsync(
      session,
      {
        filePath: 'source.txt',
        lineRange: { side: 'new', start: 2, end: 2 },
        suggestion: { originalCode: 'new', proposedCode: 'applied' },
      },
      {
        fs: {
          ...nodeAsyncFsLayer,
          async rename(from, to) {
            await nodeAsyncFsLayer.rename(from, to);
            renames++;
            session.sourceIdentity = { ...session.sourceIdentity! };
          },
        },
      }
    );
    expect(outcome).toEqual({ status: 'applied', filePath: 'source.txt', replacedLines: 1 });
    expect(renames).toBe(1);
    expect(fs.readFileSync(path.join(root, 'source.txt'), 'utf8')).toBe('top\napplied\nbottom\n');
  });

  it('requires reload for physical reads after successful explicit Apply', async () => {
    write('source.txt', 'top\nnew\nbottom\n');
    const session = await load();
    expect(
      await applySuggestionForSessionAsync(session, {
        filePath: 'source.txt',
        lineRange: { side: 'new', start: 2, end: 2 },
        suggestion: { originalCode: 'new', proposedCode: 'applied' },
      })
    ).toMatchObject({ status: 'applied' });
    expect(await readReviewedContent(session, 'source.txt', 'new')).toMatchObject({
      ok: false,
      message: expect.stringContaining('Reload the review'),
    });
    expect(await expandContext(session, request)).toBeNull();
  });

  it('uses the picked-directory capture even when a descriptor changes during its read', async () => {
    write('source.txt', 'original\n');
    const options = {
      scanFs: {
        ...nodeScanFsLayer,
        async open(...args: Parameters<typeof nodeScanFsLayer.open>) {
          const handle = await nodeScanFsLayer.open(...args);
          return {
            stat: () => handle.stat(),
            close: () => handle.close(),
            async read(...input: Parameters<typeof handle.read>) {
              const result = await handle.read(...input);
              write('source.txt', 'mutation\n');
              return result;
            },
          };
        },
      },
    };
    await expect(
      prepareDirectoryReview(createReviewSession(), path.join(root, 'source.txt'), options)
    ).rejects.toThrow('Reload the review');
  });

  it('refuses physical drift during a lazy descriptor read', async () => {
    write('image.png', original);
    let changeOnRead = false;
    const scanFs = {
      ...nodeScanFsLayer,
      async open(...args: Parameters<typeof nodeScanFsLayer.open>) {
        const handle = await nodeScanFsLayer.open(...args);
        return {
          stat: () => handle.stat(),
          close: () => handle.close(),
          async read(...input: Parameters<typeof handle.read>) {
            const result = await handle.read(...input);
            if (changeOnRead) write('image.png', mutated);
            return result;
          },
        };
      },
    };
    const session = createReviewSession();
    const prepared = await prepareDirectoryReview(session, path.join(root, 'image.png'), {
      scanFs,
    });
    commitDiffData(session, prepared.payload, prepared.identity);
    changeOnRead = true;
    expect(await loadImage(session, 'image.png')).toEqual({
      error: expect.stringContaining('Reload the review'),
    });
  });

  it('does not merge hunks when line counting races another source edit', async () => {
    write('source.txt', 'top\nnew\nbottom\n');
    const session = await load();
    const payload = session.diffData;
    expect(
      await expandContext(session, request, {
        runDiff: (args, cwd, options) => runGitDiffAsync(args, cwd, undefined, options),
        async readContent(...args) {
          const result = await readReviewedContent(...args);
          write('source.txt', 'changed after count\n');
          return result;
        },
        report: () => {},
      })
    ).toBeNull();
    expect(session.diffData).toBe(payload);
  });

  it('reads the loaded side of a conflicted worktree and detects its later changes', async () => {
    git('checkout', '-qb', 'other');
    write('source.txt', 'other\n');
    git('commit', '-qam', 'other');
    git('checkout', '-q', 'main');
    write('source.txt', 'main\n');
    git('commit', '-qam', 'main');
    expect(() => git('merge', 'other')).toThrow();
    const session = await load(['--ours']);
    const bytes = fs.readFileSync(path.join(root, 'source.txt'));
    expect(await readReviewedContent(session, 'source.txt', 'new')).toEqual({
      ok: true,
      content: bytes,
    });
    write('source.txt', 'resolved\n');
    expect(await readReviewedContent(session, 'source.txt', 'new')).toMatchObject({
      ok: false,
      message: expect.stringContaining('Reload the review'),
    });
  });

  it('cancels capture before admission without committing partial data', async () => {
    const controller = new AbortController();
    controller.abort(new Error('stop'));
    await expect(load([], root, { signal: controller.signal })).rejects.toMatchObject({
      name: 'CommandCancelledError',
    });
  });
});
