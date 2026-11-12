import type { BrowserWindow, IpcMain } from 'electron';
import { expect, it, vi } from 'vitest';
import { createDesktopSession } from './desktop-session';
import { createIpcBoundary } from './ipc-boundary';
import { registerLifecycleHandlers } from './lifecycle-handlers';
import { registerContentHandlers } from './content-ipc';
import { bindDesktopReviewOperations } from './review-operations';
import { QuitController } from './quit-controller';
import { IPC } from '../shared/ipc-channels';
import type { ReviewState } from '../shared/types';
function fixture() {
  const handlers: Record<string, (...args: unknown[]) => unknown> = {};
  const register = (channel: string, handler: (...args: unknown[]) => unknown) => {
    handlers[channel] = handler;
  };
  const mainFrame = {};
  const sender = { mainFrame, isDestroyed: () => false, send: vi.fn() };
  let window = { isDestroyed: () => false, webContents: sender } as unknown as BrowserWindow;
  const boundary = createIpcBoundary(
    { on: register, handle: register } as unknown as IpcMain,
    () => window
  );
  const desktop = createDesktopSession('/review');
  registerContentHandlers(
    bindDesktopReviewOperations(desktop.review),
    boundary,
    desktop.operations
  );
  const controller = new QuitController();
  const publish = vi.fn(async () => {});
  const shutdown = vi.fn(async () => {});
  const reportSaveFailure = vi.fn(async () => {});
  const pickOutputPath = vi.fn(async () => null);
  registerLifecycleHandlers(
    desktop,
    boundary,
    controller,
    shutdown,
    { publish },
    { reportSaveFailure, pickOutputPath }
  );
  return {
    desktop,
    controller,
    publish,
    shutdown,
    reportSaveFailure,
    replacePeer: () => {
      window = {
        isDestroyed: () => false,
        webContents: { isDestroyed: () => false },
      } as unknown as BrowserWindow;
    },
    invoke: (channel: string, ...args: unknown[]) =>
      handlers[channel]({ sender, senderFrame: mainFrame }, ...args),
  };
}
const state: ReviewState = {
  timestamp: 'now',
  source: { type: 'directory', sourcePath: '/review' },
  files: [],
};
it('waits for Apply before saving, ignores competing discard/save, and supplies owned cancellation', async () => {
  const f = fixture();
  f.desktop.review.reviewState = state;
  let finish!: () => void;
  const applying = f.desktop.operations.apply(
    () =>
      new Promise<void>(resolve => {
        finish = resolve;
      })
  );
  f.invoke(IPC.APP_SAVE_AND_QUIT);
  f.invoke(IPC.APP_DISCARD_AND_QUIT);
  f.invoke(IPC.APP_SAVE_AND_QUIT);
  await Promise.resolve();
  expect(f.publish).not.toHaveBeenCalled();
  expect(f.shutdown).not.toHaveBeenCalled();
  finish();
  await applying;
  await vi.waitFor(() => expect(f.shutdown).toHaveBeenCalledExactlyOnceWith(0, 'saved'));
  expect(f.publish).toHaveBeenCalledExactlyOnceWith(state, expect.any(AbortSignal));
});
it('waits for Apply before discarding and never publishes on discard', async () => {
  const f = fixture();
  let finish!: () => void;
  const applying = f.desktop.operations.apply(
    () =>
      new Promise<void>(resolve => {
        finish = resolve;
      })
  );
  await Promise.resolve();
  f.invoke(IPC.APP_DISCARD_AND_QUIT);
  await Promise.resolve();
  expect(f.shutdown).not.toHaveBeenCalled();
  finish();
  await applying;
  await vi.waitFor(() => expect(f.shutdown).toHaveBeenCalledExactlyOnceWith(0, 'discard'));
  expect(f.publish).not.toHaveBeenCalled();
});
it('reports missing state and publication failure without exiting, then accepts a fresh save', async () => {
  const f = fixture();
  f.invoke(IPC.APP_SAVE_AND_QUIT);
  await vi.waitFor(() =>
    expect(f.reportSaveFailure).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ code: 'no-review-state' })
    )
  );
  expect(f.publish).not.toHaveBeenCalled();
  f.desktop.review.reviewState = state;
  f.publish.mockRejectedValueOnce(new Error('disk full'));
  f.invoke(IPC.APP_SAVE_AND_QUIT);
  await vi.waitFor(() => expect(f.reportSaveFailure).toHaveBeenCalledTimes(2));
  expect(f.controller.phase).toBe('reviewing');
  expect(f.shutdown).not.toHaveBeenCalled();
  f.desktop.review.reviewState = state;
  f.invoke(IPC.APP_SAVE_AND_QUIT);
  await vi.waitFor(() => expect(f.shutdown).toHaveBeenCalledOnce());
});

it('acknowledges disk publication before permitting close and deduplicates overlapping saves', async () => {
  const f = fixture();
  f.desktop.review.diffData = { files: [], source: state.source };
  let finish!: () => void;
  f.publish.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      })
  );
  const saving = f.invoke(IPC.REVIEW_SAVE, state) as Promise<
    import('../shared/types').ReviewSaveResult
  >;
  await vi.waitFor(() => expect(f.publish).toHaveBeenCalledOnce());
  expect(await f.invoke(IPC.REVIEW_SAVE, state)).toEqual({ status: 'busy' });
  f.invoke(IPC.APP_DISCARD_AND_QUIT);
  expect(f.controller.closeRequested(true)).toBe('ignore');
  expect(f.shutdown).not.toHaveBeenCalled();
  finish();
  const result = await saving;
  expect(result.status).toBe('saved');
  expect(f.desktop.operations.finishing).toBe(true);
  expect(f.shutdown).not.toHaveBeenCalled();
  expect(f.invoke(IPC.REVIEW_SAVE_STATUS)).toEqual(result);
  if (result.status !== 'saved') throw new Error('expected receipt');
  f.invoke(IPC.REVIEW_SAVE_RECEIVED, 'stale');
  expect(f.shutdown).not.toHaveBeenCalled();
  f.invoke(IPC.REVIEW_SAVE_RECEIVED, result.receipt);
  await vi.waitFor(() => expect(f.shutdown).toHaveBeenCalledExactlyOnceWith(0, 'saved'));
  expect(f.controller.mayQuit).toBe(true);
});

it('returns a known failure with retained renderer state and accepts a fresh snapshot', async () => {
  const f = fixture();
  f.desktop.review.diffData = { files: [], source: state.source };
  f.publish.mockRejectedValueOnce(new Error('disk full'));
  expect(await f.invoke(IPC.REVIEW_SAVE, state)).toMatchObject({
    status: 'failed',
    message: expect.stringContaining('disk full'),
  });
  expect(f.controller.phase).toBe('reviewing');
  expect(f.desktop.operations.finishing).toBe(false);
  expect(f.shutdown).not.toHaveBeenCalled();
  expect(await f.invoke(IPC.REVIEW_SAVE, state)).toMatchObject({ status: 'saved' });
  expect(f.publish).toHaveBeenCalledTimes(2);
});

it('refuses missing and stale state without writing', async () => {
  const f = fixture();
  expect(await f.invoke(IPC.REVIEW_SAVE, state)).toMatchObject({ status: 'failed' });
  f.desktop.review.diffData = { files: [], source: { type: 'directory', sourcePath: '/another' } };
  expect(await f.invoke(IPC.REVIEW_SAVE, state)).toMatchObject({ status: 'failed' });
  f.desktop.review.diffData = { files: [], source: { type: 'welcome' } };
  expect(await f.invoke(IPC.REVIEW_SAVE, { ...state, source: { type: 'welcome' } })).toMatchObject({
    status: 'failed',
  });
  expect(f.publish).not.toHaveBeenCalled();
});

it('keeps a committed result after cancellation and never converts a replaced peer into a refusal', async () => {
  const f = fixture();
  f.desktop.review.diffData = { files: [], source: state.source };
  let finish!: () => void;
  f.publish.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      })
  );
  const saving = f.invoke(IPC.REVIEW_SAVE, state) as Promise<unknown>;
  await vi.waitFor(() => expect(f.publish).toHaveBeenCalledOnce());
  const disposal = f.desktop.operations.dispose('signal');
  finish();
  expect(await saving).toMatchObject({ status: 'saved' });
  await disposal;
  f.replacePeer();
  expect(() => f.invoke(IPC.REVIEW_SAVE_STATUS)).toThrow(/current review window/);
  expect(f.shutdown).not.toHaveBeenCalled();
});

it('refuses overloaded snapshots before publication and keeps review state and window open', async () => {
  const f = fixture();
  f.desktop.review.diffData = { files: [], source: state.source };
  f.desktop.review.reviewState = state;
  const overloaded = { ...state, timestamp: 'a'.repeat(16 * 1024 * 1024) };
  expect(await f.invoke(IPC.REVIEW_SAVE, overloaded)).toMatchObject({
    status: 'failed',
    message: expect.stringContaining('limits'),
  });
  expect(await f.invoke(IPC.REVIEW_SAVE_STATUS)).toMatchObject({ status: 'failed' });
  expect(f.desktop.review.reviewState).toBe(state);
  expect(f.controller.phase).toBe('reviewing');
  expect(f.desktop.operations.finishing).toBe(false);
  expect(f.publish).not.toHaveBeenCalled();
  expect(f.shutdown).not.toHaveBeenCalled();
});

it('admits busy saves before inspecting their payload', async () => {
  const f = fixture();
  f.controller.beginSave();
  expect(await f.invoke(IPC.REVIEW_SAVE, null)).toEqual({ status: 'busy' });
  expect(f.publish).not.toHaveBeenCalled();
});

it('never publishes an older legacy snapshot after an overloaded submission is refused', async () => {
  const f = fixture();
  f.desktop.review.diffData = { files: [], source: state.source };
  f.desktop.review.reviewState = state;
  f.invoke(IPC.REVIEW_SUBMIT, { ...state, files: new Array(50_001) });
  f.invoke(IPC.APP_SAVE_AND_QUIT);
  await vi.waitFor(() => expect(f.reportSaveFailure).toHaveBeenCalled());
  expect(f.publish).not.toHaveBeenCalled();
  expect(f.shutdown).not.toHaveBeenCalled();
  expect(f.controller.phase).toBe('reviewing');
});

it.each([false, true])(
  'publishes equivalent source fields in a different insertion order with extensions=%s',
  async extension => {
    const f = fixture();
    f.desktop.review.diffData = {
      files: [],
      source: { type: 'git', repository: '/repo', gitDiffArgs: '--staged' },
    };
    const submitted: ReviewState = {
      ...state,
      source: {
        gitDiffArgs: '--staged',
        repository: '/repo',
        type: 'git',
        ...(extension ? { extension: 'keep' } : {}),
      } as ReviewState['source'],
    };
    expect(await f.invoke(IPC.REVIEW_SAVE, submitted)).toMatchObject({ status: 'saved' });
    expect(f.publish).toHaveBeenCalledExactlyOnceWith(submitted, expect.any(AbortSignal));
  }
);

it('consumes a publication receipt only once', async () => {
  const f = fixture();
  f.desktop.review.diffData = { files: [], source: state.source };
  const saved = (await f.invoke(
    IPC.REVIEW_SAVE,
    state
  )) as import('../shared/types').ReviewSaveResult;
  if (saved.status !== 'saved') throw new Error('expected receipt');
  f.invoke(IPC.REVIEW_SAVE_RECEIVED, saved.receipt);
  f.invoke(IPC.REVIEW_SAVE_RECEIVED, saved.receipt);
  expect(f.shutdown).toHaveBeenCalledExactlyOnceWith(0, 'saved');
  expect(f.invoke(IPC.REVIEW_SAVE_STATUS)).toBeNull();
});
