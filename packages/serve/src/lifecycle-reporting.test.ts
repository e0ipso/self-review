import { EventEmitter } from 'node:events';
import * as http from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServeLifecycle, REVIEW_PUBLISHED } from './lifecycle';
import { REQUEST_SHUTDOWN } from './request-admission';

const completeMessage = '[serve] Review complete; stopping.';
const deadlineMessage =
  '[serve] Shutdown deadline reached; closing remaining connections and waiting for owned work.';
afterEach(() => vi.restoreAllMocks());

function setup(reportDiagnostic?: (message: string) => void) {
  const events: string[] = [];
  const signals = new EventEmitter();
  const exit = vi.fn((code: number) => {
    events.push(`exit ${code}`);
  });
  let release!: () => void;
  const owned = new Promise<void>(resolve => {
    release = resolve;
  });
  const server = Object.assign(http.createServer(), { [REQUEST_SHUTDOWN]: vi.fn(() => owned) });
  vi.spyOn(server, 'close').mockImplementation(() => {
    events.push('close');
    return server;
  });
  vi.spyOn(server, 'closeAllConnections').mockImplementation(() => {
    events.push('close connections');
  });
  let expire!: () => void;
  const cancel = vi.fn();
  const options = {
    signals,
    exit,
    reportDiagnostic,
    scheduleDeadline: (callback: () => void) => {
      expire = callback;
      return cancel;
    },
  };
  const lifetime = createServeLifecycle(options);
  lifetime.attach(server);
  return {
    lifetime,
    signals,
    exit,
    server,
    owned,
    release,
    cancel,
    events,
    expire: () => expire(),
  };
}

describe('lifecycle diagnostics', () => {
  it('preserves default stderr bytes and call arguments and joins cleanup past grace', async () => {
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { server, exit, lifetime, owned, release, expire, events, cancel } = setup();
    const response = new EventEmitter() as http.ServerResponse;
    server.emit(REVIEW_PUBLISHED, response);
    expect(stderr).not.toHaveBeenCalled();
    response.emit('finish');
    expect(stderr.mock.calls).toEqual([[completeMessage]]);
    expect(lifetime.signal.aborted).toBe(true);
    expire();
    expect(stderr.mock.calls).toEqual([[completeMessage], [deadlineMessage]]);
    expect(events).toEqual(['close', 'close connections']);
    expect(exit).not.toHaveBeenCalled();
    release();
    await owned;
    expect(exit).toHaveBeenCalledExactlyOnceWith(0);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it.each(['capture', 'throw', 'reject', 'pending thenable', 'throwing then getter'] as const)(
    'keeps publication and interrupt ownership with a %s reporter',
    async mode => {
      const stderr = vi.spyOn(console, 'error').mockImplementation(() => {});
      const report = vi.fn((_message: string): unknown => {
        if (mode === 'throw') throw new Error('report failed');
        if (mode === 'reject') return Promise.reject(new Error('report failed'));
        if (mode === 'pending thenable') return { then() {} };
        if (mode === 'throwing then getter')
          return {
            get then() {
              throw new Error('then getter failed');
            },
          };
      });
      const { server, signals, exit, lifetime, owned, release, expire, cancel } = setup(report);
      const response = new EventEmitter() as http.ServerResponse;
      server.emit(REVIEW_PUBLISHED, response);
      expect(report).not.toHaveBeenCalled();
      response.emit('finish');
      response.emit('close');
      expect(report.mock.calls).toEqual([[completeMessage]]);
      expect(lifetime.signal.aborted).toBe(true);
      expect(server[REQUEST_SHUTDOWN]).toHaveBeenCalledOnce();
      signals.emit('SIGTERM');
      expire();
      expect(report.mock.calls).toEqual([[completeMessage], [deadlineMessage]]);
      expect(server.closeAllConnections).toHaveBeenCalledOnce();
      expect(exit).not.toHaveBeenCalled();
      release();
      await owned;
      await Promise.resolve();
      expect(exit).toHaveBeenCalledExactlyOnceWith(143);
      expect(cancel).toHaveBeenCalledOnce();
      expect(stderr).not.toHaveBeenCalled();
      expect(response.listenerCount('finish')).toBe(0);
      expect(response.listenerCount('close')).toBe(0);
      expect(signals.listenerCount('SIGINT')).toBe(0);
      expect(signals.listenerCount('SIGTERM')).toBe(0);
    }
  );

  it.each(['SIGINT', 'SIGTERM'] as const)(
    'reports only the deadline for %s and keeps its exit code',
    async signal => {
      const report = vi.fn();
      const { server, signals, exit, owned, release, expire } = setup(report);
      signals.emit(signal);
      expect(server.close).toHaveBeenCalledOnce();
      expect(report).not.toHaveBeenCalled();
      expire();
      expect(report).toHaveBeenCalledExactlyOnceWith(deadlineMessage);
      expect(exit).not.toHaveBeenCalled();
      release();
      await owned;
      expect(exit).toHaveBeenCalledExactlyOnceWith(signal === 'SIGINT' ? 130 : 143);
    }
  );

  it('routes completion through the custom reporter and exits after the response and cleanup', async () => {
    const report = vi.fn();
    const { server, exit, owned, release, cancel } = setup(report);
    const response = new EventEmitter() as http.ServerResponse;
    server.emit(REVIEW_PUBLISHED, response);
    response.emit('finish');
    expect(exit).not.toHaveBeenCalled();
    expect(report).toHaveBeenCalledExactlyOnceWith(completeMessage);
    release();
    await owned;
    expect(exit).toHaveBeenCalledExactlyOnceWith(0);
    expect(cancel).toHaveBeenCalledOnce();
  });
});
