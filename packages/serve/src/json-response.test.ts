import { afterEach, expect, it, vi } from 'vitest';
import * as http from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { setImmediate } from 'node:timers/promises';
import { sendLargeJson, JsonResponseLimitError, type JsonResponseOptions } from './json-response';
import { sendError, sendJson } from './http-transport';
import { createReviewServer, listenLoopback } from './server';
import { createReviewOperations } from './review-operations';
import { createReviewSession } from '@self-review/core';
import { REQUEST_SHUTDOWN } from './request-admission';

const servers: http.Server[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
async function listener(value: unknown, options: Partial<JsonResponseOptions> = {}) {
  const controller = new AbortController();
  const settled = vi.fn();
  const server = http.createServer(async (_req, res) => {
    res.once('close', () => {
      if (!res.writableFinished) controller.abort();
    });
    try {
      await sendLargeJson(res, value, { signal: controller.signal, ...options });
    } catch (error) {
      if (!res.headersSent)
        sendError(res, error instanceof JsonResponseLimitError ? 413 : 500, String(error));
      else res.destroy();
    } finally {
      settled();
    }
  });
  servers.push(server);
  const { url } = await listenLoopback(server);
  return { url, settled, controller };
}

it('matches JSON bytes for escaped Unicode, chunk-boundary surrogate pairs, holes and omissions', async () => {
  const value = {
    text: 'x'.repeat(16383) + '😀' + '\ud800' + '\n\r\t"\\é',
    omitted: undefined,
    values: [true, false, null, NaN, Infinity, ...new Array(1), undefined],
    nested: { done: 3 },
  };
  const { url } = await listener(value);
  const response = await fetch(url);
  expect(response.status).toBe(200);
  expect(await response.text()).toBe(JSON.stringify(value));
  expect(response.headers.get('referrer-policy')).toBe('no-referrer');
});

it('measures escaped UTF-8 exactly and refuses one byte over before success headers', async () => {
  const value = { text: 'é\u0000😀' };
  const size = Buffer.byteLength(JSON.stringify(value));
  const exact = await listener(value, { maxBytes: size });
  expect(await (await fetch(exact.url)).json()).toEqual(value);
  const over = await listener(value, { maxBytes: size - 1 });
  const response = await fetch(over.url);
  expect(response.status).toBe(413);
  expect(await response.json()).toMatchObject({ error: expect.stringContaining('byte limit') });
});

it('bounds tiny-node amplification and nesting, including omitted properties', async () => {
  for (const value of [[1, 2, 3], { a: undefined, b: undefined, c: undefined }]) {
    const { url } = await listener(value, { maxNodes: 3 });
    expect((await fetch(url)).status).toBe(413);
  }
  let value: unknown = 0;
  for (let i = 0; i < 130; i++) value = [value];
  const { url } = await listener(value);
  expect((await fetch(url)).status).toBe(413);
});

it('does not invoke malicious getters during serialization', async () => {
  const getter = vi.fn(() => new Array(1_000_000).fill('grow'));
  const value = Object.defineProperty({}, 'body', { get: getter, enumerable: true });
  const { url } = await listener(value);
  expect((await fetch(url)).status).toBe(500);
  expect(getter).not.toHaveBeenCalled();
});

it('delivers a large valid DTO cooperatively without omitting lines', async () => {
  const value = Array.from({ length: 20_000 }, (_, index) => ({ index, content: 'é'.repeat(32) }));
  const { url } = await listener(value);
  let ticks = 0;
  const timer = setInterval(() => ticks++, 1);
  try {
    expect(await (await fetch(url)).json()).toEqual(value);
  } finally {
    clearInterval(timer);
  }
  expect(ticks).toBeGreaterThan(0);
});

it('cancels a long preflight before headers and releases its work', async () => {
  const controller = new AbortController();
  const value = new Array(200_000).fill({ text: 'valid' });
  const { url, settled } = await listener(value, { signal: controller.signal });
  const pending = fetch(url);
  setTimeout(() => controller.abort(), 5);
  const response = await pending;
  expect(response.status).toBe(500);
  await vi.waitFor(() => expect(settled).toHaveBeenCalledOnce());
});

it('keeps file/diff/resume delivery admitted for a slow reader and releases after disconnect', async () => {
  const session = createReviewSession();
  const operations = createReviewOperations(session, { path: '/review.xml', origin: 'explicit' });
  const large = { text: 'x'.repeat(16 * 1024 * 1024) };
  for (const method of ['getDiffLoad', 'getResumeLoad', 'getFileHunks'] as const)
    vi.spyOn(operations, method).mockReturnValue(large as never);
  vi.spyOn(operations, 'authorizeReviewedPath').mockReturnValue({ ok: true } as never);
  const server = createReviewServer({ operations, capability: 'key', maxExpensiveReads: 1 });
  servers.push(server);
  const { url } = await listenLoopback(server);
  const headers = { authorization: 'Bearer key' };
  const port = (server.address() as AddressInfo).port;
  const request = http.get({ host: '127.0.0.1', port, path: '/api/file?path=a', headers });
  const [response] = (await once(request, 'response')) as [http.IncomingMessage];
  response.pause();
  for (const route of ['diff', 'resume', 'file?path=a']) {
    const busy = await fetch(url + 'api/' + route, { headers });
    expect(busy.status).toBe(503);
    expect(await busy.json()).toMatchObject({ error: expect.stringContaining('busy') });
  }
  request.destroy();
  response.destroy();
  vi.mocked(operations.getDiffLoad).mockReturnValue(null);
  await vi.waitFor(async () =>
    expect((await fetch(url + 'api/diff', { headers })).status).toBe(200)
  );
  // Shutdown waits for the serializer and response to settle, not only socket close.
  await server[REQUEST_SHUTDOWN]();
});

it('releases admission after an output refusal and serves a small acknowledgement', async () => {
  const operations = createReviewOperations(createReviewSession(), {
    path: '/review.xml',
    origin: 'explicit',
  });
  const read = vi
    .spyOn(operations, 'getDiffLoad')
    .mockReturnValue({ text: '\0'.repeat(12 * 1024 * 1024) } as never);
  const server = createReviewServer({ operations, capability: 'key', maxExpensiveReads: 1 });
  servers.push(server);
  const { url } = await listenLoopback(server);
  const headers = { authorization: 'Bearer key' };
  const response = await fetch(url + 'api/diff', { headers });
  expect(response.status).toBe(413);
  expect(await response.json()).toMatchObject({ error: expect.stringContaining('byte limit') });
  read.mockReturnValue(null);
  await setImmediate();
  expect((await fetch(url + 'api/diff', { headers })).status).toBe(200);
});

it('bounds growth between preflight and delivery and never completes partial success JSON', async () => {
  let passes = 0;
  const growing = new Proxy(
    {},
    {
      ownKeys: () => {
        passes++;
        return ['text'];
      },
      getOwnPropertyDescriptor: () => ({
        enumerable: true,
        configurable: true,
        value: passes === 1 ? 'small' : 'x'.repeat(1000),
      }),
    }
  );
  const { url, settled } = await listener(growing, { maxBytes: 100 });
  await expect(
    (async () => {
      const response = await fetch(url);
      return response.json();
    })()
  ).rejects.toThrow();
  await vi.waitFor(() => expect(settled).toHaveBeenCalledOnce());
});

it('keeps a preventable small serialization failure ahead of success headers', async () => {
  const cycle: { self?: unknown } = {};
  cycle.self = cycle;
  const server = http.createServer((_req, res) => {
    try {
      sendJson(res, 200, cycle);
    } catch {
      if (res.headersSent) res.destroy();
      else sendError(res, 500, 'encoding failed');
    }
  });
  servers.push(server);
  const { url } = await listenLoopback(server);
  const response = await fetch(url);
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: 'encoding failed' });
});
