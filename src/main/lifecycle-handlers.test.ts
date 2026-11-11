import type { BrowserWindow, IpcMain } from 'electron';
import { expect, it, vi } from 'vitest';
import { createDesktopSession } from './desktop-session';
import { createIpcBoundary } from './ipc-boundary';
import { registerLifecycleHandlers } from './lifecycle-handlers';
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
  const window = { isDestroyed: () => false, webContents: sender } as unknown as BrowserWindow;
  const boundary = createIpcBoundary(
    { on: register, handle: register } as unknown as IpcMain,
    () => window
  );
  const desktop = createDesktopSession('/review');
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
    invoke: (channel: string) => handlers[channel]({ sender, senderFrame: mainFrame }),
  };
}
const state: ReviewState = { timestamp: 'now', source: { type: 'welcome' }, files: [] };
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
