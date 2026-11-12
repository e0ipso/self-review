import { expect, it, vi } from 'vitest';
import type { BrowserWindow } from 'electron';
import { PublishedReviewRecovery } from './published-review-recovery';

function fixture() {
  const window = { isDestroyed: () => false } as BrowserWindow;
  let current: BrowserWindow | null = window;
  let failure = false;
  let generation = 0;
  let answer!: (yes: boolean) => void;
  const confirm = vi.fn(
    () =>
      new Promise<boolean>(resolve => {
        answer = resolve;
      })
  );
  const quit = vi.fn();
  const recovery = new PublishedReviewRecovery({
    getWindow: () => current,
    captureFailure: () => {
      const own = generation;
      return failure ? () => failure && own === generation : null;
    },
    confirm,
    quit,
  });
  return {
    window,
    recovery,
    confirm,
    quit,
    answer: (yes: boolean) => answer(yes),
    fail: () => {
      failure = true;
    },
    restore: () => {
      failure = false;
      generation++;
    },
    replace: () => {
      current = { isDestroyed: () => false } as BrowserWindow;
    },
  };
}
it('delivers a known publication result natively only after a confirmed renderer failure', async () => {
  const f = fixture();
  expect(f.recovery.requestClose()).toBe(false);
  f.recovery.record(f.window);
  expect(f.recovery.requestClose()).toBe(false);
  f.fail();
  expect(f.recovery.requestClose()).toBe(true);
  expect(f.recovery.requestClose()).toBe(true);
  await vi.waitFor(() => expect(f.confirm).toHaveBeenCalledOnce());
  expect(f.quit).not.toHaveBeenCalled();
  f.answer(true);
  await vi.waitFor(() => expect(f.quit).toHaveBeenCalledOnce());
});
it.each(['restore', 'replace'] as const)(
  'drops a stale native publication confirmation after %s',
  async change => {
    const f = fixture();
    f.recovery.record(f.window);
    f.fail();
    f.recovery.requestClose();
    await vi.waitFor(() => expect(f.confirm).toHaveBeenCalledOnce());
    f[change]();
    f.answer(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(f.quit).not.toHaveBeenCalled();
  }
);
it('does not fabricate a publication receipt for a crashed unsaved review', () => {
  const f = fixture();
  f.fail();
  expect(f.recovery.requestClose()).toBe(false);
  expect(f.confirm).not.toHaveBeenCalled();
});

it('delivers a native receipt to a replaced renderer and ignores another replacement during the prompt', async () => {
  const originalFrame = {} as BrowserWindow['webContents']['mainFrame'];
  const window = {
    isDestroyed: () => false,
    webContents: { mainFrame: originalFrame },
  } as unknown as BrowserWindow;
  let answer!: (value: boolean) => void;
  const confirm = vi.fn(
    () =>
      new Promise<boolean>(resolve => {
        answer = resolve;
      })
  );
  const quit = vi.fn();
  const recovery = new PublishedReviewRecovery({
    getWindow: () => window,
    captureFailure: () => null,
    confirm,
    quit,
  });
  recovery.record(window, originalFrame);
  expect(recovery.requestClose()).toBe(false);
  Object.assign(window.webContents, { mainFrame: {} });
  expect(recovery.requestClose()).toBe(true);
  await vi.waitFor(() => expect(confirm).toHaveBeenCalledOnce());
  Object.assign(window.webContents, { mainFrame: {} });
  answer(true);
  await Promise.resolve();
  await Promise.resolve();
  expect(quit).not.toHaveBeenCalled();
});
