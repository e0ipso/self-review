// One shutdown owner for startup, publication and signals. Publication is an
// explicit event; a response status cannot prove that a file was committed.
import type * as http from 'node:http';
import { REQUEST_SHUTDOWN, type ManagedReviewServer } from './request-admission';

export const REVIEW_PUBLISHED = 'review-published';
const SHUTDOWN_GRACE_MS = 5_000;
type ScheduleDeadline = (expire: () => void) => () => void;
const scheduleDeadline: ScheduleDeadline = expire => {
  const timer = setTimeout(expire, SHUTDOWN_GRACE_MS);
  return () => clearTimeout(timer);
};
interface SignalSource {
  on(signal: 'SIGINT' | 'SIGTERM', listener: () => void): unknown;
  off(signal: 'SIGINT' | 'SIGTERM', listener: () => void): unknown;
}
export interface LifecycleOptions {
  exit?: (code: number) => void;
  scheduleDeadline?: ScheduleDeadline;
  signals?: SignalSource;
}
export interface CompletionOptions extends LifecycleOptions {
  server: http.Server;
}

export function createServeLifecycle(options: LifecycleOptions = {}) {
  const { exit = process.exit, scheduleDeadline: schedule = scheduleDeadline, signals } = options;
  const controller = new AbortController();
  const pending = new Set<Promise<unknown>>();
  let server: http.Server | undefined;
  let stopping = false;
  let exited = false;
  let exitCode = 0;
  let interrupted = false;
  let cancelDeadline = () => {};
  const cleanupResponses = new Set<() => void>();

  const finish = () => {
    if (exited) return;
    exited = true;
    cancelDeadline();
    signals?.off('SIGINT', onInterrupt);
    signals?.off('SIGTERM', onTerminate);
    server?.off(REVIEW_PUBLISHED, onPublished);
    server?.off('listening', onListening);
    for (const cleanup of cleanupResponses) cleanup();
    cleanupResponses.clear();
    server?.closeAllConnections();
    exit(exitCode);
  };
  const maybeFinish = () => {
    if (stopping && pending.size === 0) finish();
  };
  const track = <T>(work: Promise<T>): Promise<T> => {
    pending.add(work);
    void work.then(
      () => {
        pending.delete(work);
        maybeFinish();
      },
      () => {
        pending.delete(work);
        maybeFinish();
      }
    );
    return work;
  };
  const drainServer = () => {
    server?.close();
    const managed = server as Partial<ManagedReviewServer> | undefined;
    if (managed?.[REQUEST_SHUTDOWN]) track(managed[REQUEST_SHUTDOWN]());
  };
  const stop = (code: number) => {
    if (exited) return;
    if (code === 130 || code === 143) {
      interrupted = true;
      exitCode = code;
    } else if (!interrupted) exitCode = code;
    if (stopping) return;
    stopping = true;
    // Cancellation never rolls back a publication that has already committed.
    controller.abort(new Error('Review server is stopping.'));
    cancelDeadline = schedule(() => {
      console.error(
        '[serve] Shutdown deadline reached; closing remaining connections and waiting for owned work.'
      );
      server?.closeAllConnections();
      maybeFinish();
    });
    drainServer();
    maybeFinish();
  };
  function onInterrupt() {
    stop(130);
  }
  function onTerminate() {
    stop(143);
  }
  function onListening() {
    if (stopping) server?.close();
  }
  function onPublished(response: http.ServerResponse, drain?: () => Promise<void>) {
    const cleanup = () => {
      response.off('finish', complete);
      response.off('close', complete);
      cleanupResponses.delete(cleanup);
    };
    const complete = () => {
      cleanup();
      console.error('[serve] Review complete; stopping.');
      // Older servers hand ownership over through the event instead of the symbol.
      if (drain && !(server as Partial<ManagedReviewServer> | undefined)?.[REQUEST_SHUTDOWN])
        track(drain());
      stop(0);
    };
    cleanupResponses.add(cleanup);
    response.once('finish', complete);
    response.once('close', complete);
    if (response.writableFinished || response.destroyed) complete();
  }
  signals?.on('SIGINT', onInterrupt);
  signals?.on('SIGTERM', onTerminate);
  return {
    signal: controller.signal,
    track,
    stop,
    attach(value: http.Server) {
      server = value;
      server.on(REVIEW_PUBLISHED, onPublished);
      server.on('listening', onListening);
      if (stopping) drainServer();
    },
  };
}

/** Compatibility call form for embedders that attach completion after construction. */
export function completeReviewOnSubmit(options: CompletionOptions): void {
  createServeLifecycle(options).attach(options.server);
}
