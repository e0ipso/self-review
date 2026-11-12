import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { constants, Stats } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { scanDirectory, scanFile } from './directory-scanner';
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
  const directories = new Set([root, join(root, 'output')]);
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
