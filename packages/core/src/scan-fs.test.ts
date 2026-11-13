import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { constants, Stats } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { scanDirectory, scanFile } from './directory-scanner';
import { prepareDirectoryReview } from './review-start';
import { createReviewSession, commitDiffData, commitLoadedReview } from './review-session';
import { loadLocalReview } from './startup';
import { readLoadedReviewContent } from './snapshot-reader';
import { loadedReviewIdentity } from './loaded-snapshot';
import { readReviewedContent } from './snapshot-reader';
import { expandContext } from './review-context';
import { loadGitDiffWithUntracked } from './git-diff-loader';
import { loadGitReviewSnapshot } from './loaded-git-review';
import type { SourceScanOptions, SourceScanResult } from './directory-scanner';
import type { ScanEntry, ScanFsLayer } from './scan-fs';
import type { BoundedAsyncReadFsLayer } from './safe-fs-read';
import { readContainedFileBounded } from './safe-fs-async';
import { generateSyntheticDiffsAsync } from './synthetic-diff';
import { readAssetFile, relocateAttachments } from './attachment-origins';
import type { AttachmentReadOptions } from './attachment-origins';
import { nodeFsLayer, type FsLayer } from './safe-fs';
import type { ReviewState } from './types';
import { MAX_IMAGE_BYTES } from './input-budgets';

const forbidHostRead = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('Host filesystem reads are forbidden in virtual adapter tests');
  })
);
vi.mock('fs/promises', async importOriginal => ({
  ...(await importOriginal<typeof import('fs/promises')>()),
  stat: forbidHostRead,
  lstat: forbidHostRead,
  realpath: forbidHostRead,
  opendir: forbidHostRead,
  open: forbidHostRead,
  readlink: forbidHostRead,
  readFile: forbidHostRead,
}));
vi.mock('fs', async importOriginal => ({
  ...(await importOriginal<typeof import('fs')>()),
  statSync: forbidHostRead,
  lstatSync: forbidHostRead,
  realpathSync: forbidHostRead,
  openSync: forbidHostRead,
  readSync: forbidHostRead,
  readlinkSync: forbidHostRead,
  readFileSync: forbidHostRead,
}));
afterEach(() => {
  const calls = forbidHostRead.mock.calls.slice();
  forbidHostRead.mockClear();
  expect(calls).toEqual([]);
});

const root = '/__self_review_virtual__';
const asset = join(root, '.self-review-assets/image.png');

// No host metadata or descriptors. Reads copy only the requested bytes from fixture storage.
function virtualFs(content: Record<string, Buffer | string>) {
  const files = new Map(
    Object.entries(content).map(([name, bytes]) => [join(root, name), Buffer.from(bytes)])
  );
  const directories = new Set(['/', root, join(root, 'output')]);
  for (const target of files.keys()) {
    for (let parent = dirname(target); parent.startsWith(root); parent = dirname(parent)) {
      directories.add(parent);
      if (parent === root) break;
    }
  }
  const links = new Map<string, string>();
  const identities = new Map<string, number>();
  const physical = (target: string): string => {
    for (const [link, destination] of links) {
      if (target === link || target.startsWith(`${link}/`))
        return destination + target.slice(link.length);
    }
    return target;
  };
  const stats = (target: string): Stats => {
    const kind = links.has(target)
      ? constants.S_IFLNK
      : directories.has(target)
        ? constants.S_IFDIR
        : constants.S_IFREG;
    if (!links.has(target) && !directories.has(target) && !files.has(target)) {
      throw Object.assign(new Error(`missing ${target}`), { code: 'ENOENT' });
    }
    if (!identities.has(target)) identities.set(target, identities.size + 1);
    return Object.assign(Object.create(Stats.prototype) as Stats, {
      mode: kind | 0o644,
      dev: 1,
      ino: identities.get(target),
      size: files.get(target)?.length ?? links.get(target)?.length ?? 0,
    });
  };
  const closes: ReturnType<typeof vi.fn>[] = [];
  const directoryCloses: ReturnType<typeof vi.fn>[] = [];
  const reads = vi.fn((_target: string, _length: number) => {});
  const layer: ScanFsLayer = {
    readAllocation: 'bounded',
    stat: vi.fn(async target => stats(physical(target))),
    lstat: vi.fn(async target => stats(target)),
    realpath: vi.fn(async target => {
      stats(physical(target));
      return physical(target);
    }),
    readlink: vi.fn(async target => Buffer.from(links.get(target)!)),
    open: vi.fn(async (target, flags) => {
      if (links.has(target) && flags & constants.O_NOFOLLOW) {
        throw Object.assign(new Error('link refused'), { code: 'ELOOP' });
      }
      const name = physical(target);
      const opened = stats(name);
      const close = vi.fn(async () => {});
      closes.push(close);
      let cursor = 0;
      return {
        stat: async () => opened,
        close,
        async read(buffer: Buffer, offset: number, length: number, position: number | null) {
          const bytes = files.get(name)!;
          const start = position ?? cursor;
          const bytesRead = bytes.copy(
            buffer,
            offset,
            start,
            Math.min(start + length, bytes.length)
          );
          if (position === null) cursor += bytesRead;
          reads(name, length);
          return { bytesRead };
        },
      };
    }),
    opendir: vi.fn(async target => {
      const close = vi.fn(async () => {});
      directoryCloses.push(close);
      const entries: ScanEntry[] = [...directories, ...files.keys(), ...links.keys()]
        .filter(name => name !== target && dirname(name) === target)
        .map(name => ({
          name: relative(target, name),
          isDirectory: () => directories.has(name),
          isFile: () => files.has(name),
        }));
      return {
        close,
        async *[Symbol.asyncIterator]() {
          yield* entries;
        },
      };
    }),
  };
  // Deliberately supplies no write, chmod, unlink, rename, stat, readlink or opendir capability.
  const readFs: BoundedAsyncReadFsLayer = {
    readAllocation: 'bounded',
    open: (...args) => layer.open(...args),
    lstat: target => layer.lstat(target),
    realpath: target => layer.realpath(target),
  };
  return { layer, readFs, files, directories, links, stats, closes, directoryCloses, reads };
}

function state(): ReviewState {
  return {
    timestamp: '2026-10-02T00:00:00.000Z',
    source: { type: 'directory', sourcePath: root },
    files: [
      {
        path: 'a.ts',
        changeType: 'added',
        viewed: false,
        comments: [
          {
            id: 'comment',
            filePath: 'a.ts',
            body: 'look',
            category: 'note',
            lineRange: null,
            suggestion: null,
            attachments: [
              { id: 'asset', fileName: '.self-review-assets/image.png', mediaType: 'image/png' },
            ],
          },
        ],
      },
    ],
  };
}

describe('injected scan and attachment reads', () => {
  it('preserves old option declarations and asynchronous scan call forms', () => {
    expectTypeOf<AttachmentReadOptions['fs']>().toEqualTypeOf<FsLayer | undefined>();
    const oldOptions: SourceScanOptions = { budgets: { maxEntries: 10 } };
    expect(oldOptions.scanFs).toBeUndefined();
    expectTypeOf<ReturnType<typeof scanFile>>().toEqualTypeOf<Promise<SourceScanResult>>();
  });

  it('uses one virtual filesystem for root resolution, pruning, inspection and content', async () => {
    const v = virtualFs({ 'z.txt': 'z\n', 'sub/a.txt': 'a\n', 'ignored/secret': 'secret' });
    v.links.set('/virtual-alias', root);
    const result = await scanDirectory('/virtual-alias', ['ignored/', 'output/'], {
      scanFs: v.layer,
    });
    expect(result.diagnostics).toEqual([]);
    expect(result.files.map(file => file.newPath)).toEqual(['sub/a.txt', 'z.txt']);
    expect(result.files[0].hunks[0].lines[0].content).toBe('a');
    expect(vi.mocked(v.layer.opendir).mock.calls.map(([target]) => target)).toEqual([
      root,
      join(root, 'sub'),
    ]);
    expect(v.directoryCloses.every(close => close.mock.calls.length === 1)).toBe(true);
    expect(v.closes).toHaveLength(2);
    expect(v.closes.every(close => close.mock.calls.length === 1)).toBe(true);
  });

  it('retains explicitly selected file symlinks and synthetic link text', async () => {
    const v = virtualFs({ 'a.txt': 'inside\n' });
    v.links.set(join(root, 'link'), join(root, 'a.txt'));
    const result = await scanFile(join(root, 'link'), { scanFs: v.layer });
    expect(result.files[0].hunks[0].lines[0].content).toBe('inside');
    const patch = await generateSyntheticDiffsAsync(['link'], root, { readFs: v.layer });
    expect(patch.diff).toContain(`+${join(root, 'a.txt')}`);
    expect(v.layer.readlink).toHaveBeenCalledWith(join(root, 'link'));
  });

  it.each(['entry-budget', 'abort', 'iterator-error', 'identity-race'] as const)(
    'closes directory handles on %s',
    async mode => {
      const v = virtualFs({ 'a.txt': 'a', 'b.txt': 'b' });
      const controller = new AbortController();
      const opendir = v.layer.opendir;
      v.layer.opendir = async target => {
        const directory = await opendir(target);
        if (mode === 'abort') controller.abort(new Error('stop traversal'));
        if (mode === 'identity-race') {
          const lstat = v.layer.lstat;
          v.layer.lstat = async path => Object.assign(await lstat(path), { ino: 999 });
        }
        if (mode === 'iterator-error')
          return {
            close: () => directory.close(),
            async *[Symbol.asyncIterator](): AsyncGenerator<ScanEntry> {
              yield* [];
              throw new Error('iteration failed');
            },
          };
        return directory;
      };
      const work = scanDirectory(root, [], {
        scanFs: v.layer,
        signal: controller.signal,
        budgets: { maxEntries: mode === 'entry-budget' ? 1 : 100 },
        reportDiagnostic: vi.fn(),
      });
      if (mode === 'abort')
        await expect(work).rejects.toMatchObject({ name: 'CommandCancelledError' });
      else {
        const result = await work;
        expect(result.files).toEqual([]);
        expect(result.entryLimitExceeded).toBe(mode === 'entry-budget');
        if (mode === 'iterator-error')
          expect(result.diagnostics.join()).toContain('iteration failed');
        if (mode === 'identity-race')
          expect(result.diagnostics.join()).toContain('changed while opening');
      }
      expect(v.directoryCloses).toHaveLength(1);
      expect(v.directoryCloses[0]).toHaveBeenCalledOnce();
      expect(v.closes).toEqual([]);
    }
  );

  it('cancels a large source between chunks and closes its descriptor', async () => {
    const v = virtualFs({ 'large.txt': Buffer.alloc(500_000, 'a') });
    const controller = new AbortController();
    v.reads
      .mockImplementationOnce(() => {})
      .mockImplementationOnce(() => controller.abort(new Error('stop content')));
    await expect(
      scanDirectory(root, [], { scanFs: v.layer, signal: controller.signal })
    ).rejects.toMatchObject({ name: 'CommandCancelledError' });
    expect(v.reads).toHaveBeenCalledTimes(2);
    expect(v.reads.mock.calls.every(([, length]) => length <= 64 * 1024)).toBe(true);
    expect(v.closes[0]).toHaveBeenCalledOnce();
    expect(v.directoryCloses.every(close => close.mock.calls.length === 1)).toBe(true);
  });

  it('reads and relocates attachments with only a bounded read capability', async () => {
    const v = virtualFs({ '.self-review-assets/image.png': 'image' });
    const result = await readAssetFile(asset, { readFs: v.readFs });
    expect(result.ok && Buffer.from(result.data).toString()).toBe('image');
    const relocated = await relocateAttachments(
      state(),
      new Map([['.self-review-assets/image.png', asset]]),
      join(root, 'output/review.xml'),
      { readFs: v.readFs, fs: nodeFsLayer }
    );
    expect(Buffer.from(relocated.files[0].comments[0].attachments![0].data!).toString()).toBe(
      'image'
    );
    expect(v.layer.realpath).toHaveBeenCalledWith(join(root, 'output'));
    expect(v.closes.every(close => close.mock.calls.length === 1)).toBe(true);
  });

  it('lets cancellation win when relocation root resolution also fails', async () => {
    const v = virtualFs({ '.self-review-assets/image.png': 'image' });
    const controller = new AbortController();
    const reason = new Error('cancel relocation');
    v.layer.realpath = async () => {
      controller.abort(reason);
      throw new Error('resolution failed');
    };
    await expect(
      relocateAttachments(
        state(),
        new Map([['.self-review-assets/image.png', asset]]),
        join(root, 'output/review.xml'),
        { readFs: v.readFs, signal: controller.signal }
      )
    ).rejects.toBe(reason);
    expect(v.layer.open).not.toHaveBeenCalled();
  });

  it('observes cancellation after the contained reader closes', async () => {
    const v = virtualFs({ '.self-review-assets/image.png': 'image' });
    const controller = new AbortController();
    const reason = new Error('cancel during close');
    const open = v.layer.open;
    v.layer.open = async (...args) => {
      const handle = await open(...args);
      return {
        ...handle,
        close: async () => {
          await handle.close();
          controller.abort(reason);
        },
      };
    };
    await expect(
      readContainedFileBounded(
        root,
        '.self-review-assets/image.png',
        20,
        v.readFs,
        controller.signal
      )
    ).rejects.toBe(reason);
    expect(v.closes[0]).toHaveBeenCalledOnce();
  });

  it.each(['read', 'close'] as const)(
    'preserves attachment cancellation during %s',
    async phase => {
      const v = virtualFs({ '.self-review-assets/image.png': Buffer.alloc(500_000) });
      const controller = new AbortController();
      const reason = new Error('cancel asset');
      if (phase === 'read') v.reads.mockImplementationOnce(() => controller.abort(reason));
      else {
        const open = v.layer.open;
        v.layer.open = async (...args) => {
          const handle = await open(...args);
          return {
            ...handle,
            close: async () => {
              await handle.close();
              controller.abort(reason);
            },
          };
        };
      }
      await expect(
        readAssetFile(asset, { readFs: v.readFs, signal: controller.signal })
      ).rejects.toBe(reason);
      expect(v.closes[0]).toHaveBeenCalledOnce();
      if (phase === 'read') expect(v.reads).toHaveBeenCalledOnce();
    }
  );

  it('preserves per-asset and aggregate relocation limits on the narrow adapter', async () => {
    const v = virtualFs({ '.self-review-assets/image.png': 'image' });
    v.files.set(asset, Buffer.alloc(MAX_IMAGE_BYTES + 1));
    expect(await readAssetFile(asset, { readFs: v.readFs })).toMatchObject({
      ok: false,
      reason: 'too-large',
    });
    expect(v.reads).not.toHaveBeenCalled();
    const review = state();
    const origins = new Map<string, string>();
    const bytes = Buffer.alloc(MAX_IMAGE_BYTES);
    review.files[0].comments[0].attachments = Array.from({ length: 7 }, (_, index) => {
      const fileName = `.self-review-assets/image-${index}.png`;
      const origin = join(root, fileName);
      v.files.set(origin, bytes);
      origins.set(fileName, origin);
      return { id: String(index), fileName, mediaType: 'image/png' };
    });
    await expect(
      relocateAttachments(review, origins, join(root, 'output/review.xml'), { readFs: v.readFs })
    ).rejects.toMatchObject({
      name: 'AttachmentRelocationError',
      reason: 'too-large',
      reference: '.self-review-assets/image-6.png',
    });
    expect(v.reads.mock.calls.some(([name]) => name.endsWith('image-6.png'))).toBe(false);
    expect(v.closes.every(close => close.mock.calls.length === 1)).toBe(true);
  });

  it('bounds assets before reading and preserves missing/link/identity failure results', async () => {
    const v = virtualFs({ '.self-review-assets/image.png': 'image' });
    expect(await readAssetFile(asset, { readFs: v.readFs, maxBytes: 2 })).toMatchObject({
      ok: false,
      reason: 'too-large',
    });
    expect(v.reads).not.toHaveBeenCalled();
    expect(v.closes[0]).toHaveBeenCalledOnce();
    expect(
      await readAssetFile(join(root, '.self-review-assets/missing'), { readFs: v.readFs })
    ).toMatchObject({ ok: false, reason: 'not-found' });
    v.links.set(join(root, '.self-review-assets'), join(root, 'output'));
    expect(await readAssetFile(asset, { readFs: v.readFs })).toMatchObject({
      ok: false,
      reason: 'unsafe-link',
    });
    v.links.clear();
    v.layer.lstat = async target => Object.assign(v.stats(target), { ino: 999 });
    expect(await readAssetFile(asset, { readFs: v.readFs })).toMatchObject({
      ok: false,
      reason: 'unsafe-link',
    });
    expect(v.closes.at(-1)).toHaveBeenCalledOnce();
  });
});

it('keeps lazy reads on the supplied filesystem and refuses its changed snapshot', async () => {
  const virtual = virtualFs({ 'image.png': Buffer.from([0, 0xff, 0x80]) });
  const session = createReviewSession();
  const result = await prepareDirectoryReview(session, root, { scanFs: virtual.layer });
  commitDiffData(session, result.payload, result.identity);
  expect(await readReviewedContent(session, 'image.png', 'new')).toEqual({
    ok: true,
    content: Buffer.from([0, 0xff, 0x80]),
  });
  virtual.files.set(join(root, 'image.png'), Buffer.from([0, 0xfe, 0x80, 1]));
  expect(await readReviewedContent(session, 'image.png', 'new')).toMatchObject({
    ok: false,
    reason: 'read-failed',
    message: expect.stringContaining('Reload the review'),
  });
  expect(virtual.closes.every(close => close.mock.calls.length === 1)).toBe(true);
});

it('captures git reads with supplied text, binary and filesystem dependencies only', async () => {
  const bytes = Buffer.from([0, 0xff, 0x80]);
  const virtual = virtualFs({ 'image.png': bytes, '.git/index': 'virtual index' });
  const oid = 'a'.repeat(40);
  const binaryRunner = vi.fn(async () => ({ stdout: bytes, stderr: Buffer.alloc(0), exitCode: 0 }));
  const result = await loadGitReviewSnapshot(
    [],
    root,
    {
      runner: async (_command, args) => {
        if (args.includes('--name-status'))
          return { stdout: 'M\0image.png\0', stderr: '', exitCode: 0 };
        if (args[0] === 'ls-files')
          return { stdout: `100644 ${oid} 0\timage.png\0`, stderr: '', exitCode: 0 };
        if (args[0] === 'rev-parse')
          return {
            stdout: args.includes('--git-path') ? join(root, '.git/index') + '\n' : root + '\n',
            stderr: '',
            exitCode: 0,
          };
        throw new Error('Unexpected git command');
      },
      snapshotRunner: binaryRunner,
    },
    {
      readFs: virtual.readFs,
      async loadDiff() {
        return {
          files: [
            {
              oldPath: 'image.png',
              newPath: 'image.png',
              changeType: 'modified',
              hunks: [],
              isBinary: true,
            },
          ],
          repository: root,
          diagnostics: [],
          identity: {
            mode: 'git',
            sourceRoot: root,
            invocationCwd: root,
            gitDiffArgv: [],
            pathPrefix: '',
            oldSide: { kind: 'index' },
            newSide: { kind: 'working-tree' },
          },
        };
      },
    }
  );
  const session = createReviewSession();
  commitDiffData(
    session,
    { files: result.files, source: { type: 'git', repository: root, gitDiffArgs: '' } },
    result.identity
  );
  expect(await readReviewedContent(session, 'image.png', 'old')).toEqual({
    ok: true,
    content: bytes,
  });
  expect(binaryRunner).toHaveBeenCalledWith('git', ['cat-file', 'blob', oid], expect.any(Object));
  expect(await readReviewedContent(session, 'image.png', 'new')).toEqual({
    ok: true,
    content: bytes,
  });
  virtual.files.set(join(root, 'image.png'), Buffer.from([0, 1, 2, 3]));
  expect(await readReviewedContent(session, 'image.png', 'new')).toMatchObject({
    ok: false,
    reason: 'read-failed',
  });
});

it.each(['directory', 'file'] as const)(
  'loads a supplied %s source with its own paths, bytes and receiver',
  async mode => {
    const bytes = Buffer.from([0, 0xff, 0x80]);
    const virtual = virtualFs({ 'image.png': bytes, 'ignored/secret': 'hidden' });
    virtual.links.set('/virtual-alias', root);
    const receiver: ScanFsLayer = {
      readAllocation: 'bounded',
      async stat(target) {
        expect(this).toBe(receiver);
        return virtual.layer.stat(target);
      },
      async realpath(target) {
        expect(this).toBe(receiver);
        return virtual.layer.realpath(target);
      },
      async lstat(target) {
        expect(this).toBe(receiver);
        return virtual.layer.lstat(target);
      },
      async open(...args) {
        expect(this).toBe(receiver);
        return virtual.layer.open(...args);
      },
      async opendir(target) {
        expect(this).toBe(receiver);
        return virtual.layer.opendir(target);
      },
      async readlink(target) {
        expect(this).toBe(receiver);
        return virtual.layer.readlink(target);
      },
    };
    const loaded = await loadLocalReview(
      { mode, sourcePath: mode === 'file' ? '/virtual-alias/image.png' : '/virtual-alias' },
      [],
      { ignore: ['ignored/'] },
      '/virtual-launch',
      () => {},
      {},
      { scanFs: receiver }
    );
    expect(loaded.identity).toMatchObject({ sourceRoot: root, invocationCwd: '/virtual-launch' });
    expect(loaded.payload.files.map(file => file.newPath)).toEqual(['image.png']);
    expect(loaded.loadedReview).toBeDefined();
    expect(loadedReviewIdentity(loaded.loadedReview!)).toBe(loaded.identity);
    const session = createReviewSession();
    commitLoadedReview(session, loaded.payload, loaded.loadedReview!);
    expect(session.diffData).toBe(loaded.payload);
    expect(session.sourceIdentity).toBe(loaded.identity);
    expect(await readLoadedReviewContent(loaded.loadedReview!, 'image.png', 'new')).toEqual({
      ok: true,
      content: bytes,
    });
    virtual.files.set(join(root, 'image.png'), Buffer.from([0, 1, 2, 3]));
    expect(await readReviewedContent(session, 'image.png', 'new')).toMatchObject({
      ok: false,
      reason: 'read-failed',
    });
    expect(virtual.closes.every(close => close.mock.calls.length === 1)).toBe(true);
  }
);

it('retains supplied local source budgets and closes on cancellation before capture admission', async () => {
  const virtual = virtualFs({ 'image.png': Buffer.alloc(500_000, 1), 'later.txt': 'later' });
  const limited = await loadLocalReview(
    { mode: 'directory', sourcePath: root },
    [],
    { ignore: [] },
    root,
    () => {},
    { budgets: { maxFileBytes: 10 } },
    { scanFs: virtual.layer }
  );
  expect(limited.payload.files[0].omittedReason).toContain('per-file read budget');
  expect(virtual.reads).toHaveBeenCalledWith(join(root, 'image.png'), expect.any(Number));
  const controller = new AbortController();
  virtual.reads.mockImplementation(() => controller.abort(new Error('stop')));
  await expect(
    loadLocalReview(
      { mode: 'directory', sourcePath: root },
      [],
      { ignore: [] },
      root,
      () => {},
      { signal: controller.signal },
      { scanFs: virtual.layer }
    )
  ).rejects.toMatchObject({ name: 'CommandCancelledError' });
  expect(virtual.closes.every(close => close.mock.calls.length === 1)).toBe(true);
});

it('runs the standard git loader, untracked projection and captured expansion with supplied effects only', async () => {
  const bytes = Buffer.from('top\nnew\nbottom\n');
  const virtual = virtualFs({
    'source.txt': bytes,
    'untracked.txt': 'untracked\n',
    '.git/index': 'index',
  });
  const oid = 'a'.repeat(40);
  const patch =
    'diff --git a/source.txt b/source.txt\n--- a/source.txt\n+++ b/source.txt\n@@ -1,3 +1,3 @@\n top\n-old\n+new\n bottom\n';
  const runner = vi.fn(async (_command: string, args: readonly string[]) => {
    let stdout: string;
    if (args[0] === 'rev-parse')
      stdout = args.includes('--git-path') ? join(root, '.git/index') + '\n' : root + '\n';
    else if (args[0] === 'ls-files')
      stdout = args.includes('--stage') ? `100644 ${oid} 0\tsource.txt\0` : 'untracked.txt\0';
    else if (args.includes('--name-status')) stdout = 'M\0source.txt\0';
    else if (args.includes('diff')) stdout = patch;
    else throw new Error(`Unexpected supplied git command ${args.join(' ')}`);
    return { stdout, stderr: '', exitCode: 0 };
  });
  const blobRunner = vi.fn(async () => ({ stdout: bytes, stderr: Buffer.alloc(0), exitCode: 0 }));
  const loaded = await loadLocalReview(
    { mode: 'git' },
    [],
    { ignore: [] },
    root,
    () => {},
    { runner, snapshotRunner: blobRunner },
    {
      gitSnapshot: {
        readFs: virtual.readFs,
        sourceFs: virtual.layer,
        loadDiff: loadGitDiffWithUntracked,
      },
    }
  );
  expect(loaded.payload.files.map(file => file.newPath)).toEqual(['source.txt', 'untracked.txt']);
  const session = createReviewSession();
  commitLoadedReview(session, loaded.payload, loaded.loadedReview!);
  expect(await readReviewedContent(session, 'untracked.txt', 'new')).toEqual({
    ok: true,
    content: Buffer.from('untracked\n'),
  });
  expect(await readReviewedContent(session, 'source.txt', 'old')).toEqual({
    ok: true,
    content: bytes,
  });
  expect(await expandContext(session, { filePath: 'source.txt', contextLines: 20 })).toMatchObject({
    totalLines: 3,
  });
  expect(runner).toHaveBeenCalledWith('git', expect.arrayContaining(['-U20']), expect.any(Object));
  expect(blobRunner).toHaveBeenCalledWith('git', ['cat-file', 'blob', oid], expect.any(Object));
  expect(virtual.closes.every(close => close.mock.calls.length === 1)).toBe(true);
});
