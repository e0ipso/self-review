import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  openContainedFileAsync,
  readContainedFileAsync,
  readContainedFileBounded,
} from './safe-fs-async';
import { boundedReadFsFromSync, nodeReadFsLayer } from './safe-fs-read';
import type { AsyncReadFsLayer, BoundedAsyncReadFsLayer, SyncReadFsLayer } from './safe-fs-read';
import { asyncFsFromSync } from './safe-fs-async';
import { nodeFsLayer, readContainedFile } from './safe-fs';
import type { AsyncFileHandle } from './safe-fs-async';

const roots: string[] = [];
function realRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-read-facets-'));
  roots.push(root);
  return root;
}
afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

// Metadata comes from a real regular file; every subsequent operation uses a virtual descriptor.
function virtualReadFs(bytes: Buffer, advertisedSize = bytes.length) {
  const root = realRoot();
  fs.writeFileSync(path.join(root, 'metadata'), bytes);
  const stats = fs.statSync(path.join(root, 'metadata'));
  stats.size = advertisedSize;
  let offset = 0;
  const close = vi.fn();
  const readSync = vi.fn(
    (fd: number, target: Uint8Array, at: number, length: number, position: number | null) => {
      expect(fd).toBe(987654321);
      const start = position ?? offset;
      const count = bytes.copy(target, at, start, Math.min(start + length, bytes.length));
      if (position === null) offset += count;
      return count;
    }
  );
  const layer: SyncReadFsLayer = {
    openSync: vi.fn(() => 987654321),
    fstatSync: () => stats,
    lstatSync: () => stats,
    realpathSync: target => target,
    closeSync: close,
    readSync,
  };
  return { layer, close, readSync };
}

describe('read-only filesystem capabilities', () => {
  it('retains the full handle in the existing reflected return type', () => {
    expectTypeOf<
      Awaited<ReturnType<typeof openContainedFileAsync>>['handle']
    >().toEqualTypeOf<AsyncFileHandle>();
  });

  it('reads real files using only a read handle and retains its caller-owned close', async () => {
    const root = realRoot();
    fs.writeFileSync(path.join(root, 'file'), 'é中\n');
    const layer: AsyncReadFsLayer = {
      open: async (...args) => {
        const handle = await nodeReadFsLayer.open(...args);
        return {
          stat: () => handle.stat(),
          read: (...readArgs) => handle.read(...readArgs),
          close: () => handle.close(),
        };
      },
      lstat: target => nodeReadFsLayer.lstat(target),
      realpath: target => nodeReadFsLayer.realpath(target),
    };
    expect((await readContainedFileAsync(root, 'file', 20, layer)).toString()).toBe('é中\n');
    const opened = await openContainedFileAsync(root, 'file', layer);
    expect(opened.stats.isFile()).toBe(true);
    await opened.handle.close();
  });

  it('bounds allocations and chunks over virtual descriptors without host-fs fallback', async () => {
    const content = Buffer.alloc(150_000, 'x');
    const { layer, close, readSync } = virtualReadFs(content);
    expect(
      await readContainedFileBounded(
        '/virtual',
        'file',
        content.length,
        boundedReadFsFromSync(layer)
      )
    ).toEqual(content);
    expect(readSync.mock.calls.every(([, , , length]) => length <= 64 * 1024)).toBe(true);
    expect(close).toHaveBeenCalledExactlyOnceWith(987654321);
  });

  it('refuses a file that grows beyond its budget and closes the read handle', async () => {
    const { layer, close } = virtualReadFs(Buffer.from('too much'), 1);
    await expect(
      readContainedFileBounded('/virtual', 'file', 3, boundedReadFsFromSync(layer))
    ).rejects.toMatchObject({ code: 'too-large' });
    expect(close).toHaveBeenCalledOnce();
  });

  it('observes cancellation between chunks and closes the read handle', async () => {
    const { layer, close, readSync } = virtualReadFs(Buffer.alloc(150_000));
    const controller = new AbortController();
    const original = layer.readSync;
    layer.readSync = (...args) => {
      const count = original(...args);
      controller.abort(new Error('stop reading'));
      return count;
    };
    await expect(
      readContainedFileBounded(
        '/virtual',
        'file',
        150_000,
        boundedReadFsFromSync(layer, controller.signal),
        controller.signal
      )
    ).rejects.toThrow('stop reading');
    expect(readSync).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it.each(['leaf-link', 'ancestor-link', 'escape', 'fifo'])(
    'preserves no-follow refusals for %s',
    async kind => {
      const root = realRoot();
      fs.mkdirSync(path.join(root, 'sub'));
      fs.writeFileSync(path.join(root, 'sub', 'file'), 'keep');
      let rel = 'file';
      if (kind === 'leaf-link')
        fs.symlinkSync(path.join(root, 'sub', 'file'), path.join(root, 'file'));
      if (kind === 'ancestor-link') {
        fs.symlinkSync(path.join(root, 'sub'), path.join(root, 'link'));
        rel = 'link/file';
      }
      if (kind === 'escape') rel = '../file';
      if (kind === 'fifo') {
        const { execFileSync } = await import('node:child_process');
        execFileSync('mkfifo', [path.join(root, 'file')]);
      }
      await expect(readContainedFileBounded(root, rel, 10)).rejects.toMatchObject({
        code:
          kind === 'escape'
            ? 'unsupported-target'
            : kind === 'fifo'
              ? 'not-regular'
              : 'unsafe-link',
      });
    }
  );

  it('keeps legacy whole-file adapters usable without claiming bounded allocation', async () => {
    const root = realRoot();
    fs.writeFileSync(path.join(root, 'file'), 'legacy');
    const readFileSync = vi.fn(nodeFsLayer.readFileSync);
    const legacy = { ...nodeFsLayer, readSync: undefined, readFileSync };
    const compatibility = asyncFsFromSync(legacy);
    // @ts-expect-error Compatibility does not promise bounded read allocation.
    const bounded: BoundedAsyncReadFsLayer = compatibility;
    expect(bounded).toBe(compatibility);
    expect((await readContainedFile(root, 'file', 10, { fs: legacy })).toString()).toBe('legacy');
    expect(readFileSync).toHaveBeenCalledOnce();
  });
});
