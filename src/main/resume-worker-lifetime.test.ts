import { EventEmitter } from 'node:events';
import type { Worker } from 'node:worker_threads';
import { describe, expect, it, vi } from 'vitest';
import { runResumeWorker } from './resume-worker-lifetime';
import type { ResumeWorkerOptions } from './resume-worker-lifetime';
import { parseReviewXmlString } from '../../packages/core/src/xml-parser';
import { ReviewXmlError } from '../../packages/core/src/xml-errors';
import { describeResumeFailure } from './resume-worker-protocol';

const request = { id: 'operation', path: '/review.xml' };
const parsed = parseReviewXmlString('<review><file path="x" viewed="true"/></review>');

function operation(options: ResumeWorkerOptions = {}) {
  const worker = new EventEmitter();
  const terminate = vi.fn(async () => 1);
  const postMessage = vi.fn();
  Object.assign(worker, { terminate, postMessage });
  const result = runResumeWorker(worker as unknown as Worker, request, options);
  return { worker, terminate, postMessage, result };
}

function reply(worker: EventEmitter) {
  worker.emit('message', { id: request.id, kind: 'parsed', parsed });
}

function expectReleased(worker: EventEmitter) {
  for (const event of ['message', 'error', 'exit']) expect(worker.listenerCount(event)).toBe(0);
}

describe('resume worker ownership', () => {
  it('waits for termination before returning and ignores duplicate/late messages', async () => {
    const op = operation();
    let release!: (code: number) => void;
    let started!: () => void;
    const terminating = new Promise<void>(resolve => (started = resolve));
    op.terminate.mockImplementation(() => {
      started();
      return new Promise(resolve => (release = resolve));
    });
    reply(op.worker);
    let returned = false;
    void op.result.then(() => (returned = true));
    await terminating;
    expect(returned).toBe(false);
    expect(op.terminate).toHaveBeenCalledTimes(1);
    op.worker.emit('message', { id: 'late', kind: 'parsed', parsed: null });
    release(1);
    await expect(op.result).resolves.toBe(parsed);
    expect(op.postMessage).toHaveBeenCalledExactlyOnceWith(request);
    expectReleased(op.worker);
    reply(op.worker);
    expect(op.terminate).toHaveBeenCalledTimes(1);
  });

  it.each(['error', 'exit', 'unowned', 'invalid'])('fails visibly on %s', async kind => {
    const op = operation();
    const assertion = expect(op.result).rejects.toThrow();
    if (kind === 'error') op.worker.emit('error', new Error('worker failed'));
    if (kind === 'exit') op.worker.emit('exit', 0);
    if (kind === 'unowned') op.worker.emit('message', { id: 'another-operation' });
    if (kind === 'invalid') op.worker.emit('message', { id: request.id, kind: 'parsed' });
    await assertion;
    expect(op.terminate).toHaveBeenCalledTimes(1);
    expectReleased(op.worker);
  });

  it('cleans up a synchronous message delivery failure', async () => {
    const worker = new EventEmitter();
    const terminate = vi.fn(async () => 0);
    Object.assign(worker, {
      terminate,
      postMessage: () => {
        throw new Error('delivery failed');
      },
    });
    await expect(runResumeWorker(worker as Worker, request, {})).rejects.toThrow('delivery failed');
    expect(terminate).toHaveBeenCalledTimes(1);
    expectReleased(worker);
  });

  it('rehydrates typed XML errors with their details and read cause', async () => {
    const original = new ReviewXmlError('read-failed', 'Could not read review.xml', {
      details: ['line 3'],
      cause: Object.assign(new Error('missing'), { code: 'ENOENT' }),
    });
    const op = operation();
    op.worker.emit('message', {
      id: request.id,
      kind: 'failed',
      error: describeResumeFailure(original),
    });
    const error = await op.result.catch(error => error);
    expect(error).toBeInstanceOf(ReviewXmlError);
    expect(error).toMatchObject({
      code: original.code,
      message: original.message,
      details: ['line 3'],
    });
    expect(error.cause).toMatchObject({ code: 'ENOENT' });
    expectReleased(op.worker);
  });

  it.each(['before', 'in-flight', 'terminating'])('propagates abort %s', async stage => {
    const controller = new AbortController();
    const reason = new DOMException('shutdown', 'AbortError');
    if (stage === 'before') controller.abort(reason);
    const op = operation({ signal: controller.signal });
    const assertion = expect(op.result).rejects.toBe(reason);
    if (stage === 'terminating') {
      op.terminate.mockImplementation(async () => {
        controller.abort(reason);
        return 1;
      });
      reply(op.worker);
    } else if (stage === 'in-flight') {
      controller.abort(reason);
      reply(op.worker);
    }
    await assertion;
    expect(op.postMessage).toHaveBeenCalledTimes(stage === 'before' ? 0 : 1);
    expect(op.terminate).toHaveBeenCalledTimes(1);
    expectReleased(op.worker);
  });

  it.each(['in-flight', 'terminating'])('observes deadline %s', async stage => {
    vi.useFakeTimers();
    try {
      const op = operation({ timeoutMs: 10 });
      let release!: (code: number) => void;
      if (stage === 'terminating') {
        op.terminate.mockImplementation(() => new Promise(resolve => (release = resolve)));
        reply(op.worker);
        await Promise.resolve();
      }
      const assertion = expect(op.result).rejects.toMatchObject({ name: 'TimeoutError' });
      await vi.advanceTimersByTimeAsync(10);
      if (release) release(1);
      await assertion;
      expectReleased(op.worker);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects a revoked operation after cleanup', async () => {
    let current = true;
    const op = operation({ isCurrent: () => current });
    op.terminate.mockImplementation(async () => {
      current = false;
      return 1;
    });
    reply(op.worker);
    await expect(op.result).rejects.toMatchObject({ name: 'AbortError' });
    expectReleased(op.worker);
  });

  it('reports termination failure and removes listeners', async () => {
    const op = operation();
    op.terminate.mockRejectedValue(new Error('termination failed'));
    reply(op.worker);
    await expect(op.result).rejects.toThrow('termination failed');
    expectReleased(op.worker);
  });

  it('cleans up even when the deadline option is invalid', async () => {
    const op = operation({ timeoutMs: Infinity });
    await expect(op.result).rejects.toBeInstanceOf(RangeError);
    expect(op.postMessage).not.toHaveBeenCalled();
    expect(op.terminate).toHaveBeenCalledTimes(1);
    expectReleased(op.worker);
  });
});

it.each([0, 0.5, 10.5, 2 ** 40])('accepts shared bounded timeout form %s', async timeoutMs => {
  vi.useFakeTimers();
  try {
    const op = operation({ timeoutMs });
    reply(op.worker);
    await expect(op.result).resolves.toBe(parsed);
    expect(op.postMessage).toHaveBeenCalledOnce();
    expect(op.terminate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    expectReleased(op.worker);
  } finally {
    vi.useRealTimers();
  }
});
