import { describe, it, expect, vi, afterEach } from 'vitest';
import { RemoteLifetime, createDesktopShutdown } from './remote-lifetime';
import type { RemoteBootstrapResult } from '../../packages/core/src/remote-mode';
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}
function result(cleanup: () => Promise<void>) {
  return { session: { cleanup } } as RemoteBootstrapResult;
}
afterEach(() => vi.useRealTimers());
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

describe('desktop remote resource ownership', () => {
  it.each(['loaded', 'late', 'cancelled'] as const)(
    'closes on the deadline but awaits %s owned cleanup before hard exit',
    async origin => {
      vi.useFakeTimers();
      const remote = new RemoteLifetime();
      const done = deferred<void>();
      const bootstrap = deferred<RemoteBootstrapResult>();
      const cleanup = vi.fn(() => done.promise);
      let opening: Promise<RemoteBootstrapResult> | undefined;
      let rejected: Promise<void> | undefined;
      let cancelled: Promise<void> | undefined;
      if (origin === 'late') {
        opening = remote.open(() => bootstrap.promise);
        rejected = expect(opening).rejects.toThrow(/cancelled/);
      } else {
        await remote.open(async () => result(cleanup));
        if (origin === 'cancelled') cancelled = remote.cancelOpen();
      }
      const exit = vi.fn();
      const close = vi.fn();
      const shutdown = createDesktopShutdown(remote, exit, close);
      const shuttingDown = shutdown(0, 'SIGTERM');
      expect(shutdown(1, 'second signal')).toBe(shuttingDown);
      await flush();
      if (origin === 'late') bootstrap.resolve(result(cleanup));
      await flush();
      expect(cleanup).toHaveBeenCalledOnce();
      await vi.advanceTimersByTimeAsync(10_000);
      expect(close).toHaveBeenCalledOnce();
      expect(exit).not.toHaveBeenCalled();
      done.resolve();
      await Promise.all([shuttingDown, rejected, cancelled]);
      expect(cleanup).toHaveBeenCalledOnce();
      expect(exit).toHaveBeenCalledExactlyOnceWith(0);
      expect(vi.getTimerCount()).toBe(0);
    }
  );

  it('aborts startup and awaits a late acquired cleanup before repeated signals exit once', async () => {
    const remote = new RemoteLifetime();
    const bootstrap = deferred<RemoteBootstrapResult>();
    const cleanupDone = deferred<void>();
    const cleanup = vi.fn(() => cleanupDone.promise);
    let signal!: AbortSignal;
    const opening = remote.open(async controller => {
      signal = controller.signal;
      return bootstrap.promise;
    });
    const rejected = expect(opening).rejects.toThrow(/cancelled/);
    await Promise.resolve();
    const exit = vi.fn();
    const close = vi.fn();
    const shutdown = createDesktopShutdown(remote, exit, close);
    const first = shutdown(0, 'SIGINT');
    expect(shutdown(0, 'SIGTERM')).toBe(first);
    await Promise.resolve();
    expect(signal.aborted).toBe(true);
    bootstrap.resolve(result(cleanup));
    await vi.waitFor(() => expect(cleanup).toHaveBeenCalledOnce());
    expect(exit).not.toHaveBeenCalled();
    cleanupDone.resolve();
    await rejected;
    await first;
    expect(exit).toHaveBeenCalledExactlyOnceWith(0);
    expect(close).toHaveBeenCalledOnce();
  });

  it('waits for acquired session refs on normal quit and fatal exit', async () => {
    const remote = new RemoteLifetime();
    const done = deferred<void>();
    const cleanup = vi.fn(() => done.promise);
    await remote.open(async () => result(cleanup));
    const exit = vi.fn();
    const shutdown = createDesktopShutdown(remote, exit, vi.fn());
    const quitting = shutdown(1, 'initialization failed');
    await vi.waitFor(() => expect(cleanup).toHaveBeenCalledOnce());
    expect(exit).not.toHaveBeenCalled();
    done.resolve();
    await quitting;
    expect(exit).toHaveBeenCalledWith(1);
    expect(remote.dispose('again')).toBe(remote.dispose('again'));
    await expect(remote.open(async () => result(cleanup))).rejects.toThrow();
  });

  it('bounds shutdown when bootstrap never acknowledges cancellation', async () => {
    vi.useFakeTimers();
    const remote = new RemoteLifetime();
    void remote.open(() => new Promise(() => {}));
    const exit = vi.fn();
    const shuttingDown = createDesktopShutdown(remote, exit, vi.fn())(0, 'SIGTERM');
    await vi.advanceTimersByTimeAsync(9999);
    expect(exit).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await shuttingDown;
    expect(exit).toHaveBeenCalledExactlyOnceWith(0);
  });

  it('normal quit joins cleanup already started by a cancelled welcome review', async () => {
    const remote = new RemoteLifetime();
    const done = deferred<void>();
    const cleanup = vi.fn(() => done.promise);
    await remote.open(async () => result(cleanup));
    const cancelled = remote.cancelOpen();
    const disposed = remote.dispose('quit');
    let finished = false;
    void disposed.then(() => {
      finished = true;
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(finished).toBe(false);
    done.resolve();
    await Promise.all([cancelled, disposed]);
    expect(cleanup).toHaveBeenCalledOnce();
  });
});
