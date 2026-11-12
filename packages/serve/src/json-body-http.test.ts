import * as http from 'node:http';
import { EventEmitter } from 'node:events';
import { Worker } from 'node:worker_threads';
import { beforeAll, afterAll, afterEach, expect, it, vi } from 'vitest';
import { readJsonBody } from './http-transport';
import {
  JsonBodyProcessing,
  INLINE_JSON_BODY_BYTES,
  type JsonParserWorker,
} from './json-body-processing';
import { MAX_REVIEW_BODY_BYTES, SERVER_BUSY_ERROR } from './protocol';
import { buildJsonBodyTestWorker } from './test-support/json-body-worker';
import { listenLoopback, createValidatedReviewServer } from './bound-server';
import { createValidatedPublicationOperations } from './review-operations';
import { createReviewSession } from '@self-review/core';
import { REQUEST_SHUTDOWN } from './request-admission';

let built: Awaited<ReturnType<typeof buildJsonBodyTestWorker>>;
const servers: http.Server[] = [];
const processors: JsonBodyProcessing[] = [];
beforeAll(async () => {
  built = await buildJsonBodyTestWorker();
});
afterAll(async () => {
  await built.processing.shutdown();
  await built.cleanup();
});
afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
  await Promise.all(processors.splice(0).map(owner => owner.shutdown()));
});
function requestStream() {
  return Object.assign(new EventEmitter(), {
    headers: { 'content-type': 'application/json' },
  }) as unknown as http.IncomingMessage;
}
function processing() {
  const owner = new JsonBodyProcessing(() => new Worker(built.path));
  processors.push(owner);
  return owner;
}
function controlledProcessing() {
  const events = new EventEmitter();
  let reaped!: (code: number) => void;
  const termination = new Promise<number>(resolve => {
    reaped = resolve;
  });
  const post = vi.fn();
  const worker = Object.assign(events, { postMessage: post, terminate: vi.fn(() => termination) });
  const create = vi.fn(() => worker as unknown as JsonParserWorker);
  const owner = new JsonBodyProcessing(create);
  processors.push(owner);
  return {
    owner,
    create,
    post,
    events,
    release: () => {
      events.emit('exit', 0);
      reaped(0);
    },
  };
}
const validBytes = () =>
  Buffer.from(JSON.stringify({ text: 'x'.repeat(INLINE_JSON_BODY_BYTES) + '😀\uFFFD é雪' }));
it('uses a real built worker for a large body without main-thread JSON parsing or concatenation', async () => {
  const req = requestStream();
  const bytes = validBytes();
  const parsing = vi.spyOn(JSON, 'parse');
  const concat = vi.spyOn(Buffer, 'concat');
  try {
    const body = readJsonBody(req, MAX_REVIEW_BODY_BYTES, undefined, processing());
    req.emit('data', bytes.subarray(0, bytes.length - 3));
    req.emit('data', bytes.subarray(bytes.length - 3));
    req.emit('end');
    expect(await body).toEqual({
      ok: true,
      value: { text: 'x'.repeat(INLINE_JSON_BODY_BYTES) + '😀\uFFFD é雪' },
    });
    expect(parsing).not.toHaveBeenCalled();
    expect(concat).not.toHaveBeenCalled();
  } finally {
    parsing.mockRestore();
    concat.mockRestore();
  }
});
it('keeps the small-body fast path without reserving a worker', async () => {
  const control = controlledProcessing();
  const req = requestStream();
  const body = readJsonBody(req, MAX_REVIEW_BODY_BYTES, undefined, control.owner);
  req.emit('data', Buffer.from('{"small":true}'));
  req.emit('end');
  expect(await body).toEqual({ ok: true, value: { small: true } });
  expect(control.create).not.toHaveBeenCalled();
  control.release();
});
it.each([
  Buffer.from('not JSON'),
  Buffer.from([0xff]),
  Buffer.from([0xed, 0xa0, 0x80]),
  Buffer.from([0xf4, 0x90, 0x80, 0x80]),
])('rejects malformed large bodies and permits a fresh request', async invalid => {
  const owner = processing();
  const req = requestStream();
  const body = readJsonBody(req, MAX_REVIEW_BODY_BYTES, undefined, owner);
  req.emit('data', Buffer.alloc(INLINE_JSON_BODY_BYTES + 1, 0x20));
  req.emit('data', invalid);
  req.emit('end');
  expect(await body).toEqual({ ok: false, status: 400, error: 'body must be valid JSON' });
  const fresh = requestStream();
  const retry = readJsonBody(fresh, MAX_REVIEW_BODY_BYTES, undefined, owner);
  fresh.emit('data', validBytes());
  fresh.emit('end');
  expect((await retry).ok).toBe(true);
});
it.each(['signal', 'abandoned', 'shutdown'] as const)(
  'joins parsing cancellation on %s before releasing body listeners',
  async reason => {
    const control = controlledProcessing();
    const req = requestStream();
    const cancel = new AbortController();
    let settled = false;
    const body = readJsonBody(req, MAX_REVIEW_BODY_BYTES, cancel.signal, control.owner).then(
      result => {
        settled = true;
        return result;
      }
    );
    req.emit('data', validBytes());
    req.emit('end');
    await Promise.resolve();
    expect(control.create).toHaveBeenCalledOnce();
    let stopping: Promise<void> | undefined;
    if (reason === 'signal') cancel.abort();
    if (reason === 'abandoned') req.emit('aborted');
    if (reason === 'shutdown') stopping = control.owner.shutdown();
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(req.listenerCount('error')).toBe(1);
    control.release();
    expect(await body).toEqual({ ok: false, status: 400, error: 'request body could not be read' });
    await stopping;
    for (const name of ['data', 'end', 'aborted', 'error']) expect(req.listenerCount(name)).toBe(0);
  }
);
it('bounds collecting reservations, refuses overflow before parsing, and releases abandoned input', async () => {
  const control = controlledProcessing();
  const requests = [requestStream(), requestStream(), requestStream()];
  const bodies = requests.map(req =>
    readJsonBody(req, MAX_REVIEW_BODY_BYTES, undefined, control.owner)
  );
  for (const req of requests) req.emit('data', validBytes());
  expect(await bodies[2]).toEqual({ ok: false, status: 503, error: SERVER_BUSY_ERROR });
  requests[0].emit('aborted');
  requests[1].emit('data', Buffer.alloc(MAX_REVIEW_BODY_BYTES));
  expect(await bodies[1]).toEqual({ ok: false, status: 413, error: 'request body too large' });
  expect((await bodies[0]).ok).toBe(false);
  expect(control.create).not.toHaveBeenCalled();
  const fresh = requestStream();
  const retry = readJsonBody(fresh, MAX_REVIEW_BODY_BYTES, undefined, control.owner);
  fresh.emit('data', validBytes());
  fresh.emit('end');
  await Promise.resolve();
  expect(control.create).toHaveBeenCalledOnce();
  control.events.emit('message', { ok: true, value: {} });
  control.release();
  expect((await retry).ok).toBe(true);
});
it('keeps an authenticated listener responsive while JSON parsing owns a mutation slot', async () => {
  const control = controlledProcessing();
  let parsingStarted!: () => void;
  const started = new Promise<void>(resolve => {
    parsingStarted = resolve;
  });
  control.post.mockImplementation(() => {
    parsingStarted();
  });
  const operations = createValidatedPublicationOperations(createReviewSession(), {
    path: '/review.xml',
    origin: 'explicit',
  });
  const publish = vi.spyOn(operations, 'publishReview');
  const server = createValidatedReviewServer({
    capability: 'key',
    operations,
    publication: operations,
    jsonBodyProcessing: control.owner,
  });
  servers.push(server);
  const { url } = await listenLoopback(server);
  const headers = { authorization: 'Bearer key', 'content-type': 'application/json' };
  const posting = fetch(url + 'api/review', { method: 'POST', headers, body: validBytes() });
  try {
    await started;
    const config = await fetch(url + 'api/config', { headers });
    expect(config.status).toBe(200);
    await config.json();
    expect(publish).not.toHaveBeenCalled();
    const stopping = server[REQUEST_SHUTDOWN]();
    control.release();
    const result = await posting;
    expect(result.status).toBe(400);
    await result.arrayBuffer();
    await stopping;
    expect(publish).not.toHaveBeenCalled();
  } finally {
    control.release();
  }
});
