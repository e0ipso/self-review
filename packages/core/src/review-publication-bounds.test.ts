import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { publishReview, inspectOutputPath } from './review-publisher';
import { serializeReview } from './xml-serializer';
import { parseReviewXml } from './xml-parser';
import { validateReviewState } from './review-state-validation';
import { nodeFsLayer } from './safe-fs';
import type { FsLayer } from './safe-fs';
import { relocateAttachments } from './attachment-origins';
import { MAX_IMAGE_BYTES, MAX_RESUME_ATTACHMENTS } from './input-budgets';
import type { Attachment, ReviewState } from './types';

const MAX_REVIEW_ATTACHMENTS = MAX_RESUME_ATTACHMENTS;
const MAX_PUBLICATION_ASSET_BYTES = 64 * 1024 * 1024;

// Use the real validator, including schema refusals. Wrap only for interruption at that boundary.
vi.mock('xmllint-wasm', async importOriginal => {
  const actual = await importOriginal<typeof import('xmllint-wasm')>();
  return { ...actual, validateXML: vi.fn(actual.validateXML) };
});

let tmp: string;
let output: string;
let origins: Map<string, string>;
beforeEach(() => {
  vi.clearAllMocks();
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-publication-bounds-'));
  fs.mkdirSync(path.join(tmp, 'source', '.self-review-assets'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'target'));
  output = path.join(tmp, 'target', 'review.xml');
  origins = new Map();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(tmp, { recursive: true, force: true });
});

function attachment(name = 'a.png', data?: ArrayBuffer): Attachment {
  return {
    id: name,
    fileName: `.self-review-assets/${name}`,
    mediaType: 'image/png',
    ...(data ? { data } : {}),
  };
}
function review(attachments: Attachment[] = []): ReviewState {
  return {
    timestamp: '2026-01-01T00:00:00Z',
    source: { type: 'directory', sourcePath: '/reviewed' },
    files: [
      {
        path: 'a.ts',
        changeType: 'added',
        viewed: true,
        comments: [
          {
            id: 'c',
            filePath: 'a.ts',
            lineRange: null,
            suggestion: null,
            category: 'note',
            body: 'body\r\n<&',
            attachments,
          },
        ],
      },
    ],
  };
}
function diskAsset(name: string, size: number): Attachment {
  const target = path.join(tmp, 'source', '.self-review-assets', name);
  fs.writeFileSync(target, '');
  fs.truncateSync(target, size);
  const asset = attachment(name);
  origins.set(asset.fileName, target);
  return asset;
}
function refs(): string[] {
  return [...fs.readFileSync(output, 'utf8').matchAll(/<attachment path="([^"]+)"/g)].map(
    m => m[1]
  );
}
async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
    return null;
  } catch (error) {
    return error;
  }
}

async function previous() {
  const saved = await publishReview(
    review([attachment('old.png', new Uint8Array([9]).buffer)]),
    output,
    { outputOrigin: 'explicit' }
  );
  const xml = fs.readFileSync(output, 'utf8');
  return { xml, assets: saved.assetPaths, names: saved.assetPaths.map(p => path.basename(p)) };
}
function expectPrevious(old: Awaited<ReturnType<typeof previous>>) {
  expect(fs.readFileSync(output, 'utf8')).toBe(old.xml);
  expect(fs.readdirSync(path.join(path.dirname(output), '.self-review-assets')).sort()).toEqual(
    old.names.sort()
  );
  expect(fs.readFileSync(old.assets[0])).toEqual(Buffer.from([9]));
  expect(fs.readdirSync(path.dirname(output)).sort()).toEqual([
    '.self-review-assets',
    'review.xml',
  ]);
}

describe('document and asset budgets', () => {
  it('exposes one document count contract and the fixed aggregate budget', async () => {
    const budgets = await import('./input-budgets');
    expect(budgets.MAX_REVIEW_ATTACHMENTS).toBe(MAX_RESUME_ATTACHMENTS);
    expect(budgets.MAX_PUBLICATION_ASSET_BYTES).toBe(MAX_PUBLICATION_ASSET_BYTES);
  });

  it('round-trips exactly the shared count limit, including repeated references in replies', async () => {
    expect(MAX_RESUME_ATTACHMENTS).toBe(MAX_REVIEW_ATTACHMENTS);
    const state = review(Array.from({ length: MAX_REVIEW_ATTACHMENTS - 1 }, () => attachment()));
    state.files[0].comments[0].replies = [{ id: 'r', body: 'reply', attachments: [attachment()] }];
    await publishReview(state, output, { outputOrigin: 'explicit' });
    const parsed = parseReviewXml(output);
    expect(parsed.comments[0].attachments).toHaveLength(MAX_REVIEW_ATTACHMENTS - 1);
    expect(parsed.comments[0].replies![0].attachments).toHaveLength(1);
    expect(parsed.comments[0].body).toBe('body\r\n<&');
  });

  it('refuses an over-count document in validation and serialization before publication reads or writes', async () => {
    const old = await previous();
    const state = review(Array.from({ length: MAX_REVIEW_ATTACHMENTS }, () => attachment()));
    state.files[0].comments[0].replies = [{ id: 'r', body: 'reply', attachments: [attachment()] }];
    expect(() => validateReviewState(state)).toThrow(/1000 attachment limit/);
    expect(await rejection(serializeReview(state, output))).toMatchObject({
      code: 'invalid-state',
    });
    const read = vi.fn(nodeFsLayer.readSync!);
    expect(
      await rejection(
        publishReview(state, output, {
          outputOrigin: 'explicit',
          fs: { ...nodeFsLayer, readSync: read },
          attachmentOrigins: new Map([[attachment().fileName, '/missing/asset.png']]),
        })
      )
    ).toMatchObject({ code: 'validation-failed' });
    expect(read).not.toHaveBeenCalled();
    expectPrevious(old);
  });

  it('refuses oversized inline assets and aggregate bytes even with a broken validator', async () => {
    const state = review([attachment('large.png', new ArrayBuffer(MAX_IMAGE_BYTES + 1))]);
    expect(await rejection(serializeReview(state, output))).toMatchObject({
      code: 'invalid-state',
    });
    const bytes = new ArrayBuffer(MAX_IMAGE_BYTES);
    const aggregate = review(
      Array.from({ length: 7 }, (_, index) => attachment(`${index}.png`, bytes))
    );
    const { validateXML } = await import('xmllint-wasm');
    vi.mocked(validateXML).mockRejectedValueOnce(new Error('not available'));
    expect(
      await rejection(publishReview(aggregate, output, { outputOrigin: 'explicit' }))
    ).toMatchObject({
      code: 'validation-failed',
      message: expect.stringContaining('64 MiB publication asset limit'),
    });
    expect(validateXML).not.toHaveBeenCalled();
    vi.mocked(validateXML).mockReset();
    // Restore the real validator implementation for subsequent cases.
    const actual = await vi.importActual<typeof import('xmllint-wasm')>('xmllint-wasm');
    vi.mocked(validateXML).mockImplementation(actual.validateXML);
    expect(fs.existsSync(output)).toBe(false);
  });

  it('rechecks inline buffers that grow while schema validation is pending', async () => {
    const old = await previous();
    const bytes = Reflect.construct(ArrayBuffer, [
      1,
      { maxByteLength: MAX_IMAGE_BYTES + 1 },
    ]) as ArrayBuffer & { resize(length: number): void };
    const state = review([attachment('resizable.png', bytes)]);
    const { validateXML } = await import('xmllint-wasm');
    const actual = await vi.importActual<typeof import('xmllint-wasm')>('xmllint-wasm');
    vi.mocked(validateXML).mockImplementationOnce(async input => {
      bytes.resize(MAX_IMAGE_BYTES + 1);
      // The publication plan must retain its own bounds even when callers replace their DTO.
      state.files = [];
      return actual.validateXML(input);
    });
    expect(
      await rejection(publishReview(state, output, { outputOrigin: 'explicit' }))
    ).toMatchObject({
      code: 'validation-failed',
    });
    expectPrevious(old);
  });

  it('stages exactly 64 MiB incrementally and refuses the next byte without changing old output', async () => {
    const old = await previous();
    const sizes = [
      ...Array<number>(6).fill(MAX_IMAGE_BYTES),
      MAX_PUBLICATION_ASSET_BYTES - 6 * MAX_IMAGE_BYTES,
    ];
    const attachments = sizes.map((size, i) => diskAsset(`${i}.png`, size));
    const events: string[] = [];
    const sourceFds = new Map<number, string>();
    const layer: FsLayer = {
      ...nodeFsLayer,
      openSync(target, flags, mode) {
        const fd = nodeFsLayer.openSync(target, flags, mode);
        if (target.startsWith(path.join(tmp, 'source'))) {
          events.push(`read ${path.basename(target)}`);
          sourceFds.set(fd, target);
        }
        return fd;
      },
      closeSync(fd) {
        const source = sourceFds.get(fd);
        if (source) {
          events.push(`close ${path.basename(source)}`);
          sourceFds.delete(fd);
        }
        nodeFsLayer.closeSync(fd);
      },
      writeSync(fd, bytes) {
        events.push('write');
        return nodeFsLayer.writeSync(fd, bytes);
      },
    };
    const saved = await publishReview(review(attachments), output, {
      outputOrigin: 'explicit',
      attachmentOrigins: origins,
      fs: layer,
    });
    expect(saved.assetPaths.map(p => fs.statSync(p).size)).toEqual(sizes);
    for (let i = 1; i < sizes.length; i++) {
      const readIndex = events.indexOf(`read ${i}.png`);
      const lastClose = events.indexOf(`close ${i - 1}.png`);
      expect(events.slice(lastClose + 1, readIndex)).toContain('write');
    }
    // Use the original output to verify rollback when a later asset exhausts the budget.
    fs.writeFileSync(output, old.xml);
    for (const p of saved.assetPaths) fs.unlinkSync(p);
    const overflow = diskAsset('overflow.png', 1);
    const opened = vi.fn(nodeFsLayer.readSync!);
    expect(
      await rejection(
        publishReview(review([...attachments, overflow]), output, {
          outputOrigin: 'explicit',
          attachmentOrigins: origins,
          fs: { ...nodeFsLayer, readSync: opened },
        })
      )
    ).toMatchObject({
      code: 'attachment-unavailable',
      message: expect.stringContaining('publication asset budget'),
    });
    expectPrevious(old);
  });

  it('refuses imported aggregate overflow and removes only the attempt assets', async () => {
    const old = await previous();
    const sizes = [
      ...Array<number>(6).fill(MAX_IMAGE_BYTES),
      MAX_PUBLICATION_ASSET_BYTES - 6 * MAX_IMAGE_BYTES + 1,
    ];
    const assets = sizes.map((size, i) => diskAsset(`${i}.png`, size));
    expect(
      await rejection(
        publishReview(review(assets), output, {
          outputOrigin: 'explicit',
          attachmentOrigins: origins,
        })
      )
    ).toMatchObject({
      code: 'attachment-unavailable',
      message: expect.stringContaining('publication asset budget'),
    });
    expectPrevious(old);
  });

  it('counts inline and imported bytes together, including growth after fstat', async () => {
    const old = await previous();
    const data = new ArrayBuffer(MAX_IMAGE_BYTES);
    const inline = Array.from({ length: 6 }, (_, i) => attachment(`inline${i}.png`, data));
    const remaining = MAX_PUBLICATION_ASSET_BYTES - 6 * MAX_IMAGE_BYTES;
    const disk = diskAsset('growing.png', remaining);
    let grew = false;
    const layer: FsLayer = {
      ...nodeFsLayer,
      readSync(fd, buffer, offset, length, position) {
        if (!grew) {
          fs.appendFileSync(origins.get(disk.fileName)!, Buffer.from([1]));
          grew = true;
        }
        return nodeFsLayer.readSync!(fd, buffer, offset, length, position);
      },
    };
    expect(
      await rejection(
        publishReview(review([...inline, disk]), output, {
          outputOrigin: 'explicit',
          attachmentOrigins: origins,
          fs: layer,
        })
      )
    ).toMatchObject({
      code: 'attachment-unavailable',
      message: expect.stringContaining('publication asset budget'),
    });
    expect(grew).toBe(true);
    expectPrevious(old);
  });

  it('applies the aggregate budget to the public relocation compatibility API', async () => {
    const data = new ArrayBuffer(MAX_IMAGE_BYTES);
    // Use intrinsic buffer lengths even if a caller shadows the byteLength accessor.
    Object.defineProperty(data, 'byteLength', { value: 0 });
    const inline = Array.from({ length: 6 }, (_, i) => attachment(`inline${i}.png`, data));
    const disk = diskAsset(
      'over-budget.png',
      MAX_PUBLICATION_ASSET_BYTES - 6 * MAX_IMAGE_BYTES + 1
    );
    expect(
      await rejection(relocateAttachments(review([...inline, disk]), origins, output))
    ).toMatchObject({
      name: 'AttachmentRelocationError',
      reason: 'too-large',
    });
    expect(fs.existsSync(output)).toBe(false);
  });

  it('copies a repeated imported reference once for roots and replies', async () => {
    const a = diskAsset('a.png', 4);
    const state = review([a, a]);
    state.files[0].comments[0].replies = [{ id: 'r', body: 'reply', attachments: [a] }];
    let reads = 0;
    const layer = {
      ...nodeFsLayer,
      readSync: (...args: Parameters<NonNullable<FsLayer['readSync']>>) => {
        reads++;
        return nodeFsLayer.readSync!(...args);
      },
    };
    const saved = await publishReview(state, output, {
      outputOrigin: 'explicit',
      attachmentOrigins: origins,
      fs: layer,
    });
    expect(saved.assetPaths).toHaveLength(1);
    expect(new Set(refs()).size).toBe(1);
    expect(reads).toBe(2); // A content read and an EOF check, rather than one read per reference.
  });

  it('rejects schema-invalid XML before reading imported assets', async () => {
    const old = await previous();
    const state = review([diskAsset('a.png', 4)]);
    state.timestamp = 'invalid';
    const read = vi.fn(nodeFsLayer.readSync!);
    expect(
      await rejection(
        publishReview(state, output, {
          outputOrigin: 'explicit',
          attachmentOrigins: origins,
          fs: { ...nodeFsLayer, readSync: read },
        })
      )
    ).toMatchObject({ code: 'validation-failed' });
    expect(read).not.toHaveBeenCalled();
    expectPrevious(old);
  });

  it.each(['oversized', 'linked'] as const)(
    'refuses %s imported origins and retains the previous publication',
    async kind => {
      const old = await previous();
      const a = diskAsset('a.png', kind === 'oversized' ? MAX_IMAGE_BYTES + 1 : 1);
      if (kind === 'linked') {
        fs.unlinkSync(origins.get(a.fileName)!);
        fs.symlinkSync(old.assets[0], origins.get(a.fileName)!);
      }
      expect(
        await rejection(
          publishReview(review([a]), output, {
            outputOrigin: 'explicit',
            attachmentOrigins: origins,
          })
        )
      ).toMatchObject({
        code: 'attachment-unavailable',
        cause: { reason: kind === 'oversized' ? 'too-large' : 'unsafe-link' },
      });
      expectPrevious(old);
    }
  );
});

/** Virtual-only paths and descriptor numbers, backed by a private test directory. */
function virtualFilesystem() {
  const root = `/__self_review_virtual_${path.basename(tmp)}`;
  const real = (target: string) => {
    if (target !== root && !target.startsWith(root + '/'))
      throw new Error(`unexpected path ${target}`);
    return tmp + target.slice(root.length);
  };
  const descriptors = new Map<number, number>();
  let nextFd = 900_000;
  const fdFor = (fd: number) => {
    const realFd = descriptors.get(fd);
    if (realFd === undefined) throw new Error(`unknown virtual descriptor ${fd}`);
    return realFd;
  };
  const readFileSync = vi.fn((fd: number) => nodeFsLayer.readFileSync(fdFor(fd)));
  const layer: FsLayer = {
    // Intentionally legacy: no optional readSync, accessSync or asyncFs.
    openSync(target, flags, mode) {
      const fd = nextFd++;
      descriptors.set(fd, nodeFsLayer.openSync(real(target), flags, mode));
      return fd;
    },
    writeSync(fd, data) {
      return nodeFsLayer.writeSync(fdFor(fd), data);
    },
    fsyncSync(fd) {
      nodeFsLayer.fsyncSync(fdFor(fd));
    },
    fchmodSync(fd, mode) {
      nodeFsLayer.fchmodSync(fdFor(fd), mode);
    },
    fchownSync(fd, uid, gid) {
      nodeFsLayer.fchownSync(fdFor(fd), uid, gid);
    },
    closeSync(fd) {
      nodeFsLayer.closeSync(fdFor(fd));
      descriptors.delete(fd);
    },
    renameSync(from, to) {
      nodeFsLayer.renameSync(real(from), real(to));
    },
    unlinkSync(target) {
      nodeFsLayer.unlinkSync(real(target));
    },
    lstatSync(target) {
      return nodeFsLayer.lstatSync(real(target));
    },
    fstatSync(fd) {
      return nodeFsLayer.fstatSync(fdFor(fd));
    },
    readFileSync,
    mkdirSync(target, mode) {
      nodeFsLayer.mkdirSync(real(target), mode);
    },
    realpathSync(target) {
      return root + nodeFsLayer.realpathSync(real(target)).slice(tmp.length);
    },
  };
  return { root, layer, readFileSync, descriptors };
}

describe('filesystem substitution', () => {
  it('inspects, reads, stages and commits entirely through legacy virtual capabilities', async () => {
    const a = diskAsset('virtual.png', 4);
    const vfs = virtualFilesystem();
    const virtualOutput = `${vfs.root}/target/review.xml`;
    const virtualOrigins = new Map([[a.fileName, origins.get(a.fileName)!.replace(tmp, vfs.root)]]);
    const options = {
      outputOrigin: 'inherited' as const,
      baseDir: vfs.root,
      fs: vfs.layer,
      attachmentOrigins: virtualOrigins,
    };
    expect(fs.existsSync(vfs.root)).toBe(false);
    expect(inspectOutputPath(virtualOutput, options)).toBeNull();
    const saved = await publishReview(review([a]), virtualOutput, options);
    expect(saved.outputPath).toBe(virtualOutput);
    expect(saved.assetPaths).toHaveLength(1);
    expect(vfs.readFileSync).toHaveBeenCalledTimes(1);
    expect(vfs.readFileSync.mock.calls[0][0]).toBeGreaterThanOrEqual(900_000);
    expect(fs.readFileSync(path.join(tmp, 'target', refs()[0]))).toEqual(Buffer.alloc(4));
    expect(vfs.descriptors.size).toBe(0);
  });

  it('honors a supplied access probe and never substitutes real directory permissions', () => {
    const vfs = virtualFilesystem();
    const accessSync = vi.fn(() => {
      throw Object.assign(new Error('denied'), { code: 'EACCES' });
    });
    expect(
      inspectOutputPath(`${vfs.root}/target/review.xml`, {
        outputOrigin: 'explicit',
        fs: { ...vfs.layer, accessSync },
      })
    ).toMatchObject({ code: 'permission-denied' });
    expect(accessSync).toHaveBeenCalledWith(`${vfs.root}/target`, fs.constants.W_OK);
  });

  it('sizes legacy virtual descriptors before allocation and detects growth after readFileSync', async () => {
    const a = diskAsset('large.png', MAX_IMAGE_BYTES + 1);
    const vfs = virtualFilesystem();
    const target = `${vfs.root}/target/review.xml`;
    const virtualOrigins = new Map([[a.fileName, origins.get(a.fileName)!.replace(tmp, vfs.root)]]);
    expect(
      await rejection(
        publishReview(review([a]), target, {
          outputOrigin: 'explicit',
          fs: vfs.layer,
          attachmentOrigins: virtualOrigins,
        })
      )
    ).toMatchObject({ code: 'attachment-unavailable', cause: { reason: 'too-large' } });
    expect(vfs.readFileSync).not.toHaveBeenCalled();
    fs.truncateSync(origins.get(a.fileName)!, 1);
    vfs.readFileSync.mockImplementationOnce(() => Buffer.alloc(MAX_IMAGE_BYTES + 1));
    expect(
      await rejection(
        publishReview(review([a]), target, {
          outputOrigin: 'explicit',
          fs: vfs.layer,
          attachmentOrigins: virtualOrigins,
        })
      )
    ).toMatchObject({ code: 'attachment-unavailable', cause: { reason: 'too-large' } });
    expect(vfs.readFileSync).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(output)).toBe(false);
    expect(vfs.descriptors.size).toBe(0);
  });

  it('keeps the public relocation call compatible while bounding its retained buffers', async () => {
    const a = diskAsset('virtual.png', 4);
    const vfs = virtualFilesystem();
    const state = review([a]);
    const next = await relocateAttachments(
      state,
      new Map([[a.fileName, origins.get(a.fileName)!.replace(tmp, vfs.root)]]),
      `${vfs.root}/target/review.xml`,
      { fs: vfs.layer }
    );
    expect(new Uint8Array(next.files[0].comments[0].attachments![0].data!)).toEqual(
      new Uint8Array(4)
    );
    expect(state.files[0].comments[0].attachments![0].data).toBeUndefined();
    expect(vfs.readFileSync).toHaveBeenCalledTimes(1);
    expect(vfs.descriptors.size).toBe(0);
  });
});

describe('publication interruption', () => {
  it('stops preparation within a bounded read and cleans only the attempt assets', async () => {
    const old = await previous();
    const first = diskAsset('first.png', 1);
    const second = diskAsset('second.png', 256 * 1024);
    const controller = new AbortController();
    let readingSecond = false;
    let readChunks = 0;
    const reason = new Error('cancel preparation');
    const layer: FsLayer = {
      ...nodeFsLayer,
      openSync(target, flags, mode) {
        if (target === origins.get(second.fileName)) readingSecond = true;
        return nodeFsLayer.openSync(target, flags, mode);
      },
      readSync(fd, buffer, offset, length, position) {
        const count = nodeFsLayer.readSync!(fd, buffer, offset, length, position);
        if (readingSecond) {
          readChunks++;
          expect(length).toBeLessThanOrEqual(64 * 1024);
          controller.abort(reason);
        }
        return count;
      },
    };
    expect(
      await rejection(
        publishReview(review([first, second]), output, {
          outputOrigin: 'explicit',
          fs: layer,
          attachmentOrigins: origins,
          signal: controller.signal,
        })
      )
    ).toMatchObject({ code: 'io-error', cause: reason });
    expect(readChunks).toBe(1);
    expectPrevious(old);
  });

  it('yields to cancellation during staging instead of synchronously writing every asset', async () => {
    const old = await previous();
    const controller = new AbortController();
    const state = review([
      attachment('a.png', new ArrayBuffer(256 * 1024)),
      attachment('b.png', new ArrayBuffer(4)),
    ]);
    let wrote = 0;
    const chunks: number[] = [];
    const reason = new Error('cancel staging');
    const layer: FsLayer = {
      ...nodeFsLayer,
      writeSync(fd, bytes) {
        wrote++;
        chunks.push(bytes.length);
        const count = nodeFsLayer.writeSync(fd, bytes);
        setImmediate(() => controller.abort(reason));
        return count;
      },
    };
    expect(
      await rejection(
        publishReview(state, output, {
          outputOrigin: 'explicit',
          fs: layer,
          signal: controller.signal,
        })
      )
    ).toMatchObject({ code: 'io-error', cause: reason });
    expect(controller.signal.aborted).toBe(true);
    expect(Math.max(...chunks)).toBeLessThanOrEqual(64 * 1024);
    // A queued cancellation is observed before writing the whole first asset or starting the second.
    expect(wrote).toBeLessThan(4);
    expectPrevious(old);
  });

  it('does not turn a failed diagnostic into refusal after commit', async () => {
    vi.mocked(console.error).mockImplementation(() => {
      throw new Error('stderr closed');
    });
    const saved = await publishReview(
      review([attachment('a.png', new Uint8Array([7]).buffer)]),
      output,
      { outputOrigin: 'explicit' }
    );
    expect(saved.assetPaths).toHaveLength(1);
    expect(fs.readFileSync(saved.assetPaths[0])).toEqual(Buffer.from([7]));
    expect(parseReviewXml(output).comments[0].attachments).toHaveLength(1);
  });

  it('honors asynchronous capabilities from the supplied filesystem and retains committed success after abort', async () => {
    const vfs = virtualFilesystem();
    const { asyncFsFromSync } = await import('./safe-fs-async');
    const asyncFs = asyncFsFromSync(vfs.layer);
    const open = vi.spyOn(asyncFs, 'open');
    const rename = asyncFs.rename;
    const controller = new AbortController();
    asyncFs.rename = async (from, to) => {
      await rename(from, to);
      controller.abort(new Error('after commit'));
    };
    const saved = await publishReview(
      review([attachment('a.png', new Uint8Array([7]).buffer)]),
      `${vfs.root}/target/review.xml`,
      {
        outputOrigin: 'explicit',
        fs: { ...vfs.layer, asyncFs },
        signal: controller.signal,
      }
    );
    expect(open).toHaveBeenCalled();
    expect(controller.signal.aborted).toBe(true);
    expect(saved.assetPaths).toHaveLength(1);
    expect(fs.readFileSync(path.join(tmp, 'target', refs()[0]))).toEqual(Buffer.from([7]));
    expect(vfs.descriptors.size).toBe(0);
  });
});
