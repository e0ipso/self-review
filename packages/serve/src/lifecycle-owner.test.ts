import { EventEmitter } from 'node:events';
import * as http from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { createServeLifecycle, REVIEW_PUBLISHED } from './lifecycle';
import { listenLoopback } from './server';

function setup() {
  const signals = new EventEmitter();
  const exit = vi.fn<(code: number) => void>();
  let expire!: () => void;
  const cancel = vi.fn();
  const lifetime = createServeLifecycle({
    signals,
    exit,
    scheduleDeadline: callback => {
      expire = callback;
      return cancel;
    },
  });
  return { signals, exit, cancel, lifetime, expire: () => expire() };
}
function deferred() {
  let resolve!: () => void;
  return {
    promise: new Promise<void>(done => {
      resolve = done;
    }),
    resolve: () => resolve(),
  };
}

describe('serve shutdown ownership', () => {
  it.each([
    ['SIGINT', 130],
    ['SIGTERM', 143],
  ] as const)('owns %s before startup settles', async (signal, code) => {
    const { signals, exit, lifetime, cancel } = setup();
    const startup = deferred();
    const pending = lifetime.track(startup.promise);
    signals.emit(signal);
    expect(lifetime.signal.aborted).toBe(true);
    expect(exit).not.toHaveBeenCalled();
    startup.resolve();
    await pending;
    await Promise.resolve();
    expect(exit).toHaveBeenCalledExactlyOnceWith(code);
    expect(cancel).toHaveBeenCalledOnce();
    expect(signals.listenerCount('SIGINT')).toBe(0);
    expect(signals.listenerCount('SIGTERM')).toBe(0);
  });

  it('bounds startup shutdown even when the loader cannot be interrupted', async () => {
    const { signals, exit, lifetime, expire } = setup();
    const startup = deferred();
    const pending = lifetime.track(startup.promise);
    signals.emit('SIGTERM');
    expire();
    expect(exit).toHaveBeenCalledExactlyOnceWith(143);
    startup.resolve();
    await pending;
    expect(exit).toHaveBeenCalledOnce();
  });

  it('cannot report completion success after an observed interrupt', async () => {
    const { signals, exit, lifetime } = setup();
    const startup = deferred();
    const pending = lifetime.track(startup.promise);
    const server = http.createServer();
    lifetime.attach(server);
    const response = new EventEmitter() as http.ServerResponse;
    server.emit(REVIEW_PUBLISHED, response);
    signals.emit('SIGINT');
    response.emit('finish');
    lifetime.stop(1);
    startup.resolve();
    await pending;
    expect(exit).toHaveBeenCalledExactlyOnceWith(130);
    expect(response.listenerCount('finish')).toBe(0);
    expect(response.listenerCount('close')).toBe(0);
    expect(server.listenerCount(REVIEW_PUBLISHED)).toBe(0);
  });

  it('handles repeated signals during one grace period', async () => {
    const { signals, exit, lifetime, expire } = setup();
    const pending = deferred();
    const work = lifetime.track(pending.promise);
    signals.emit('SIGINT');
    signals.emit('SIGTERM');
    expire();
    expect(exit).toHaveBeenCalledExactlyOnceWith(143);
    pending.resolve();
    await work;
    expect(exit).toHaveBeenCalledOnce();
  });

  it('refuses a late listener after interrupted startup', async () => {
    const { signals, exit, lifetime } = setup();
    const startup = deferred();
    const work = lifetime.track(startup.promise);
    signals.emit('SIGINT');
    const server = http.createServer();
    lifetime.attach(server);
    await expect(listenLoopback(server, 0, { signal: lifetime.signal })).rejects.toBe(
      lifetime.signal.reason
    );
    expect(server.listening).toBe(false);
    startup.resolve();
    await work;
    expect(exit).toHaveBeenCalledExactlyOnceWith(130);
  });

  it('cancels a listener while its listen callback is pending', async () => {
    const { signals, exit, lifetime } = setup();
    const server = http.createServer();
    lifetime.attach(server);
    const listening = lifetime.track(listenLoopback(server, 0, { signal: lifetime.signal }));
    signals.emit('SIGTERM');
    await expect(listening).rejects.toBe(lifetime.signal.reason);
    expect(server.listening).toBe(false);
    expect(exit).toHaveBeenCalledExactlyOnceWith(143);
  });

  it('uses exit 1 for ordinary startup failure', () => {
    const { exit, lifetime } = setup();
    lifetime.stop(1);
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
  });
});

it('preserves the drain callback from a legacy publication event', async () => {
  const { lifetime, exit } = setup();
  const server = http.createServer();
  lifetime.attach(server);
  const response = new EventEmitter() as http.ServerResponse;
  const pending = deferred();
  const drain = vi.fn(() => pending.promise);
  server.emit(REVIEW_PUBLISHED, response, drain);
  response.emit('finish');
  expect(drain).toHaveBeenCalledOnce();
  expect(exit).not.toHaveBeenCalled();
  pending.resolve();
  await pending.promise;
  await Promise.resolve();
  expect(exit).toHaveBeenCalledExactlyOnceWith(0);
});
