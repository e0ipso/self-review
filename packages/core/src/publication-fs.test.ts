import { afterEach, describe, expect, it, vi } from 'vitest';
import { constants, Stats } from 'node:fs';
import type { FsLayer } from './safe-fs';
import { asyncFsFromSync } from './safe-fs-async';
import { inspectOutputPath, publishReview } from './review-publisher';
import type { PublicationFileSystem } from './publication-fs';
import type { ReviewState } from './types';

const root = '/__publication_memory__';
const output = `${root}/review.xml`;
const origin = `${root}/old/.self-review-assets/image.png`;

function memoryFs() {
  type Entry = { ino: number; mode: number; bytes: Buffer; uid: number; nlink: number };
  const entries = new Map<string, Entry>();
  const handles = new Map<number, { entry: Entry; cursor: number }>();
  const add = (name: string, mode: number, bytes = Buffer.alloc(0)): Entry => {
    const entry = { ino: entries.size + 1, mode, bytes, uid: process.getuid?.() ?? 0, nlink: 1 };
    entries.set(name, entry);
    return entry;
  };
  const error = (code: string) => Object.assign(new Error(code), { code });
  const entry = (name: string) => {
    const value = entries.get(name);
    if (!value) throw error('ENOENT');
    return value;
  };
  const stats = (value: Entry): Stats =>
    Object.assign(Object.create(Stats.prototype) as Stats, {
      ...value,
      dev: 1,
      gid: 0,
      size: value.bytes.length,
      mtimeMs: 1,
    });
  for (const name of [root, `${root}/old`, `${root}/old/.self-review-assets`])
    add(name, constants.S_IFDIR | 0o755);
  add(origin, constants.S_IFREG | 0o644, Buffer.alloc(150_000, 7));
  const reads: number[] = [];
  const writes: number[] = [];
  let nextFd = 100_000;
  const layer: FsLayer = {
    lstatSync: name => stats(entry(name)),
    realpathSync(name) {
      entry(name);
      return name;
    },
    mkdirSync(name, mode) {
      add(name, constants.S_IFDIR | mode);
    },
    openSync(name, flags, mode) {
      if (entries.has(name) && flags & constants.O_EXCL) throw error('EEXIST');
      if (!entries.has(name) && flags & constants.O_CREAT)
        add(name, constants.S_IFREG | (mode ?? 0o644));
      const value = entry(name);
      if ((value.mode & constants.S_IFMT) === constants.S_IFLNK) throw error('ELOOP');
      const fd = nextFd++;
      handles.set(fd, { entry: value, cursor: 0 });
      return fd;
    },
    fstatSync: fd => stats(handles.get(fd)!.entry),
    closeSync(fd) {
      handles.delete(fd);
    },
    readSync(fd, buffer, offset, length, position) {
      reads.push(length);
      const handle = handles.get(fd)!;
      const start = position ?? handle.cursor;
      const count = handle.entry.bytes.copy(buffer, offset, start, start + length);
      if (position === null) handle.cursor += count;
      return count;
    },
    readFileSync(fd) {
      return Buffer.from(handles.get(fd)!.entry.bytes);
    },
    writeSync(fd, buffer) {
      writes.push(buffer.length);
      const handle = handles.get(fd)!;
      const count = Math.min(buffer.length, 10_000);
      handle.entry.bytes = Buffer.concat([handle.entry.bytes, buffer.subarray(0, count)]);
      return count;
    },
    fchmodSync(fd, mode) {
      const e = handles.get(fd)!.entry;
      e.mode = (e.mode & constants.S_IFMT) | mode;
    },
    fchownSync(fd, uid) {
      handles.get(fd)!.entry.uid = uid;
    },
    fsyncSync() {},
    renameSync(from, to) {
      entries.set(to, entry(from));
      entries.delete(from);
    },
    unlinkSync(name) {
      entries.delete(name);
    },
  };
  const publicationFs: PublicationFileSystem = {
    inspection: layer,
    files: asyncFsFromSync(layer),
    mkdir: async (name, mode) => layer.mkdirSync(name, mode),
    currentUid: () => process.getuid?.(),
  };
  return { layer, publicationFs, entries, reads, writes, handles };
}

function review(): ReviewState {
  return {
    timestamp: '2026-01-01T00:00:00Z',
    source: { type: 'welcome' },
    files: [
      {
        path: 'file',
        changeType: 'added',
        viewed: true,
        comments: [
          {
            id: 'c1',
            filePath: 'file',
            lineRange: null,
            category: 'bug',
            body: 'check',
            suggestion: null,
            attachments: [
              { id: 'a1', fileName: '.self-review-assets/image.png', mediaType: 'image/png' },
            ],
          },
        ],
      },
    ],
  };
}
const origins = new Map([['.self-review-assets/image.png', origin]]);
afterEach(() => vi.restoreAllMocks());

describe('explicit publication filesystem', () => {
  it('uses virtual metadata, descriptors and writes even when a conflicting legacy fs is supplied', async () => {
    const v = memoryFs();
    const forbidden = vi.fn(() => {
      throw new Error('legacy provider consulted');
    });
    const legacy = new Proxy(v.layer, { get: forbidden });
    const options = {
      outputOrigin: 'inherited' as const,
      baseDir: root,
      publicationFs: v.publicationFs,
      fs: legacy,
      attachmentOrigins: origins,
      reportDiagnostic: vi.fn(),
    };
    expect(inspectOutputPath(output, options)).toBeNull();
    const result = await publishReview(review(), output, options);
    expect(v.entries.get(output)!.bytes.toString()).toContain('</review>');
    expect(v.entries.get(result.assetPaths[0])!.bytes).toEqual(v.entries.get(origin)!.bytes);
    expect(Math.max(...v.reads)).toBeLessThanOrEqual(64 * 1024);
    expect(Math.max(...v.writes)).toBeLessThanOrEqual(64 * 1024);
    expect(v.handles.size).toBe(0);
    expect(forbidden).not.toHaveBeenCalled();
  });

  it.each(['abort', 'rename-failure'] as const)(
    'rolls back only staged virtual assets on %s',
    async mode => {
      const v = memoryFs();
      const first = await publishReview(review(), output, {
        outputOrigin: 'explicit',
        publicationFs: v.publicationFs,
        attachmentOrigins: origins,
        reportDiagnostic: vi.fn(),
      });
      const oldXml = Buffer.from(v.entries.get(output)!.bytes);
      const controller = new AbortController();
      const files = v.publicationFs.files;
      v.publicationFs.files = {
        ...files,
        async rename(from, to) {
          if (mode === 'rename-failure') throw new Error('rename denied');
          return files.rename(from, to);
        },
        async open(...args) {
          const handle = await files.open(...args);
          const sync = handle.sync.bind(handle);
          handle.sync = async () => {
            await sync();
            if (mode === 'abort' && args[0].endsWith('.tmp')) controller.abort('cancel');
          };
          return handle;
        },
      };
      await expect(
        publishReview(review(), output, {
          outputOrigin: 'explicit',
          publicationFs: v.publicationFs,
          attachmentOrigins: origins,
          signal: controller.signal,
          reportDiagnostic: vi.fn(),
        })
      ).rejects.toMatchObject({ code: 'io-error' });
      expect(v.entries.get(output)!.bytes).toEqual(oldXml);
      expect(
        [...v.entries.keys()].filter(name => name.startsWith(`${root}/.self-review-assets/`))
      ).toEqual(first.assetPaths);
      expect([...v.entries.keys()].some(name => name.endsWith('.tmp'))).toBe(false);
      expect(v.handles.size).toBe(0);
    }
  );

  it('refuses virtual links, hard links and foreign asset directories', async () => {
    for (const kind of ['link', 'hardlink', 'foreign'] as const) {
      const v = memoryFs();
      if (kind === 'foreign') {
        await v.publicationFs.mkdir(`${root}/.self-review-assets`, 0o755);
        v.entries.get(`${root}/.self-review-assets`)!.uid = -1;
      } else {
        const e = { ...v.entries.get(origin)!, bytes: Buffer.from('old') };
        if (kind === 'link') e.mode = constants.S_IFLNK | 0o777;
        else e.nlink = 2;
        v.entries.set(output, e);
      }
      await expect(
        publishReview(review(), output, {
          outputOrigin: 'explicit',
          publicationFs: v.publicationFs,
          attachmentOrigins: origins,
          reportDiagnostic: vi.fn(),
        })
      ).rejects.toMatchObject({ code: kind === 'link' ? 'unsafe-link' : 'unsupported-target' });
      expect(v.entries.get(output)?.bytes.toString()).toBe(kind === 'foreign' ? undefined : 'old');
    }
  });

  it('preserves old whole-file adapters and optional asyncFs with old handle members', async () => {
    for (const useAsync of [false, true]) {
      const v = memoryFs();
      v.layer.readSync = undefined;
      const read = vi.spyOn(v.layer, 'readFileSync');
      if (useAsync) v.layer.asyncFs = asyncFsFromSync(v.layer);
      await publishReview(review(), output, {
        outputOrigin: 'explicit',
        fs: v.layer,
        attachmentOrigins: origins,
        reportDiagnostic: vi.fn(),
      });
      expect(read).toHaveBeenCalledOnce();
      expect(v.entries.get(output)!.bytes.toString()).toContain('</review>');
    }
  });
});
