import { EventEmitter } from 'node:events';
import { once } from 'node:events';
import { Worker } from 'node:worker_threads';
import { describe, expect, it, vi } from 'vitest';
import {
  runResumeWorker,
  ResumeWorkerTerminationError,
  readResumeReply,
  describeResumeFailure,
  restoreResumeFailure,
} from './resume-worker';
import type { ResumeWorkerOptions } from './resume-worker';
import { ReviewXmlError } from './xml-errors';
import type { ReviewXmlErrorCode } from './xml-errors';

const request = { id: 'owned', path: '/review.xml' };
const parsed = {
  comments: [],
  viewedFiles: [],
  importDiagnostics: [],
  source: 'git',
  gitDiffArgs: '',
};
const reply = { id: request.id, kind: 'parsed', parsed };
const restore = (failure: Parameters<typeof restoreResumeFailure>[0]) =>
  restoreResumeFailure(
    failure,
    (code, message, options) => new ReviewXmlError(code as ReviewXmlErrorCode, message, options)
  );

function fake(options: ResumeWorkerOptions = {}) {
  const worker = Object.assign(new EventEmitter(), {
    postMessage: vi.fn(),
    terminate: vi.fn(async () => 0),
  });
  const result = runResumeWorker(worker as unknown as Worker, request, options, restore);
  return { worker, result };
}

function released(worker: EventEmitter) {
  expect(worker.eventNames()).toEqual([]);
}

describe('shared resume owner', () => {
  it.each([0, undefined, 0.1, 10.5, 2 ** 40])(
    'normalizes timeout %s without overflow',
    async timeoutMs => {
      vi.useFakeTimers();
      try {
        const op = fake({ timeoutMs });
        const delay = !timeoutMs ? 30000 : Math.min(Math.ceil(timeoutMs), 2147483647);
        const assertion = expect(op.result).rejects.toMatchObject({ name: 'TimeoutError' });
        await vi.advanceTimersByTimeAsync(delay - 1);
        expect(op.worker.terminate).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        await assertion;
        expect(op.worker.terminate).toHaveBeenCalledOnce();
        released(op.worker);
        expect(vi.getTimerCount()).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    }
  );

  it.each([-1, Infinity, NaN])('reaps before rejecting invalid timeout %s', async timeoutMs => {
    const op = fake({ timeoutMs });
    await expect(op.result).rejects.toBeInstanceOf(RangeError);
    expect(op.worker.postMessage).not.toHaveBeenCalled();
    expect(op.worker.terminate).toHaveBeenCalledOnce();
    released(op.worker);
  });

  it.each([null, false, 0, '', new Error('original')])('retains abort reason %s', async reason => {
    const controller = new AbortController();
    const op = fake({ signal: controller.signal });
    const assertion = expect(op.result).rejects.toBe(reason);
    controller.abort(reason);
    await assertion;
    released(op.worker);
  });

  it.each(['abort', 'typed failure'])(
    'retains %s when termination rejects, without claiming release',
    async kind => {
      const controller = new AbortController();
      const op = fake({ signal: controller.signal });
      const terminationError = new Error('terminate rejected');
      const original = new ReviewXmlError('parse-failed', 'bad XML');
      op.worker.terminate.mockRejectedValue(terminationError);
      if (kind === 'abort') controller.abort(original);
      else
        op.worker.emit('message', {
          id: request.id,
          kind: 'failed',
          error: { code: original.code, message: original.message },
        });
      const error = await op.result.catch(error => error);
      expect(error).toBeInstanceOf(ResumeWorkerTerminationError);
      expect(error.name).not.toBe('AbortError');
      expect(error.terminationError).toBe(terminationError);
      expect(error.cause).toBeInstanceOf(ReviewXmlError);
      expect(error.cause.message).toBe(original.message);
      if (kind === 'abort') expect(error.cause).toBe(original);
      released(op.worker);
    }
  );

  it('preserves the original abort reason after a deadline during termination', async () => {
    vi.useFakeTimers();
    try {
      const controller = new AbortController();
      const reason = new Error('host shutdown');
      const op = fake({ signal: controller.signal, timeoutMs: 10 });
      let release!: (code: number) => void;
      op.worker.terminate.mockImplementation(() => new Promise(resolve => (release = resolve)));
      op.worker.emit('message', reply);
      await Promise.resolve();
      const assertion = expect(op.result).rejects.toBe(reason);
      await vi.advanceTimersByTimeAsync(10);
      controller.abort(reason);
      release(0);
      await assertion;
      released(op.worker);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps all listeners and deadline installed during termination', async () => {
    vi.useFakeTimers();
    try {
      const controller = new AbortController();
      const remove = vi.spyOn(controller.signal, 'removeEventListener');
      const op = fake({ signal: controller.signal, timeoutMs: 10 });
      let release!: (code: number) => void;
      op.worker.terminate.mockImplementation(() => new Promise(resolve => (release = resolve)));
      op.worker.emit('message', reply);
      await Promise.resolve();
      expect(op.worker.eventNames().sort()).toEqual(['error', 'exit', 'message']);
      expect(remove).not.toHaveBeenCalled();
      const assertion = expect(op.result).rejects.toMatchObject({ name: 'TimeoutError' });
      await vi.advanceTimersByTimeAsync(10);
      release(0);
      await assertion;
      expect(remove).toHaveBeenCalledOnce();
      expect(vi.getTimerCount()).toBe(0);
      released(op.worker);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('resume reply policy', () => {
  it.each([
    null,
    [],
    { ...reply, id: 'other' },
    { id: request.id, kind: 'other' },
    { ...reply, parsed: {} },
    { id: request.id, kind: 'failed', error: { message: 42 } },
    ...['name', 'stack', 'code', 'details'].map(key => ({
      id: request.id,
      kind: 'failed',
      error: { message: 'bad', [key]: 42 },
    })),
    { id: request.id, kind: 'failed', error: { message: 'bad', details: [42] } },
  ])('refuses malformed/unowned reply %j', value => {
    expect(() => readResumeReply(value, request.id, restore)).toThrow();
  });

  it('accepts existing metadata and optional fields without projection', () => {
    const value = { ...reply, parsed: { ...parsed, futureMetadata: true } };
    expect(readResumeReply(value, request.id, restore)).toBe(value.parsed);
  });

  it('restores legacy failures and full native read causes with peer classes', () => {
    expect(() =>
      readResumeReply(
        { id: request.id, kind: 'failed', error: { message: 'old', code: 'read-failed' } },
        request.id,
        restore
      )
    ).toThrow(ReviewXmlError);
    const cause = Object.assign(new Error('missing'), {
      code: 'ENOENT',
      errno: -2,
      path: '/review.xml',
      syscall: 'open',
    });
    const original = new ReviewXmlError('read-failed', 'read failed', {
      cause,
      details: ['line 1'],
    });
    const serialized = describeResumeFailure(original, error =>
      error instanceof ReviewXmlError ? error : undefined
    );
    const error = restore(structuredClone(serialized)) as ReviewXmlError;
    expect(error).toBeInstanceOf(ReviewXmlError);
    expect(error).toMatchObject({
      name: original.name,
      stack: original.stack,
      details: original.details,
    });
    expect(error.cause).toBeInstanceOf(Error);
    expect(error.cause).toMatchObject(cause);
  });
});

describe('real Node worker ownership', () => {
  it.each([
    'parsed',
    'failed',
    'unowned',
    'malformed',
    'error',
    'exit',
    'abort',
    'deadline',
    'stale',
  ])('reaps before settling %s', async kind => {
    const worker = new Worker(
      `
      const { parentPort } = require('node:worker_threads');
      parentPort.on('message', request => {
        const kind = ${JSON.stringify(kind)};
        if (kind === 'error') throw new Error('worker failed');
        if (kind === 'exit') process.exit(0);
        if (kind === 'abort' || kind === 'deadline') return;
        parentPort.postMessage(kind === 'failed' ? { id: request.id, kind, error: { code: 'parse-failed', message: 'bad XML' } }
          : kind === 'malformed' ? { id: request.id, kind: 'parsed', parsed: {} }
          : { id: kind === 'unowned' ? 'other' : request.id, kind: 'parsed', parsed: ${JSON.stringify(parsed)} });
        // A reply alone must never leave the worker running.
        setInterval(() => {}, 1000);
      });
    `,
      { eval: true }
    );
    const controller = new AbortController();
    let current = true;
    if (kind === 'stale') worker.on('message', () => (current = false));
    const result = runResumeWorker(
      worker,
      request,
      {
        signal: controller.signal,
        timeoutMs: kind === 'deadline' ? 10 : 30000,
        isCurrent: () => current,
      },
      restore
    );
    const assertion =
      kind === 'parsed'
        ? expect(result).resolves.toEqual(parsed)
        : expect(result).rejects.toThrow();
    if (kind === 'abort') {
      await once(worker, 'online');
      controller.abort(new Error('stop'));
    }
    await assertion;
    expect(worker.threadId).toBe(-1);
    // Remove only the test-owned freshness observer.
    if (kind === 'stale') worker.removeAllListeners('message');
    expect(worker.listenerCount('error')).toBe(0);
    expect(worker.listenerCount('exit')).toBe(0);
  });
});
