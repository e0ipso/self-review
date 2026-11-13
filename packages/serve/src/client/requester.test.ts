import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServeRequester } from './requester';

afterEach(() => vi.useRealTimers());

it('does not call transport for a pre-aborted signal', async () => {
  const controller = new AbortController();
  controller.abort();
  const transport = vi.fn<typeof fetch>();
  const requester = createServeRequester('secret', { fetch: transport });
  await expect(
    requester.request(
      '/api/file',
      { signal: controller.signal },
      response => response.json(),
      'read'
    )
  ).rejects.toMatchObject({ uncertain: false });
  expect(transport).not.toHaveBeenCalled();
});

it('cleans composed listeners and timers after a body deadline', async () => {
  vi.useFakeTimers();
  const caller = new AbortController();
  const removedCaller = vi.spyOn(caller.signal, 'removeEventListener');
  let signal!: AbortSignal;
  let removedTransport!: ReturnType<typeof vi.spyOn>;
  const requester = createServeRequester('secret', {
    readTimeoutMs: 10,
    fetch: async (_input, init) => {
      signal = init!.signal!;
      removedTransport = vi.spyOn(signal, 'removeEventListener');
      return new Response('{}');
    },
  });
  const reading = requester.request(
    '/api/file',
    { signal: caller.signal },
    () => new Promise(() => {})
  );
  const rejected = expect(reading).rejects.toMatchObject({ uncertain: false });
  await vi.advanceTimersByTimeAsync(10);
  await rejected;
  expect(signal.aborted).toBe(true);
  expect(removedCaller).toHaveBeenCalledWith('abort', expect.any(Function));
  expect(removedTransport).toHaveBeenCalledWith('abort', expect.any(Function));
  expect(vi.getTimerCount()).toBe(0);
});

it.each(['headers', 'body'] as const)(
  'composes caller cancellation during %s and releases listeners and timers',
  async phase => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const add = vi.spyOn(controller.signal, 'addEventListener');
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    let transportSignal: AbortSignal | undefined;
    const transport = vi.fn<typeof fetch>(async (_path, init) => {
      transportSignal = init!.signal!;
      if (phase === 'headers') return new Promise(() => {});
      return new Response('{}');
    });
    const requester = createServeRequester('secret', { fetch: transport });
    const reading = requester.request(
      '/api/file',
      { signal: controller.signal, headers: new Headers({ accept: 'application/json' }) },
      () => new Promise(() => {}),
      'read'
    );
    const rejected = expect(reading).rejects.toMatchObject({ uncertain: false });
    await Promise.resolve();
    controller.abort();
    await rejected;
    expect(transportSignal!.aborted).toBe(true);
    expect(transport.mock.calls[0][1]!.headers).toMatchObject({
      accept: 'application/json',
      authorization: expect.any(String),
    });
    expect(remove.mock.calls[0]).toEqual(['abort', add.mock.calls[0][1]]);
    expect(vi.getTimerCount()).toBe(0);
  }
);

it.each(['success', 'error'] as const)('releases caller listeners on %s', async outcome => {
  vi.useFakeTimers();
  const controller = new AbortController();
  const add = vi.spyOn(controller.signal, 'addEventListener');
  const remove = vi.spyOn(controller.signal, 'removeEventListener');
  const transport = vi.fn<typeof fetch>(async () => {
    if (outcome === 'error') throw new Error('network failure');
    return new Response('{}');
  });
  const requester = createServeRequester('secret', { fetch: transport });
  const result = requester.request('/api/file', { signal: controller.signal }, response =>
    response.json()
  );
  if (outcome === 'success') await expect(result).resolves.toEqual({});
  else await expect(result).rejects.toThrow('network failure');
  expect(remove.mock.calls[0]).toEqual(['abort', add.mock.calls[0][1]]);
  expect(vi.getTimerCount()).toBe(0);
});

describe('page request ownership', () => {
  it('bounds response body reads and aborts their transport', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | null | undefined;
    const transport = vi.fn<typeof fetch>(async (_path, init) => {
      signal = init?.signal;
      return new Response('{}');
    });
    const client = createServeRequester('secret', { fetch: transport, readTimeoutMs: 20 });
    const result = client.request('/api/diff', {}, () => new Promise(() => {}));
    const refused = expect(result).rejects.toMatchObject({
      code: 'request-failed',
      uncertain: false,
    });
    await vi.advanceTimersByTimeAsync(20);
    await refused;
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['/api/review', '/api/apply-suggestion'])(
    'never retries an unknown mutation: %s',
    async path => {
      vi.useFakeTimers();
      const transport = vi.fn<typeof fetch>(() => new Promise(() => {}));
      const client = createServeRequester('secret', { fetch: transport, mutationTimeoutMs: 20 });
      const result = client.request(path, { method: 'POST' }, response => response.json());
      const refused = expect(result).rejects.toMatchObject({
        code: 'outcome-unknown',
        uncertain: true,
      });
      await vi.advanceTimersByTimeAsync(20);
      await refused;
      expect(transport).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    }
  );

  it('cancels outstanding requests on disposal and refuses new work', async () => {
    const transport = vi.fn<typeof fetch>(() => new Promise(() => {}));
    const client = createServeRequester('secret', { fetch: transport });
    const pending = client.request('/api/diff', {}, response => response.json());
    client.dispose();
    await expect(pending).rejects.toMatchObject({ uncertain: false });
    await expect(client.request('/api/config', {}, response => response.json())).rejects.toThrow(
      /disconnected/
    );
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('keeps network failures after sending a mutation uncertain', async () => {
    const client = createServeRequester('secret', {
      fetch: vi.fn<typeof fetch>().mockRejectedValue(new TypeError('socket closed')),
    });
    await expect(
      client.request('/api/review', { method: 'POST' }, response => response.json())
    ).rejects.toMatchObject({ uncertain: true });
  });
});

it.each(['read', 'mutation'] as const)(
  'uses explicit operation semantics for an arbitrary endpoint: %s',
  async operation => {
    vi.useFakeTimers();
    const transport = vi.fn<typeof fetch>(() => new Promise(() => {}));
    const client = createServeRequester('secret', {
      fetch: transport,
      readTimeoutMs: 10,
      mutationTimeoutMs: 20,
    });
    const result = client.request(
      '/future-operation',
      { method: 'POST' },
      response => response.json(),
      operation
    );
    const rejected = expect(result).rejects.toMatchObject({ uncertain: operation === 'mutation' });
    await vi.advanceTimersByTimeAsync(operation === 'mutation' ? 20 : 10);
    await rejected;
    expect(transport).toHaveBeenCalledTimes(1);
  }
);

it('lets explicit read semantics override legacy URL inference', async () => {
  const client = createServeRequester('secret', {
    fetch: vi.fn<typeof fetch>().mockRejectedValue(new Error('offline')),
  });
  await expect(
    client.request('/api/review', {}, response => response.json(), 'read')
  ).rejects.toMatchObject({ uncertain: false });
});
