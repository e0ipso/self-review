import { expect, it, vi } from 'vitest';
const calls = vi.hoisted(() => ({ source: vi.fn(), load: vi.fn() }));
vi.mock('./cli', () => ({ parseCliArgs: () => ({ gitDiffArgs: [] }) }));
vi.mock('./presentation', () => ({ confirmPayload: vi.fn(async () => true) }));
vi.mock('../../packages/core/src/startup-mode', () => ({
  resolveStartupSource: () => {
    throw new Error('synchronous probe invoked');
  },
  resolveStartupSourceAsync: calls.source,
}));
vi.mock('../../packages/core/src/startup', async importOriginal => ({
  ...(await importOriginal<typeof import('../../packages/core/src/startup')>()),
  loadLocalReview: calls.load,
}));
import { initializeSession } from './startup';
import { createDesktopSession } from './desktop-session';
it('uses asynchronous probes and threads the startup owner through the sixth load argument', async () => {
  const desktop = createDesktopSession(process.cwd());
  calls.source.mockResolvedValue({ mode: 'welcome' });
  calls.load.mockResolvedValue({
    payload: { files: [], source: { type: 'welcome' } },
    identity: null,
  });
  const abort = new AbortController();
  await expect(initializeSession(desktop, abort.signal)).resolves.toBe(true);
  expect(calls.source).toHaveBeenCalledWith([], process.cwd(), {
    signal: abort.signal,
    timeoutMs: 30_000,
  });
  expect(calls.load).toHaveBeenCalledWith(
    { mode: 'welcome' },
    [],
    expect.anything(),
    process.cwd(),
    expect.any(Function),
    { signal: abort.signal, timeoutMs: 30_000 }
  );
});
it('does not commit a completed local load after startup cancellation', async () => {
  const desktop = createDesktopSession(process.cwd());
  calls.source.mockResolvedValue({ mode: 'welcome' });
  const abort = new AbortController();
  const reason = new Error('startup expired');
  calls.load.mockImplementation(async () => {
    abort.abort(reason);
    return { payload: { files: [], source: { type: 'welcome' } }, identity: null };
  });
  await expect(initializeSession(desktop, abort.signal)).rejects.toBe(reason);
  expect(desktop.review.diffData).toBeNull();
});
