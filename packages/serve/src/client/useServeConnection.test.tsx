// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useServeConnection } from './useServeConnection';
const key = 'memory-only-capability';
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}
const success = () => new Response('null', { headers: { 'content-type': 'application/json' } });
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it('retries only config after a transient refusal, with a fresh adapter and an in-memory key', async () => {
  const persist = vi.spyOn(Storage.prototype, 'setItem');
  const history = vi.spyOn(window.history, 'replaceState');
  const log = vi.spyOn(console, 'log');
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(new Response('{"error":"busy"}', { status: 503 }))
    .mockResolvedValueOnce(success())
    .mockResolvedValue(success());
  vi.stubGlobal('fetch', fetch);
  const { result, rerender } = renderHook(() => useServeConnection(key));
  await waitFor(() => expect(result.current.error?.message).toContain('503'));
  expect(fetch).toHaveBeenCalledTimes(1);
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.connection).not.toBeNull());
  expect(result.current.error).toBeNull();
  expect(fetch.mock.calls.map(([url]) => url)).toEqual(['/api/config', '/api/config']);
  for (const [, init] of fetch.mock.calls) {
    expect(new Headers(init!.headers).get('authorization')).toBe(`Bearer ${key}`);
  }
  const adapter = result.current.connection!.adapter;
  rerender();
  act(() => result.current.retry());
  expect(result.current.connection!.adapter).toBe(adapter);
  expect(JSON.stringify(result.current)).not.toContain(key);
  expect(window.location.href).not.toContain(key);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(persist).not.toHaveBeenCalled();
  expect(history).not.toHaveBeenCalled();
  expect(log).not.toHaveBeenCalled();
});
it('aborts retired attempts and ignores out-of-order results during repeated retries and unmount', async () => {
  const responses = [deferred<Response>(), deferred<Response>(), deferred<Response>()];
  let requestIndex = 0;
  const fetch = vi.fn<typeof globalThis.fetch>(() => responses[requestIndex++].promise);
  vi.stubGlobal('fetch', fetch);
  const { result, unmount } = renderHook(() => useServeConnection(key));
  const firstSignal = fetch.mock.calls[0][1]!.signal!;
  act(() => result.current.retry());
  expect(firstSignal.aborted).toBe(true);
  const secondSignal = fetch.mock.calls[1][1]!.signal!;
  act(() => result.current.retry());
  expect(secondSignal.aborted).toBe(true);
  await act(async () => {
    responses[1].resolve(success());
    responses[0].resolve(success());
  });
  expect(result.current.connection).toBeNull();
  expect(result.current.error).toBeNull();
  const currentSignal = fetch.mock.calls[2][1]!.signal!;
  unmount();
  expect(currentSignal.aborted).toBe(true);
  await act(async () => responses[2].resolve(success()));
});
it('retires a timed-out owner, reports a failed retry and can retry again', async () => {
  vi.useFakeTimers();
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockImplementationOnce(() => new Promise(() => {}))
    .mockResolvedValueOnce(new Response('{"error":"still offline"}', { status: 503 }))
    .mockResolvedValueOnce(success());
  vi.stubGlobal('fetch', fetch);
  const { result } = renderHook(() => useServeConnection(key));
  await act(async () => vi.advanceTimersByTimeAsync(30_000));
  expect(result.current.error?.message).toContain('timed out');
  expect(fetch.mock.calls[0][1]!.signal!.aborted).toBe(true);
  await act(async () => result.current.retry());
  expect(result.current.error?.message).toContain('still offline');
  await act(async () => result.current.retry());
  expect(result.current.connection).not.toBeNull();
  expect(result.current.error).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
});
it('handles StrictMode replay and capability replacement without keeping old adapters alive', async () => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockImplementation(() => Promise.resolve(success()));
  vi.stubGlobal('fetch', fetch);
  const { result, rerender, unmount } = renderHook(
    ({ capability }) => useServeConnection(capability),
    { reactStrictMode: true, initialProps: { capability: key as string | null } }
  );
  await waitFor(() => expect(result.current.connection).not.toBeNull());
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls[0][1]!.signal!.aborted).toBe(true);
  const first = result.current.connection!.adapter;
  rerender({ capability: 'replacement-key' });
  await waitFor(() => expect(result.current.connection?.adapter).toBeTruthy());
  await expect(first.loadDiff()).rejects.toThrow('disconnected');
  expect(new Headers(fetch.mock.calls[2][1]!.headers).get('authorization')).toBe(
    'Bearer replacement-key'
  );
  const second = result.current.connection!.adapter;
  rerender({ capability: null });
  expect(result.current.connection).toBeNull();
  expect(result.current.error).toBeNull();
  await expect(second.loadDiff()).rejects.toThrow('disconnected');
  act(() => result.current.retry());
  expect(fetch).toHaveBeenCalledTimes(3);
  unmount();
});
it('does not retry a missing or unauthorized capability', async () => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValue(new Response('{}', { status: 401 }));
  vi.stubGlobal('fetch', fetch);
  const { result, rerender } = renderHook(({ capability }) => useServeConnection(capability), {
    initialProps: { capability: null as string | null },
  });
  act(() => result.current.retry());
  expect(fetch).not.toHaveBeenCalled();
  rerender({ capability: key });
  await waitFor(() => expect(result.current.error?.unauthorized).toBe(true));
  act(() => result.current.retry());
  expect(fetch).toHaveBeenCalledTimes(1);
});
