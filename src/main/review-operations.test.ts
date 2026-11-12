import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { IpcMainInvokeEvent } from 'electron';
import { CommandCancelledError } from '../../packages/core/src/forge-provider';
import { startDirectoryReview } from './directory-review';
import { DirectorySelection } from './directory-selection';
import { ReviewTransition } from './review-transition';
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
  const boundary = { onCommand: register, handleCommand: register } as unknown as ReturnType<
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
      invalidateReviewState: vi.fn(),
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

it('passes a directory operation cancellation through its bound engine before source loading', async () => {
  const root = await mkdtemp(join(tmpdir(), 'desktop-cancel-scan-'));
  try {
    await writeFile(join(root, 'a.ts'), 'unchanged\n');
    const session = createReviewSession();
    session.diffData = { source: { type: 'welcome' }, files: [] };
    const transition = new ReviewTransition(session);
    const capture = () => () => {};
    const selection = new DirectorySelection(transition, capture, async () => root);
    const event = {} as IpcMainInvokeEvent;
    await selection.choose(event);
    const boundary = { capture } as unknown as ReturnType<typeof createIpcBoundary>;
    const abort = new AbortController();
    abort.abort(new Error('window replaced'));
    await expect(
      startDirectoryReview(
        event,
        root,
        abort.signal,
        bindDesktopReviewOperations(session),
        boundary,
        transition,
        selection,
        { confirmPayload: vi.fn(async () => true) }
      )
    ).rejects.toBeInstanceOf(CommandCancelledError);
    expect(session.diffData.source.type).toBe('welcome');
    expect(session.reviewedPaths.size).toBe(0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
