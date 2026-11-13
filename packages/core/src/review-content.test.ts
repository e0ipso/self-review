import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { open } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { AsyncReadHandle } from './safe-fs-read';
import { readAttachment } from './review-content';
import { createReviewSession } from './review-session';

// Real no-follow reader and native file handle, with cancellation at a controlled chunk boundary.
vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, open: vi.fn(actual.open) };
});
const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
let root: string | undefined;
afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(open).mockReset().mockImplementation(actual.open);
  if (root) rmSync(root, { recursive: true, force: true });
});

describe('attachment wrapper cancellation', () => {
  it.each([undefined, new Error('review replaced')])(
    'stops after the first chunk and closes the real file, reason %s',
    async reason => {
      root = realpathSync(mkdtempSync(join(tmpdir(), 'sr-attachment-cancel-')));
      mkdirSync(join(root, '.self-review-assets'));
      const asset = join(root, '.self-review-assets', 'a.png');
      writeFileSync(asset, Buffer.alloc(256 * 1024, 1));
      const state = createReviewSession();
      state.attachmentOrigins = new Map([['.self-review-assets/a.png', asset]]);
      const controller = new AbortController();
      let reads = 0;
      let closed = false;
      vi.mocked(open).mockImplementationOnce(async (...args) => {
        const handle = await actual.open(...args);
        const read = handle.read.bind(handle);
        const close = handle.close.bind(handle);
        vi.spyOn(handle as Pick<AsyncReadHandle, 'read'>, 'read').mockImplementation(
          async (...readArgs) => {
            const result = await read(...readArgs);
            reads++;
            if (reads === 1) controller.abort(reason);
            return result;
          }
        );
        vi.spyOn(handle, 'close').mockImplementation(async () => {
          closed = true;
          return close();
        });
        return handle;
      });
      await expect(
        readAttachment(state, '.self-review-assets/a.png', { signal: controller.signal })
      ).rejects.toMatchObject({ name: 'CommandCancelledError', reason: 'aborted' });
      expect(reads).toBe(1);
      expect(closed).toBe(true);
    }
  );
});
