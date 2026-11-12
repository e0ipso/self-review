import type { Worker } from 'node:worker_threads';
import type { ParsedReview } from '../../packages/core/src/xml-parser';
import { restoreResumeFailure } from './resume-worker-protocol';
import type { ResumeParseReply, ResumeParseRequest } from './resume-worker-protocol';

export interface ResumeWorkerOptions {
  signal?: AbortSignal;
  /** Covers startup, parsing, delivery and termination. Defaults to 30 seconds. */
  timeoutMs?: number;
  /** The admitting host must revoke ownership when replacing its startup operation. */
  isCurrent?: () => boolean;
}

export function checkResumeOwnership(options: ResumeWorkerOptions): void {
  options.signal?.throwIfAborted();
  if (options.isCurrent && !options.isCurrent()) {
    throw new DOMException('Resume operation is no longer current', 'AbortError');
  }
}

/** Owns exactly this worker until termination completes, including failed message delivery. */
export async function runResumeWorker(
  worker: Pick<Worker, 'on' | 'off' | 'postMessage' | 'terminate'>,
  request: ResumeParseRequest,
  options: ResumeWorkerOptions
): Promise<ParsedReview> {
  let cancellation: Error | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onMessage: (reply: ResumeParseReply) => void;
  let onError: (error: Error) => void;
  let onExit: (code: number) => void;
  let onAbort: () => void;
  const outcome = await new Promise<ParsedReview>((resolve, reject) => {
    onAbort = () => {
      cancellation = options.signal?.reason ?? new DOMException('Resume cancelled', 'AbortError');
      reject(cancellation);
    };
    onMessage = reply => {
      if (!reply || reply.id !== request.id) {
        reject(new Error('Resume parser returned an unowned reply'));
      } else if (reply.kind === 'failed' && typeof reply.error?.message === 'string') {
        reject(restoreResumeFailure(reply.error));
      } else if (
        reply.kind === 'parsed' &&
        Array.isArray(reply.parsed?.comments) &&
        Array.isArray(reply.parsed?.viewedFiles) &&
        Array.isArray(reply.parsed?.importDiagnostics)
      ) {
        resolve(reply.parsed);
      } else {
        reject(new Error('Resume parser returned an invalid reply'));
      }
    };
    onError = reject;
    onExit = code => reject(new Error(`Resume parser exited before replying (code ${code})`));
    worker.on('message', onMessage);
    worker.on('error', onError);
    worker.on('exit', onExit);
    options.signal?.addEventListener('abort', onAbort, { once: true });
    const timeoutMs = options.timeoutMs ?? 30_000;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647) {
      reject(new RangeError('Resume timeout must be a positive timer-safe integer'));
      return;
    }
    timer = setTimeout(() => {
      cancellation = new DOMException('Resume parsing timed out', 'TimeoutError');
      reject(cancellation);
    }, timeoutMs);
    try {
      checkResumeOwnership(options);
      worker.postMessage(request);
    } catch (error) {
      reject(error);
    }
  }).then(
    parsed => ({ ok: true as const, parsed }),
    (error: unknown) => ({ ok: false as const, error })
  );
  let terminationError: unknown;
  try {
    // Keep abort/deadline listeners alive while termination is pending. A delivered result
    // does not authorize adoption until this worker has released its resources.
    await worker.terminate();
  } catch (error) {
    terminationError = error;
  } finally {
    clearTimeout(timer);
    worker.off('message', onMessage!);
    worker.off('error', onError!);
    worker.off('exit', onExit!);
    options.signal?.removeEventListener('abort', onAbort!);
  }
  checkResumeOwnership(options);
  if (cancellation) throw cancellation;
  if (terminationError) throw terminationError;
  if (!outcome.ok) throw outcome.error;
  return outcome.parsed;
}
