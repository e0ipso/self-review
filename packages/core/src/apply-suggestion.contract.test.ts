import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { applySuggestion, applySuggestionAsync } from './apply-suggestion';
import type { ApplySuggestionRequest, ApplySuggestionOptions } from './apply-suggestion';
import { nodeFsLayer } from './safe-fs';
import { nodeAsyncFsLayer } from './safe-fs-async';
import type { AsyncFileHandle } from './safe-fs-async';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-apply-contract-'));
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function request(originalCode = 'old', proposedCode = 'new'): ApplySuggestionRequest {
  return {
    destinationRoot: root,
    filePath: 'file',
    lineRange: { side: 'new', start: 1, end: 1 },
    suggestion: { originalCode, proposedCode },
  };
}

function wrapRead(handle: AsyncFileHandle, read: AsyncFileHandle['read']): AsyncFileHandle {
  return {
    stat: () => handle.stat(),
    read,
    write: bytes => handle.write(bytes),
    sync: () => handle.sync(),
    chmod: mode => handle.chmod(mode),
    chown: (uid, gid) => handle.chown(uid, gid),
    close: () => handle.close(),
  };
}

const variants = [
  {
    name: 'sync',
    async apply(
      value: ApplySuggestionRequest,
      limits: Pick<ApplySuggestionOptions, 'maxInputBytes' | 'maxOutputBytes'> = {},
      onRead?: () => void
    ) {
      return applySuggestion(value, {
        ...limits,
        fs: {
          ...nodeFsLayer,
          readSync(fd, buffer, offset, length, position) {
            const count = nodeFsLayer.readSync!(fd, buffer, offset, length, position);
            onRead?.();
            return count;
          },
        },
      });
    },
  },
  {
    name: 'async',
    apply(
      value: ApplySuggestionRequest,
      limits: Pick<ApplySuggestionOptions, 'maxInputBytes' | 'maxOutputBytes'> = {},
      onRead?: () => void
    ) {
      return applySuggestionAsync(value, {
        ...limits,
        fs: {
          ...nodeAsyncFsLayer,
          async open(...args) {
            const handle = await nodeAsyncFsLayer.open(...args);
            return wrapRead(handle, async (...readArgs) => {
              const result = await handle.read(...readArgs);
              onRead?.();
              return result;
            });
          },
        },
      });
    },
  },
];

for (const variant of variants)
  describe(`${variant.name} Apply contract`, () => {
    it('enforces input size on the opened descriptor before the first read', async () => {
      const target = path.join(root, 'file');
      fs.writeFileSync(target, 'old\nrest\n');
      let reads = 0;
      expect(await variant.apply(request(), { maxInputBytes: 8 }, () => reads++)).toMatchObject({
        status: 'refused',
        reason: 'file-unreadable',
        detail: expect.stringContaining('8 byte Apply input limit'),
      });
      expect(reads).toBe(0);
      expect(fs.readFileSync(target, 'utf8')).toBe('old\nrest\n');
      expect(fs.readdirSync(root)).toEqual(['file']);
    });

    it('accepts exact input/output limits, including a zero-byte deletion', async () => {
      const target = path.join(root, 'file');
      fs.writeFileSync(target, 'old\n');
      expect(await variant.apply(request(), { maxInputBytes: 4, maxOutputBytes: 4 })).toMatchObject(
        { status: 'applied' }
      );
      expect(fs.readFileSync(target, 'utf8')).toBe('new\n');
      expect(
        await variant.apply(request('new', ''), { maxInputBytes: 4, maxOutputBytes: 0 })
      ).toMatchObject({ status: 'applied' });
      expect(fs.readFileSync(target).length).toBe(0);
    });

    it('keeps an untouched BOM and mixed line endings byte for byte', async () => {
      const target = path.join(root, 'file');
      fs.writeFileSync(target, '\uFEFFprefix\r\nold\nend\r');
      const value = request();
      value.lineRange = { side: 'new', start: 2, end: 2 };
      expect(await variant.apply(value)).toMatchObject({ status: 'applied' });
      expect(fs.readFileSync(target)).toEqual(Buffer.from('\uFEFFprefix\r\nnew\nend\r'));
    });

    it('enforces the default 5 MiB input budget on a later-grown file', async () => {
      const target = path.join(root, 'file');
      fs.writeFileSync(target, 'old\n');
      fs.truncateSync(target, 5 * 1024 * 1024 + 1);
      let reads = 0;
      expect(await variant.apply(request(), {}, () => reads++)).toMatchObject({
        status: 'refused',
        reason: 'file-unreadable',
        detail: expect.stringContaining('5242880 byte Apply input limit'),
      });
      expect(reads).toBe(0);
      expect(fs.statSync(target).size).toBe(5 * 1024 * 1024 + 1);
      expect(fs.readdirSync(root)).toEqual(['file']);
    });

    it('detects growth while reading, before decoding or staging output', async () => {
      const target = path.join(root, 'file');
      fs.writeFileSync(target, 'old\n');
      let grew = false;
      const result = await variant.apply(request(), { maxInputBytes: 8 }, () => {
        if (!grew) {
          grew = true;
          fs.appendFileSync(target, '0123456789');
        }
      });
      expect(result).toMatchObject({
        status: 'refused',
        reason: 'file-unreadable',
        detail: expect.stringContaining('8 byte Apply input limit'),
      });
      expect(fs.readFileSync(target, 'utf8')).toBe('old\n0123456789');
      expect(fs.readdirSync(root)).toEqual(['file']);
    });

    it('counts the resulting UTF-8 bytes, including preserved suffix and terminators', async () => {
      const target = path.join(root, 'file');
      fs.writeFileSync(target, 'old\ntail\n');
      expect(await variant.apply(request('old', '中中'), { maxOutputBytes: 11 })).toMatchObject({
        status: 'refused',
        reason: 'write-failed',
      });
      expect(fs.readFileSync(target, 'utf8')).toBe('old\ntail\n');
      expect(await variant.apply(request('old', '中中'), { maxOutputBytes: 12 })).toMatchObject({
        status: 'applied',
      });
      expect(fs.readFileSync(target, 'utf8')).toBe('中中\ntail\n');
    });

    it('counts CRLF expansion toward the output limit', async () => {
      const target = path.join(root, 'file');
      fs.writeFileSync(target, 'old\r\n');
      expect(await variant.apply(request('old\r', 'a\nb'), { maxOutputBytes: 5 })).toMatchObject({
        status: 'refused',
        reason: 'write-failed',
      });
      expect(fs.readFileSync(target, 'utf8')).toBe('old\r\n');
      expect(await variant.apply(request('old\r', 'a\nb'), { maxOutputBytes: 6 })).toMatchObject({
        status: 'applied',
      });
      expect(fs.readFileSync(target, 'utf8')).toBe('a\r\nb\r\n');
    });

    it('handles many empty lines without per-line arrays or argument spreading', async () => {
      const target = path.join(root, 'file');
      const content = 'old\n' + '\n'.repeat(200_000);
      fs.writeFileSync(target, content);
      expect(await variant.apply(request())).toMatchObject({ status: 'applied' });
      expect(fs.readFileSync(target, 'utf8')).toBe('new' + content.slice(3));
    });

    for (const [content, original, proposal, expected] of [
      ['\uFEFFold\nkeep\r\n', '\uFEFFold', 'é中', 'é中\nkeep\r\n'],
      ['old\r\nkeep\n', 'old\r', 'new\nline\n', 'new\r\nline\r\nkeep\n'],
      ['old\nkeep\r', 'old', '\n', '\nkeep\r'],
      ['old\r', 'old\r', '\n', '\r'],
      ['old\r\n', 'old\r', '', ''],
      ['old\r\n', 'old\r', '\n\n', '\r\n\r\n'],
    ])
      it(`preserves exact encoding and line bytes ${JSON.stringify(content)} / ${JSON.stringify(proposal)}`, async () => {
        const target = path.join(root, 'file');
        fs.writeFileSync(target, content);
        expect(await variant.apply(request(original, proposal))).toMatchObject({
          status: 'applied',
        });
        expect(fs.readFileSync(target)).toEqual(Buffer.from(expected));
      });

    it('refuses invalid UTF-8 and hard-linked targets without writing', async () => {
      const target = path.join(root, 'file');
      fs.writeFileSync(target, Buffer.from([255, 10]));
      expect(await variant.apply(request())).toMatchObject({
        status: 'refused',
        reason: 'file-not-utf8',
      });
      fs.writeFileSync(target, 'old\n');
      fs.linkSync(target, path.join(root, 'alias'));
      expect(await variant.apply(request())).toMatchObject({
        status: 'refused',
        reason: 'unsafe-target',
      });
      expect(fs.readFileSync(target, 'utf8')).toBe('old\n');
    });

    it('refuses links along the path and repository metadata', async () => {
      fs.mkdirSync(path.join(root, 'outside'));
      fs.writeFileSync(path.join(root, 'outside', 'file'), 'old\n');
      fs.symlinkSync(path.join(root, 'outside'), path.join(root, 'linked'));
      expect(await variant.apply({ ...request(), filePath: 'linked/file' })).toMatchObject({
        status: 'refused',
        reason: 'unsafe-target',
      });
      expect(await variant.apply({ ...request(), filePath: '.git/config' })).toMatchObject({
        status: 'refused',
        reason: 'control-file',
      });
      expect(fs.readFileSync(path.join(root, 'outside', 'file'), 'utf8')).toBe('old\n');
    });
  });

it('uses an inherited bounded reader without calling the legacy whole-file reader', () => {
  fs.writeFileSync(path.join(root, 'file'), 'old\n');
  const inherited = Object.create(nodeFsLayer);
  inherited.readFileSync = () => {
    throw new Error('unbounded reader must not run');
  };
  expect(applySuggestion(request(), { fs: inherited })).toMatchObject({ status: 'applied' });
});

it('supports an inherited asynchronous adapter without merging away its methods', async () => {
  fs.writeFileSync(path.join(root, 'file'), 'old\n');
  const inherited = Object.create(nodeAsyncFsLayer);
  expect(await applySuggestionAsync(request(), { fs: inherited })).toMatchObject({
    status: 'applied',
  });
});

it('validates negative and noninteger byte limits before opening a file', async () => {
  for (const value of [-1, NaN, 1.5, Infinity]) {
    expect(() => applySuggestion(request(), { maxInputBytes: value })).toThrow(RangeError);
    await expect(applySuggestionAsync(request(), { maxOutputBytes: value })).rejects.toBeInstanceOf(
      RangeError
    );
  }
});

it('propagates pre-aborted cancellation without touching the destination', async () => {
  const reason = new Error('cancel Apply');
  await expect(applySuggestionAsync(request(), { signal: AbortSignal.abort(reason) })).rejects.toBe(
    reason
  );
  expect(fs.readdirSync(root)).toEqual([]);
});

for (const phase of ['read', 'write', 'sync', 'rename'] as const)
  it(`honors cancellation during ${phase} with the right commit outcome`, async () => {
    const target = path.join(root, 'file');
    fs.writeFileSync(target, 'old\n');
    const controller = new AbortController();
    const reason = new Error('cancel Apply');
    const cancel = () => controller.abort(reason);
    const pending = applySuggestionAsync(request(), {
      signal: controller.signal,
      fs: {
        ...nodeAsyncFsLayer,
        async open(...args) {
          const handle = await nodeAsyncFsLayer.open(...args);
          return {
            ...wrapRead(handle, async (...args) => {
              const result = await handle.read(...args);
              if (phase === 'read') cancel();
              return result;
            }),
            async write(bytes) {
              const result = await handle.write(bytes);
              if (phase === 'write') cancel();
              return result;
            },
            async sync() {
              await handle.sync();
              if (phase === 'sync') cancel();
            },
          };
        },
        async rename(from, to) {
          await nodeAsyncFsLayer.rename(from, to);
          if (phase === 'rename') cancel();
        },
      },
    });
    if (phase === 'rename') {
      expect(await pending).toMatchObject({ status: 'applied' });
      expect(fs.readFileSync(target, 'utf8')).toBe('new\n');
    } else {
      await expect(pending).rejects.toBe(reason);
      expect(fs.readFileSync(target, 'utf8')).toBe('old\n');
    }
    expect(fs.readdirSync(root)).toEqual(['file']);
  });

it('refuses an unpaired-surrogate original instead of matching its lossy UTF-8 encoding', async () => {
  const target = path.join(root, 'file');
  fs.writeFileSync(target, '\uFFFD\n');
  expect(applySuggestion(request('\uD800', 'new'))).toMatchObject({
    status: 'refused',
    reason: 'context-mismatch',
  });
  expect(await applySuggestionAsync(request('\uD800', 'new'))).toMatchObject({
    status: 'refused',
    reason: 'context-mismatch',
  });
  expect(fs.readFileSync(target, 'utf8')).toBe('\uFFFD\n');
});
