import { expect, it, vi } from 'vitest';
import { createReviewSession } from '../../packages/core/src/review-handlers';
import { bindDesktopReviewOperations } from './review-operations';
import { registerContentHandlers } from './content-ipc';
import { DesktopOperations } from './desktop-operations';
import { IPC } from '../shared/ipc-channels';
import type { createIpcBoundary } from './ipc-boundary';

it('registers content capabilities against supplied operations without engine module mocking', async () => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const register = (name: string, _decode: unknown, handler: (...args: unknown[]) => unknown) =>
    handlers.set(name, handler);
  const boundary = { on: register, handle: register } as unknown as ReturnType<
    typeof createIpcBoundary
  >;
  const read = vi.fn(async () => ({ dataUri: 'data:image/png;base64,AA==' }));
  registerContentHandlers(
    {
      getDiffLoad: () => null,
      getConfigLoad: () => null,
      getResumeLoad: () => null,
      getFileHunks: () => null,
      submitReviewState: vi.fn(),
      expandContext: async () => null,
      readAttachment: async () => ({ ok: false, reason: 'not-authorized', message: 'missing' }),
      loadImage: read,
    },
    boundary,
    new DesktopOperations()
  );
  expect(await handlers.get(IPC.DIFF_LOAD_IMAGE)!({}, 'a.png')).toEqual({
    dataUri: 'data:image/png;base64,AA==',
  });
  expect(read).toHaveBeenCalledWith('a.png', expect.any(AbortSignal));
});

it('binds current snapshot ownership and refuses mutations while publication owns the review', () => {
  const session = createReviewSession();
  let writable = true;
  const operations = bindDesktopReviewOperations(session, () => writable);
  const current = operations.captureSnapshot();
  current();
  session.diffData = { source: { type: 'welcome' }, files: [] };
  expect(current).toThrow(/session has changed/);
  writable = false;
  expect(() =>
    operations.submitReviewState({ timestamp: '', source: { type: 'welcome' }, files: [] })
  ).toThrow(/finishing/);
  expect(session.reviewState).toBeNull();
});
