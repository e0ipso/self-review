import { mkdtemp, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadImage } from './review-content';
import { commitDiffData, createReviewSession } from './review-session';
import { commitReviewStart, prepareDirectoryReview } from './review-start';
import { nodeScanFsLayer } from './node-scan-fs';
import { MAX_IMAGE_BYTES } from './input-budgets';
import { RELOAD_REVIEW } from './loaded-snapshot';
import { CommandCancelledError } from './forge-provider';

describe('per-operation image diagnostics', () => {
  const directories: string[] = [];
  afterEach(async () => {
    for (const directory of directories.splice(0)) await rm(directory, { recursive: true });
  });

  async function imageSession() {
    const directory = await mkdtemp(join(tmpdir(), 'image-effects-'));
    directories.push(directory);
    const image = join(directory, 'image.png');
    await writeFile(image, Buffer.from([0, 255, 128]));
    const session = createReviewSession();
    let beforeRead: (() => Promise<void>) | undefined;
    let closes = 0;
    const scanFs = {
      ...nodeScanFsLayer,
      async open(target: string, flags: number, mode?: number) {
        const handle = await nodeScanFsLayer.open(target, flags, mode);
        return {
          stat: () => handle.stat(),
          async read(buffer: Buffer, offset: number, length: number, position: number | null) {
            await beforeRead?.();
            return handle.read(buffer, offset, length, position);
          },
          async close() {
            closes++;
            await handle.close();
          },
        };
      },
    };
    const loaded = await prepareDirectoryReview(session, directory, {
      scanFs,
      reportDiagnostic: () => {},
    });
    commitReviewStart(session, loaded.payload, loaded.identity, loaded.loadedReview);
    return {
      session,
      image,
      blockRead: (fn: () => Promise<void>) => {
        beforeRead = fn;
      },
      closes: () => closes,
    };
  }

  it('routes a real stale captured read to only that operation reporter', async () => {
    const first = await imageSession();
    const second = await imageSession();
    await writeFile(first.image, Buffer.from([0, 1, 2, 3]));
    const firstReport = vi.fn();
    const secondReport = vi.fn();
    const [failed, successful] = await Promise.all([
      loadImage(first.session, 'image.png', { reportDiagnostic: firstReport }),
      loadImage(second.session, 'image.png', { reportDiagnostic: secondReport }),
    ]);
    expect(failed).toEqual({ error: `Image preview unavailable — ${RELOAD_REVIEW}` });
    expect(firstReport).toHaveBeenCalledExactlyOnceWith(
      `[review] Image preview unavailable for image.png: ${RELOAD_REVIEW}`
    );
    expect(successful).toEqual({ dataUri: 'data:image/png;base64,AP+A' });
    expect(secondReport).not.toHaveBeenCalled();
  });

  it('routes a real failed legacy read without changing its returned message', async () => {
    const { session, image } = await imageSession();
    // A copied logical identity deliberately retains the supported live read route.
    commitDiffData(session, session.diffData!, { ...session.sourceIdentity! });
    await unlink(image);
    const reportDiagnostic = vi.fn();
    expect(await loadImage(session, 'image.png', { reportDiagnostic })).toEqual({
      error: 'Image preview unavailable — The file does not exist on this side of the review.',
    });
    expect(reportDiagnostic).toHaveBeenCalledExactlyOnceWith(
      '[review] Image preview unavailable for image.png: The file does not exist on this side of the review.'
    );
  });

  it.each(['throw', 'reject'])(
    'preserves the refused result when a reporter fails by %s',
    async mode => {
      const { session, image } = await imageSession();
      await unlink(image);
      const reportDiagnostic = vi.fn(() => {
        if (mode === 'throw') throw new Error('Diagnostic sink failed');
        return Promise.reject(new Error('Diagnostic sink rejected'));
      });
      expect(await loadImage(session, 'image.png', { reportDiagnostic })).toEqual({
        error: `Image preview unavailable — ${RELOAD_REVIEW}`,
      });
      expect(reportDiagnostic).toHaveBeenCalledTimes(1);
      await Promise.resolve();
    }
  );

  it('keeps image byte and membership refusals silent', async () => {
    const { session, image } = await imageSession();
    commitDiffData(session, session.diffData!, { ...session.sourceIdentity! });
    await writeFile(image, Buffer.alloc(MAX_IMAGE_BYTES + 1));
    const reportDiagnostic = vi.fn();
    expect(await loadImage(session, 'image.png', { reportDiagnostic })).toEqual({
      error: 'File too large to preview (>10 MB)',
    });
    expect(await loadImage(session, 'other.png', { reportDiagnostic })).toEqual({
      error: 'Image preview unavailable — this file is not part of the reviewed diff.',
    });
    expect(reportDiagnostic).not.toHaveBeenCalled();
  });

  it('propagates cancellation after closing the captured descriptor without reporting it', async () => {
    const image = await imageSession();
    const controller = new AbortController();
    const reportDiagnostic = vi.fn();
    const closedBefore = image.closes();
    image.blockRead(async () => {
      controller.abort();
    });
    await expect(
      loadImage(image.session, 'image.png', { signal: controller.signal, reportDiagnostic })
    ).rejects.toBeInstanceOf(CommandCancelledError);
    expect(image.closes()).toBe(closedBefore + 1);
    expect(reportDiagnostic).not.toHaveBeenCalled();
  });

  it('discards a pending read after the session is replaced without reporting a refusal', async () => {
    const image = await imageSession();
    const reportDiagnostic = vi.fn();
    const closedBefore = image.closes();
    image.blockRead(async () => {
      commitDiffData(image.session, image.session.diffData!, null);
    });
    expect(await loadImage(image.session, 'image.png', { reportDiagnostic })).toEqual({
      error: 'Image preview unavailable — the loaded review changed.',
    });
    expect(image.closes()).toBe(closedBefore + 1);
    expect(reportDiagnostic).not.toHaveBeenCalled();
  });
});
