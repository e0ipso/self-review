// Bounded ownership of admitted work and its response. A disconnected response
// does not release a slot until its underlying operation also settles.
import type * as http from 'node:http';
import { SERVER_BUSY_ERROR } from './protocol';

export const REQUEST_SHUTDOWN = Symbol('review-request-shutdown');
export interface ManagedReviewServer extends http.Server {
  [REQUEST_SHUTDOWN](): Promise<void>;
}
export type RequestKind = 'read' | 'expensive-read' | 'mutation' | 'publication';
export interface AdmissionOptions {
  maxRequests?: number;
  maxExpensiveReads?: number;
  requestTimeoutMs?: number;
}
interface Admitted {
  controller: AbortController;
  done: Promise<void>;
  cancelDeadline(): void;
}

export class RequestAdmission {
  private readonly active = new Set<Admitted>();
  private expensiveReads = 0;
  private exclusive = false;
  private stopping = false;

  constructor(private readonly options: AdmissionOptions = {}) {
    for (const value of Object.values(options)) {
      if (value !== undefined && (!Number.isSafeInteger(value) || value < 1)) {
        throw new Error('Request admission limits must be positive safe integers.');
      }
    }
  }

  rejection(kind: RequestKind): { status: number; error: string } | null {
    if (this.stopping) return { status: 503, error: 'review complete; server is stopping' };
    if ((kind === 'publication' || kind === 'mutation') && this.exclusive) {
      return {
        status: 409,
        error:
          kind === 'publication'
            ? 'review submission already in progress or complete'
            : 'review source mutation or publication already in progress',
      };
    }
    if (
      this.active.size >= (this.options.maxRequests ?? 32) ||
      (kind === 'expensive-read' && this.expensiveReads >= (this.options.maxExpensiveReads ?? 8))
    ) {
      return { status: 503, error: SERVER_BUSY_ERROR };
    }
    return null;
  }

  run(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    kind: RequestKind,
    work: (signal: AbortSignal) => Promise<void>,
    timeout: () => void
  ): void {
    const controller = new AbortController();
    const exclusive = kind === 'publication' || kind === 'mutation';
    if (exclusive) this.exclusive = true;
    if (kind === 'expensive-read') this.expensiveReads++;
    const abort = () => controller.abort(new Error('Review request disconnected.'));
    const onClose = () => {
      if (!res.writableFinished) abort();
    };
    req.once('aborted', abort);
    res.once('close', onClose);
    const timer = setTimeout(() => {
      controller.abort(new Error('Review request deadline exceeded.'));
      timeout();
    }, this.options.requestTimeoutMs ?? 60_000);
    const flushed = new Promise<void>(resolve => {
      const finish = () => {
        res.off('finish', finish);
        res.off('close', finish);
        resolve();
      };
      res.once('finish', finish);
      res.once('close', finish);
    });
    // Defer execution until this admission is visible to shutdown.
    const done = Promise.allSettled([
      Promise.resolve().then(() => work(controller.signal)),
      flushed,
    ]).then(() => {
      clearTimeout(timer);
      req.off('aborted', abort);
      res.off('close', onClose);
      this.active.delete(entry);
      if (exclusive) this.exclusive = false;
      if (kind === 'expensive-read') this.expensiveReads--;
    });
    const entry = { controller, done, cancelDeadline: () => clearTimeout(timer) };
    this.active.add(entry);
  }

  drain(): Promise<void> {
    return Promise.allSettled([...this.active].map(entry => entry.done)).then(() => {});
  }

  shutdown(): Promise<void> {
    this.stopping = true;
    for (const entry of this.active) {
      entry.cancelDeadline();
      entry.controller.abort(new Error('Review server is stopping.'));
    }
    return this.drain();
  }
}
