import { afterEach, expect, it, vi } from 'vitest';
import { createFetchAdapter } from './adapter';
import { createServeRequester } from './requester';
import {
  createReviewSession,
  createReviewSessionStore,
} from '../../../react/src/context/review-session';
import { createReviewSessionController } from '../../../react/src/context/review-session-controller';

const adapters: ReturnType<typeof createFetchAdapter>[] = [];
afterEach(() => {
  adapters.splice(0).forEach(adapter => adapter.dispose());
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}
const payload = (path = '/review') => ({
  files: [],
  source: { type: 'directory' as const, sourcePath: path },
});
const json = (value: unknown) =>
  new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
const diff = (path = '/review') => json({ diff: payload(path), guide: null });
function fixture(fetch: typeof globalThis.fetch) {
  const adapter = createFetchAdapter('memory-key', createServeRequester('memory-key', { fetch }));
  adapters.push(adapter);
  return adapter;
}
const tick = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

it('keeps pre-aborted initial HTTP reads transport-free', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>();
  const adapter = fixture(fetch);
  const abort = new AbortController();
  abort.abort();
  await expect(adapter.initialReads!.loadDiff!(abort.signal)).rejects.toThrow(/cancel/);
  await expect(adapter.initialReads!.loadResumedReview!(abort.signal)).rejects.toThrow(/cancel/);
  expect(fetch).not.toHaveBeenCalled();
});
it('shares subscription prefetch, cancels an abandoned owner and excludes its late cache result', async () => {
  const first = deferred<Response>();
  const second = deferred<Response>();
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  const adapter = fixture(fetch);
  const push = vi.fn();
  adapter.onDiffLoad!(push);
  expect(fetch).toHaveBeenCalledTimes(1);
  const abort = new AbortController();
  const old = adapter.initialReads!.loadDiff!(abort.signal);
  const refused = expect(old).rejects.toThrow(/cancel/);
  abort.abort();
  await refused;
  expect(fetch.mock.calls[0][1]!.signal!.aborted).toBe(true);
  const current = adapter.initialReads!.loadDiff!(new AbortController().signal);
  expect(fetch).toHaveBeenCalledTimes(2);
  first.resolve(diff('/old'));
  await tick();
  expect(push).not.toHaveBeenCalled();
  second.resolve(diff('/current'));
  expect(await current).toEqual(payload('/current'));
  expect(push).toHaveBeenCalledExactlyOnceWith(payload('/current'));
  expect(await adapter.loadDiff()).toEqual(payload('/current'));
  expect(fetch).toHaveBeenCalledTimes(2);
});
it('cancels one owned HTTP borrower without aborting another and retains the successful cache', async () => {
  const response = deferred<Response>();
  const fetch = vi.fn<typeof globalThis.fetch>().mockReturnValue(response.promise);
  const adapter = fixture(fetch);
  const abort = new AbortController();
  const first = adapter.initialReads!.loadDiff!(abort.signal);
  const refused = expect(first).rejects.toThrow(/cancel/);
  const second = adapter.initialReads!.loadDiff!(new AbortController().signal);
  abort.abort();
  await refused;
  expect(fetch.mock.calls[0][1]!.signal!.aborted).toBe(false);
  response.resolve(diff());
  expect(await second).toEqual(payload());
  expect(await adapter.initialReads!.loadDiff!(new AbortController().signal)).toEqual(payload());
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('retains a shared HTTP request needed by a legacy caller when an owned borrower cancels', async () => {
  const response = deferred<Response>();
  const fetch = vi.fn<typeof globalThis.fetch>().mockReturnValue(response.promise);
  const adapter = fixture(fetch);
  const legacy = adapter.loadDiff();
  void legacy.catch(() => {});
  const abort = new AbortController();
  const owned = adapter.initialReads!.loadDiff!(abort.signal);
  const refused = expect(owned).rejects.toThrow(/cancel/);
  abort.abort();
  await refused;
  expect(fetch.mock.calls[0][1]!.signal!.aborted).toBe(false);
  response.resolve(diff());
  expect(await legacy).toEqual(payload());
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('cancels the correlated initial HTTP resume request and explicitly retries an empty acknowledgement', async () => {
  const response = deferred<Response>();
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockReturnValueOnce(response.promise)
    .mockResolvedValueOnce(json(null));
  const adapter = fixture(fetch);
  const abort = new AbortController();
  const resumed = adapter.initialReads!.loadResumedReview!(abort.signal);
  const refused = expect(resumed).rejects.toThrow(/cancel/);
  abort.abort();
  await refused;
  expect(fetch.mock.calls[0][1]!.signal!.aborted).toBe(true);
  expect(await adapter.initialReads!.loadResumedReview!(new AbortController().signal)).toEqual({
    comments: [],
    viewedFiles: [],
  });
  response.resolve(json({ comments: [], viewedFiles: ['old.ts'] }));
  await tick();
  expect(fetch.mock.calls.map(([url]) => url)).toEqual(['/api/resume', '/api/resume']);
});
it('hydrates the real controller through a shared initial diff echo and an owned resume read', async () => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockImplementation(async input =>
      String(input) === '/api/diff' ? diff() : json({ comments: [], viewedFiles: [] })
    );
  const adapter = fixture(fetch);
  expect(adapter.initialReads!.loadDiff).toBeTypeOf('function');
  const store = createReviewSessionStore(createReviewSession());
  const controller = createReviewSessionController(store, adapter);
  const deactivate = controller.activate();
  const disconnect = controller.connect();
  try {
    await vi.waitFor(() => {
      expect(store.getSnapshot().diffSource).toEqual(payload().source);
      expect(store.getSnapshot().resumePending).toBe(false);
    });
    expect(store.getSnapshot().loadError).toBeNull();
    expect(store.getSnapshot().resumeError).toBeNull();
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(['/api/diff', '/api/resume']);
  } finally {
    disconnect();
    deactivate();
  }
});
