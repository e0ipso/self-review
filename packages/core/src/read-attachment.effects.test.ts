import { afterEach, describe, expect, it, vi } from 'vitest';
import { readAttachment } from './review-content';
import { createReviewSession } from './review-session';
import { CommandCancelledError } from './forge-provider';
import { MAX_IMAGE_BYTES } from './input-budgets';
import { readAssetFile } from './attachment-origins';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const reference = '.self-review-assets/photo.png';
function session() {
  const value = createReviewSession();
  value.attachmentOrigins = new Map([
    [reference, '/virtual/original/.self-review-assets/photo.png'],
  ]);
  return value;
}
const directories: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const dir of directories.splice(0)) await rm(dir, { recursive: true, force: true });
});

describe('authorized attachment effects', () => {
  it('authorizes provenance before invoking a receiver-bound authoritative reader', async () => {
    const bytes = new Uint8Array([0, 255, 128]).buffer;
    const reader = {
      calls: [] as string[],
      async readAssetFile(target: string) {
        this.calls.push(target);
        return { ok: true as const, data: bytes };
      },
    };
    const reportDiagnostic = vi.fn();
    const value = session();
    expect(
      await readAttachment(value, '../secret', { attachmentReader: reader, reportDiagnostic })
    ).toMatchObject({ ok: false, reason: 'not-authorized' });
    expect(reader.calls).toEqual([]);
    expect(
      await readAttachment(value, reference, { attachmentReader: reader, reportDiagnostic })
    ).toEqual({ ok: true, data: bytes });
    expect(reader.calls).toEqual(['/virtual/original/.self-review-assets/photo.png']);
    expect(reportDiagnostic).toHaveBeenCalledExactlyOnceWith(
      '[attachment:read] Refused: "../secret"'
    );
  });

  it.each(['throw', 'reject'] as const)(
    'preserves typed refusal when reporting fails by %s',
    async mode => {
      const result = {
        ok: false as const,
        reason: 'unsafe-link' as const,
        message: 'Virtual link refused',
      };
      const reportDiagnostic = vi.fn(() => {
        if (mode === 'throw') throw new Error('sink');
        return Promise.reject(new Error('sink'));
      });
      expect(
        await readAttachment(session(), reference, {
          attachmentReader: {
            readAssetFile: async () => result,
          },
          reportDiagnostic,
        })
      ).toBe(result);
      expect(reportDiagnostic).toHaveBeenCalledExactlyOnceWith(
        '[attachment:read] unsafe-link: Virtual link refused'
      );
    }
  );

  it('does not retry provider failure through the native reader', async () => {
    const error = new Error('provider failed');
    const read = vi.fn(async () => {
      throw error;
    });
    await expect(
      readAttachment(session(), reference, { attachmentReader: { readAssetFile: read } })
    ).rejects.toBe(error);
    expect(read).toHaveBeenCalledOnce();
  });

  it('refuses cyclic, bigint, hostile and huge unknown references without serialization or I/O', async () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    const hostile = {
      toJSON() {
        throw new Error('must not execute');
      },
    };
    const getter = {
      get value() {
        throw new Error('must not access');
      },
    };
    const read = vi.fn(async () => ({ ok: true as const, data: new ArrayBuffer(0) }));
    const reportDiagnostic = vi.fn();
    for (const invalid of [cyclic, 1n, hostile, getter, 'x'.repeat(1000000)]) {
      expect(
        await readAttachment(session(), invalid, {
          attachmentReader: { readAssetFile: read },
          reportDiagnostic,
        })
      ).toMatchObject({ ok: false, reason: 'not-authorized' });
    }
    expect(read).not.toHaveBeenCalled();
    expect(reportDiagnostic.mock.calls.every(([message]) => message.length < 600)).toBe(true);
  });

  it('checks cancellation before provider access and after provider completion or failure', async () => {
    for (const stage of ['before', 'success', 'failure'] as const) {
      const controller = new AbortController();
      const read = vi.fn(async (_target: string, options: { signal?: AbortSignal }) => {
        expect(options.signal).toBe(controller.signal);
        controller.abort();
        if (stage === 'failure') throw new Error('provider');
        return { ok: true as const, data: new ArrayBuffer(0) };
      });
      if (stage === 'before') controller.abort();
      await expect(
        readAttachment(session(), reference, {
          signal: controller.signal,
          attachmentReader: { readAssetFile: read },
        })
      ).rejects.toBeInstanceOf(CommandCancelledError);
      expect(read).toHaveBeenCalledTimes(stage === 'before' ? 0 : 1);
    }
  });

  it('keeps native no-follow, regular-file, passive byte and size behavior with the supplied role', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'attachment-role-'));
    directories.push(dir);
    const assetDir = join(dir, '.self-review-assets');
    await mkdir(assetDir);
    const target = join(assetDir, 'photo.png');
    const value = session();
    value.attachmentOrigins = new Map([[reference, target]]);
    const options = { attachmentReader: { readAssetFile }, reportDiagnostic: () => {} };
    await writeFile(target, new Uint8Array([0, 255, 128]));
    expect(await readAttachment(value, reference, options)).toEqual({
      ok: true,
      data: new Uint8Array([0, 255, 128]).buffer,
    });
    await writeFile(target, Buffer.alloc(MAX_IMAGE_BYTES + 1));
    expect(await readAttachment(value, reference, options)).toMatchObject({
      ok: false,
      reason: 'too-large',
    });
    await rm(target);
    await mkdir(target);
    expect(await readAttachment(value, reference, options)).toMatchObject({
      ok: false,
      reason: 'not-regular',
    });
    await rm(target, { recursive: true });
    await writeFile(join(dir, 'secret'), 'private');
    await symlink(join(dir, 'secret'), target);
    expect(await readAttachment(value, reference, options)).toMatchObject({
      ok: false,
      reason: 'unsafe-link',
    });
  });

  it('retains native default diagnostic text and isolates a throwing console sink', async () => {
    const sink = vi.spyOn(console, 'error').mockImplementation(() => {
      throw new Error('sink');
    });
    expect(await readAttachment(session(), 'unknown')).toEqual({
      ok: false,
      reason: 'not-authorized',
      message: "Attachments are read only from the review's .self-review-assets directory",
    });
    expect(sink).toHaveBeenCalledExactlyOnceWith('[attachment:read] Refused: "unknown"');
  });
});
