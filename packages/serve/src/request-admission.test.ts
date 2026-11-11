import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type * as http from 'node:http';
import { createServeLifecycle } from './lifecycle';
import * as core from '@self-review/core';
import type { ReviewState } from '@self-review/core';
import { createReviewServer, listenLoopback } from './server';
import { createReviewOperations } from './review-operations';
import { RequestAdmission, REQUEST_SHUTDOWN, type AdmissionOptions } from './request-admission';

const capability = 'test-capability-0123456789abcdefghijklmnopqrstuvwxyz';
const headers = { authorization: `Bearer ${capability}`, 'content-type': 'application/json' };
const state: ReviewState = {
  timestamp: '2026-01-01T00:00:00Z',
  source: { type: 'git', repository: '/review', gitDiffArgs: '' },
  files: [],
};
const apply = {
  filePath: 'a.txt',
  lineRange: { side: 'new', start: 1, end: 1 },
  suggestion: { originalCode: 'a', proposedCode: 'b' },
};
function deferred() {
  let resolve!: () => void;
  return {
    promise: new Promise<void>(done => {
      resolve = done;
    }),
    resolve: () => resolve(),
  };
}
const servers: ReturnType<typeof createReviewServer>[] = [];
const gates: ReturnType<typeof deferred>[] = [];
function gate() {
  const value = deferred();
  gates.push(value);
  return value;
}

afterEach(async () => {
  for (const value of gates.splice(0)) value.resolve();
  for (const server of servers.splice(0)) {
    const pending = server[REQUEST_SHUTDOWN]();
    server.closeAllConnections();
    server.close();
    await pending;
  }
});

async function setup(options: AdmissionOptions = {}) {
  const session = core.createReviewSession();
  core.commitDiffData(
    session,
    {
      files: [
        { oldPath: 'a.txt', newPath: 'a.txt', changeType: 'modified', isBinary: false, hunks: [] },
      ],
      source: state.source,
    },
    {
      mode: 'git',
      sourceRoot: '/review',
      invocationCwd: '/review',
      gitDiffArgv: [],
      pathPrefix: '',
      oldSide: { kind: 'index' },
      newSide: { kind: 'working-tree' },
    }
  );
  const operations = createReviewOperations(session, { path: '/review.xml', origin: 'explicit' });
  const server = createReviewServer({ operations, capability, ...options });
  servers.push(server);
  const { url } = await listenLoopback(server);
  return {
    server,
    operations,
    get: (path: string, signal?: AbortSignal) => fetch(url + 'api/' + path, { headers, signal }),
    post: (path: string, body: unknown, signal?: AbortSignal) =>
      fetch(url + 'api/' + path, { method: 'POST', headers, signal, body: JSON.stringify(body) }),
  };
}

describe('HTTP operation ownership', () => {
  it('aborts an admitted publication when its peer disconnects', async () => {
    const { post, operations } = await setup();
    const pending = gate();
    let signal: AbortSignal | undefined;
    const publish = vi
      .spyOn(operations, 'publishReview')
      .mockImplementation(async (_state, options) => {
        signal = options?.signal;
        await pending.promise;
        signal?.throwIfAborted();
        return { outputPath: '/review.xml' };
      });
    const controller = new AbortController();
    const result = post('review', state, controller.signal).catch(error => error);
    await vi.waitFor(() => expect(publish).toHaveBeenCalledOnce());
    controller.abort();
    await result;
    await vi.waitFor(() => expect(signal?.aborted).toBe(true));
    pending.resolve();
  });

  it('constructs from bound operations without a dummy session or output', async () => {
    const { get } = await setup();
    expect((await get('diff')).status).toBe(200);
  });

  it('caps expensive reads and retains a disconnected work slot until its operation settles', async () => {
    const { get, operations } = await setup({ maxExpensiveReads: 1 });
    const pending = gate();
    let ownedSignal: AbortSignal | undefined;
    const read = vi.spyOn(operations, 'loadImage').mockImplementation(async (_path, options) => {
      ownedSignal = options?.signal;
      await pending.promise;
      return { dataUri: 'data:image/png;base64,AA==' };
    });
    const controller = new AbortController();
    const first = get('image?path=a.txt', controller.signal).catch(error => error);
    await vi.waitFor(() => expect(read).toHaveBeenCalledOnce());
    expect((await get('image?path=a.txt')).status).toBe(503);
    expect((await get('config')).status).toBe(200);
    controller.abort();
    await first;
    await vi.waitFor(() => expect(ownedSignal?.aborted).toBe(true));
    expect((await get('image?path=a.txt')).status).toBe(503);
    pending.resolve();
    await vi.waitFor(async () => expect((await get('image?path=a.txt')).status).toBe(200));
  });

  it('bounds aggregate admission, including cheap requests, while authentication still runs first', async () => {
    const { get, operations, server } = await setup({ maxRequests: 1 });
    const pending = gate();
    const read = vi.spyOn(operations, 'loadImage').mockImplementation(async () => {
      await pending.promise;
      return { error: 'unavailable' };
    });
    const first = get('image?path=a.txt');
    await vi.waitFor(() => expect(read).toHaveBeenCalledOnce());
    expect((await get('config')).status).toBe(503);
    const address = server.address() as { port: number };
    expect((await fetch(`http://127.0.0.1:${address.port}/api/diff`)).status).toBe(401);
    pending.resolve();
    await first;
    expect((await get('config')).status).toBe(200);
  });

  it('awaits async Apply and prevents publication or a second mutation from overtaking it', async () => {
    const { post, operations } = await setup();
    const pending = gate();
    const writer = vi
      .spyOn(operations, 'applySuggestionForSession')
      .mockImplementation(async () => {
        await pending.promise;
        return { status: 'applied', filePath: 'a.txt', replacedLines: 1 };
      });
    const publisher = vi
      .spyOn(operations, 'publishReview')
      .mockResolvedValue({ outputPath: '/review.xml' });
    const first = post('apply-suggestion', apply);
    await vi.waitFor(() => expect(writer).toHaveBeenCalledOnce());
    expect((await post('review', state)).status).toBe(409);
    expect((await post('expand-context', { filePath: 'a.txt', contextLines: 3 })).status).toBe(409);
    expect(publisher).not.toHaveBeenCalled();
    pending.resolve();
    expect(await (await first).json()).toMatchObject({ status: 'applied' });
    expect((await post('review', state)).status).toBe(200);
    expect(publisher).toHaveBeenCalledOnce();
  });

  it('prevents Apply while publication is pending and reopens admission after a failed publication', async () => {
    const { post, operations } = await setup();
    const pending = gate();
    const publisher = vi
      .spyOn(operations, 'publishReview')
      .mockImplementationOnce(async () => {
        await pending.promise;
        throw new core.ReviewPublishError('permission-denied', '/review.xml', 'denied');
      })
      .mockResolvedValue({ outputPath: '/review.xml' });
    const writer = vi
      .spyOn(operations, 'applySuggestionForSession')
      .mockResolvedValue({ status: 'applied', filePath: 'a.txt', replacedLines: 1 });
    const first = post('review', state);
    await vi.waitFor(() => expect(publisher).toHaveBeenCalledOnce());
    expect((await post('apply-suggestion', apply)).status).toBe(409);
    expect(writer).not.toHaveBeenCalled();
    pending.resolve();
    expect((await first).status).toBe(500);
    expect((await post('apply-suggestion', apply)).status).toBe(200);
    expect((await post('review', state)).status).toBe(200);
  });

  it('aborts owned work at the request deadline while retaining admission until work settles', async () => {
    const { get, operations } = await setup({ maxExpensiveReads: 1, requestTimeoutMs: 50 });
    const pending = gate();
    let ownedSignal: AbortSignal | undefined;
    vi.spyOn(operations, 'loadImage').mockImplementation(async (_path, options) => {
      ownedSignal = options?.signal;
      await pending.promise;
      return { error: 'late' };
    });
    const response = await get('image?path=a.txt');
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining('deadline exceeded'),
    });
    expect(ownedSignal?.aborted).toBe(true);
    expect((await get('image?path=a.txt')).status).toBe(503);
    pending.resolve();
  });

  it('cancels owned work on shutdown and waits for work as well as response closure', async () => {
    const { get, operations, server } = await setup();
    let ownedSignal: AbortSignal | undefined;
    const read = vi.spyOn(operations, 'loadImage').mockImplementation(
      (_path, options) =>
        new Promise((_resolve, reject) => {
          ownedSignal = options?.signal;
          ownedSignal!.addEventListener('abort', () => reject(ownedSignal!.reason), { once: true });
        })
    );
    const request = get('image?path=a.txt');
    await vi.waitFor(() => expect(read).toHaveBeenCalledOnce());
    await server[REQUEST_SHUTDOWN]();
    expect(ownedSignal?.aborted).toBe(true);
    expect((await request).status).toBe(500);
    expect((await get('diff')).status).toBe(503);
  });
});

it('clears per-request timers when shutdown takes deadline ownership', async () => {
  vi.useFakeTimers();
  const admission = new RequestAdmission();
  const pending = deferred();
  const req = new EventEmitter() as http.IncomingMessage;
  const res = new EventEmitter() as http.ServerResponse;
  try {
    admission.run(req, res, 'expensive-read', () => pending.promise, vi.fn());
    expect(vi.getTimerCount()).toBe(1);
    const drained = admission.shutdown();
    expect(vi.getTimerCount()).toBe(0);
    res.emit('close');
    pending.resolve();
    await drained;
    expect(req.listenerCount('aborted')).toBe(0);
    expect(res.listenerCount('close')).toBe(0);
    expect(res.listenerCount('finish')).toBe(0);
  } finally {
    pending.resolve();
    vi.useRealTimers();
  }
});

it('drains publication after an interrupt without rolling it back or exiting successfully', async () => {
  const { post, operations, server } = await setup();
  const signals = new EventEmitter();
  const exit = vi.fn<(code: number) => void>();
  const lifetime = createServeLifecycle({ signals, exit });
  lifetime.attach(server);
  const pending = gate();
  let committed = false;
  const publisher = vi.spyOn(operations, 'publishReview').mockImplementation(async () => {
    await pending.promise;
    committed = true;
    return { outputPath: '/review.xml' };
  });
  const request = post('review', state);
  await vi.waitFor(() => expect(publisher).toHaveBeenCalledOnce());
  signals.emit('SIGINT');
  expect(exit).not.toHaveBeenCalled();
  pending.resolve();
  expect(await (await request).json()).toEqual({ ok: true, outputPath: '/review.xml' });
  await vi.waitFor(() => expect(exit).toHaveBeenCalledExactlyOnceWith(130));
  expect(committed).toBe(true);
  expect(signals.listenerCount('SIGINT')).toBe(0);
});
