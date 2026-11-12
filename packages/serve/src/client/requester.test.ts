import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServeRequester } from './requester';

afterEach(() => vi.useRealTimers());

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
