// Host-owned one-shot resume work. No parser, filesystem or runtime Core class imports.
import type { Worker } from 'node:worker_threads';
import type { ParsedReview } from './xml-parser';
import { readResumeReply } from './resume-worker-protocol';
import type { ResumeParseFailure, ResumeParseRequest } from './resume-worker-protocol';
export * from './resume-worker-protocol';

export interface ResumeWorkerOptions {
  signal?: AbortSignal;
  /** Omitted/zero: 30s; positive fractions round up; capped at 2^31-1 ms. */
  timeoutMs?: number;
  /** The host must revoke ownership when replacing the operation. */
  isCurrent?: () => boolean;
}

export function checkResumeOwnership(options: ResumeWorkerOptions): void {
  options.signal?.throwIfAborted();
  if (options.isCurrent && !options.isCurrent()) {
    throw new DOMException('Resume operation is no longer current', 'AbortError');
  }
}

/** A rejected terminate cannot establish that cancellation released the worker. */
export class ResumeWorkerTerminationError extends Error {
  readonly cause: unknown;
  readonly terminationError: unknown;

  constructor(terminationError: unknown, cause: unknown) {
    super('Resume parser termination failed; worker release is unconfirmed');
    this.name = 'ResumeWorkerTerminationError';
    this.cause = cause;
    this.terminationError = terminationError;
  }
}

/**
 * Owns the supplied worker immediately, even on admission/delivery failure. Never
 * adopts a reply before termination. Abort/deadline remain active until reaped.
 * The host reconstructs failures with its installed peer's error constructors.
 */
export async function runResumeWorker(
  worker: Pick<Worker, 'on' | 'off' | 'postMessage' | 'terminate'>,
  request: ResumeParseRequest,
  options: ResumeWorkerOptions,
  restoreFailure: (failure: ResumeParseFailure) => Error
): Promise<ParsedReview> {
  let cancellation: { reason: unknown } | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onMessage!: (reply: unknown) => void;
  let onError!: (error: Error) => void;
  let onExit!: (code: number) => void;
  let onAbort!: () => void;
  const outcome = await new Promise<ParsedReview>((resolve, reject) => {
    const cancel = (reason: unknown) => {
      // Retain even falsy abort reasons, and the first deadline/abort identity.
      cancellation ??= { reason };
      reject(cancellation.reason);
    };
    onAbort = () => cancel(options.signal!.reason);
    onMessage = reply => {
      try {
        resolve(readResumeReply(reply, request.id, restoreFailure));
      } catch (error) {
        reject(error);
      }
    };
    onError = reject;
    onExit = code => reject(new Error(`Resume parser exited before replying (code ${code})`));
    worker.on('message', onMessage);
    worker.on('error', onError);
    worker.on('exit', onExit);
    options.signal?.addEventListener('abort', onAbort, { once: true });
    try {
      const requested = options.timeoutMs ?? 30_000;
      if (!Number.isFinite(requested) || requested < 0) {
        throw new RangeError('Resume timeout must be a nonnegative finite number');
      }
      const timeoutMs = requested === 0 ? 30_000 : Math.min(Math.ceil(requested), 2_147_483_647);
      timer = setTimeout(
        () => cancel(new DOMException('Resume parsing timed out', 'TimeoutError')),
        timeoutMs
      );
      checkResumeOwnership(options);
      if (!request || typeof request.id !== 'string' || typeof request.path !== 'string') {
        throw new Error('Invalid resume parser request');
      }
      worker.postMessage(request);
    } catch (error) {
      reject(error);
    }
  }).then(
    parsed => ({ ok: true as const, parsed }),
    (error: unknown) => ({ ok: false as const, error })
  );
  let termination: { error: unknown } | undefined;
  try {
    await worker.terminate();
  } catch (error) {
    termination = { error };
  } finally {
    clearTimeout(timer);
    worker.off('message', onMessage);
    worker.off('error', onError);
    worker.off('exit', onExit);
    options.signal?.removeEventListener('abort', onAbort);
  }
  let failure = cancellation ?? (outcome.ok ? undefined : { reason: outcome.error });
  try {
    checkResumeOwnership(options);
  } catch (reason) {
    failure = { reason };
  }
  if (termination) {
    if (failure) throw new ResumeWorkerTerminationError(termination.error, failure.reason);
    throw termination.error;
  }
  if (failure) throw failure.reason;
  if (outcome.ok) return outcome.parsed;
  throw outcome.error;
}
