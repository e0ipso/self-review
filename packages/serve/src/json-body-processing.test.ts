import { EventEmitter } from 'node:events';
import { Worker } from 'node:worker_threads';
import { beforeAll, afterAll, expect, it, vi } from 'vitest';
import {
  JsonBodyProcessing,
  parseInJsonWorker,
  type JsonParserWorker,
} from './json-body-processing';
import { MAX_REVIEW_BODY_BYTES } from './protocol';
import { buildJsonBodyTestWorker } from './test-support/json-body-worker';

let built: Awaited<ReturnType<typeof buildJsonBodyTestWorker>>;
beforeAll(async () => {
  built = await buildJsonBodyTestWorker();
});
afterAll(async () => {
  await built.processing.shutdown();
  await built.cleanup();
});
const unreadable = { ok: false, status: 400, error: 'request body could not be read' };
function buffers(bytes: Uint8Array): ArrayBuffer[] {
  return [Uint8Array.from(bytes).buffer];
}
async function parse(bytes: Uint8Array) {
  const lease = built.processing.reserve(MAX_REVIEW_BODY_BYTES)!;
  return lease.parse(buffers(bytes), new AbortController().signal);
}
it('runs the built production worker for exact Unicode and fresh requests after malformed JSON', async () => {
  const value = { body: '😀\uFFFD 雪 é\r\n', nested: { text: '\uFEFFinside' } };
  await expect(parse(Buffer.from(JSON.stringify(value)))).resolves.toEqual({ ok: true, value });
  for (const bytes of [
    Buffer.from('{'),
    Buffer.from('\uFEFF{}'),
    Buffer.from([0x22, 0xff, 0x22]),
    Buffer.from([0x22, 0xed, 0xa0, 0x80, 0x22]),
  ]) {
    await expect(parse(bytes)).resolves.toEqual({
      ok: false,
      status: 400,
      error: 'body must be valid JSON',
    });
  }
  await expect(parse(Buffer.from('null'))).resolves.toEqual({ ok: true, value: null });
});
function controlledWorker() {
  const events = new EventEmitter();
  let terminateDone!: (code: number) => void;
  const termination = new Promise<number>(resolve => {
    terminateDone = resolve;
  });
  const worker = Object.assign(events, {
    postMessage: vi.fn(),
    terminate: vi.fn(() => termination),
  });
  return {
    worker: worker as unknown as JsonParserWorker,
    events,
    terminate: worker.terminate,
    post: worker.postMessage,
    exit: () => {
      events.emit('exit', 1);
      terminateDone(1);
    },
  };
}
it.each(['reply', 'abort', 'error', 'exit'] as const)(
  'retains worker admission until termination after %s',
  async mode => {
    const controlled = controlledWorker();
    const processing = new JsonBodyProcessing(() => controlled.worker);
    const first = processing.reserve(MAX_REVIEW_BODY_BYTES)!;
    const second = processing.reserve(MAX_REVIEW_BODY_BYTES)!;
    expect(processing.reserve(1)).toBeNull();
    const controller = new AbortController();
    let settled = false;
    const parsing = first.parse(buffers(Buffer.from('{}')), controller.signal).then(value => {
      settled = true;
      return value;
    });
    if (mode === 'reply') controlled.events.emit('message', { ok: true, value: {} });
    if (mode === 'abort') controller.abort();
    if (mode === 'error') controlled.events.emit('error', new Error('worker failed'));
    if (mode === 'exit') controlled.events.emit('exit', 2);
    await Promise.resolve();
    expect(controlled.terminate).toHaveBeenCalledOnce();
    expect(settled).toBe(false);
    expect(processing.reserve(1)).toBeNull();
    controlled.exit();
    expect(await parsing).toEqual(mode === 'reply' ? { ok: true, value: {} } : unreadable);
    for (const event of ['message', 'error', 'exit'])
      expect(controlled.events.listenerCount(event)).toBe(0);
    second.release();
    const fresh = processing.reserve(MAX_REVIEW_BODY_BYTES)!;
    expect(fresh).not.toBeNull();
    fresh.release();
    await processing.shutdown();
  }
);
it('joins a failed termination by observing exit and holds shutdown ownership', async () => {
  const controlled = controlledWorker();
  controlled.terminate.mockRejectedValueOnce(new Error('termination failed'));
  const processing = new JsonBodyProcessing(() => controlled.worker);
  const lease = processing.reserve(MAX_REVIEW_BODY_BYTES)!;
  let finished = false;
  const parsing = lease.parse([], new AbortController().signal).then(value => {
    finished = true;
    return value;
  });
  controlled.events.emit('message', { ok: true, value: {} });
  const stopping = processing.shutdown();
  await new Promise<void>(resolve => setImmediate(resolve));
  expect(finished).toBe(false);
  expect(processing.reserve(1)).toBeNull();
  controlled.exit();
  expect(await parsing).toEqual(unreadable);
  await stopping;
});
it('does not start a worker for a cancelled reservation or leak constructor/delivery failures', async () => {
  const create = vi.fn(() => {
    throw new Error('worker unavailable');
  });
  const processing = new JsonBodyProcessing(create);
  const cancelled = new AbortController();
  cancelled.abort();
  await expect(processing.reserve(1)!.parse([], cancelled.signal)).resolves.toEqual(unreadable);
  expect(create).not.toHaveBeenCalled();
  await expect(processing.reserve(1)!.parse([], new AbortController().signal)).rejects.toThrow(
    'unavailable'
  );
  const controlled = controlledWorker();
  controlled.post.mockImplementationOnce(() => {
    throw new Error('delivery failed');
  });
  const parsing = parseInJsonWorker(controlled.worker, [], new AbortController().signal);
  await Promise.resolve();
  controlled.exit();
  await expect(parsing).resolves.toEqual(unreadable);
  await processing.shutdown();
});
it('cancels the real built worker, joins its exit, and permits another parse', async () => {
  const worker = new Worker(built.path);
  let exited = false;
  worker.once('exit', () => {
    exited = true;
  });
  const cancel = new AbortController();
  const parsing = parseInJsonWorker(
    worker,
    buffers(Buffer.from('[' + '0,'.repeat(4_000_000) + '0]')),
    cancel.signal
  );
  cancel.abort();
  expect(await parsing).toEqual(unreadable);
  expect(exited).toBe(true);
  await expect(parse(Buffer.from('{"fresh":true}'))).resolves.toEqual({
    ok: true,
    value: { fresh: true },
  });
});

it('retains deeply nested valid extension metadata beyond native message-clone recursion', async () => {
  const depth = 10_000;
  const bytes = Buffer.from(
    '{"__proto__":{"kept":true},"extension":' + '['.repeat(depth) + '0' + ']'.repeat(depth) + '}'
  );
  const result = await parse(bytes);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('Valid JSON was refused');
  const value = result.value as Record<string, unknown>;
  expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
  expect(Object.hasOwn(value, '__proto__')).toBe(true);
  expect(value.__proto__).toEqual({ kept: true });
  let nested = value.extension;
  for (let index = 0; index < depth; index++) {
    expect(Array.isArray(nested)).toBe(true);
    nested = (nested as unknown[])[0];
  }
  expect(nested).toBe(0);
});
