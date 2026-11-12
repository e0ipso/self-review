import type { Worker } from 'node:worker_threads';
import { ReviewXmlError } from '@self-review/core';
import type { ParsedReview, ReviewXmlErrorCode } from '@self-review/core';

export interface ResumeWorkerOptions {
  signal?: AbortSignal;
  /** Includes parsing, delivery and termination. Omitted/zero uses a bounded 30 seconds. */
  timeoutMs?: number;
  isCurrent?: () => boolean;
}
export interface ResumeParseRequest {
  id: string;
  path: string;
}
export type ResumeParseReply =
  | { id: string; kind: 'parsed'; parsed: ParsedReview }
  | { id: string; kind: 'failed'; error: { message: string; code?: string; details?: string[] } };

export function checkResumeOwnership(options: ResumeWorkerOptions): void {
  options.signal?.throwIfAborted();
  if (options.isCurrent && !options.isCurrent())
    throw new DOMException('Resume operation is no longer current', 'AbortError');
}

/** Never returns a result until this worker has terminated and been reaped. */
export async function runResumeWorker(
  worker: Pick<Worker, 'on' | 'off' | 'postMessage' | 'terminate'>,
  request: ResumeParseRequest,
  options: ResumeWorkerOptions = {}
): Promise<ParsedReview> {
  let cancelled: unknown;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const onAbort = () => {
    cancelled = options.signal?.reason ?? new DOMException('Resume cancelled', 'AbortError');
    rejectResult(cancelled);
  };
  let rejectResult: (error: unknown) => void = () => {};
  let onMessage!: (reply: ResumeParseReply) => void;
  let onError!: (error: Error) => void;
  let onExit!: (code: number) => void;
  const result = await new Promise<ParsedReview>((resolve, reject) => {
    rejectResult = reject;
    onMessage = reply => {
      if (!reply || reply.id !== request.id)
        reject(new Error('Resume parser returned an unowned reply'));
      else if (reply.kind === 'failed' && typeof reply.error?.message === 'string') {
        reject(
          reply.error.code
            ? new ReviewXmlError(reply.error.code as ReviewXmlErrorCode, reply.error.message, {
                details: reply.error.details,
              })
            : new Error(reply.error.message)
        );
      } else if (
        reply.kind === 'parsed' &&
        Array.isArray(reply.parsed?.comments) &&
        Array.isArray(reply.parsed?.viewedFiles) &&
        Array.isArray(reply.parsed?.importDiagnostics)
      )
        resolve(reply.parsed);
      else reject(new Error('Resume parser returned an invalid reply'));
    };
    onError = reject;
    onExit = code => reject(new Error(`Resume parser exited before replying (code ${code})`));
    worker.on('message', onMessage);
    worker.on('error', onError);
    worker.on('exit', onExit);
    options.signal?.addEventListener('abort', onAbort, { once: true });
    try {
      const requested = options.timeoutMs ?? 30_000;
      if (!Number.isFinite(requested) || requested < 0)
        throw new RangeError('Resume timeout must be a nonnegative finite number');
      // GitExecutionOptions already permits zero and fractional deadlines. Zero
      // disables git's timer, but resume still owns its independent bounded timer.
      const timeoutMs = requested === 0 ? 30_000 : Math.min(Math.ceil(requested), 2_147_483_647);
      timer = setTimeout(() => {
        cancelled = new DOMException('Resume parsing timed out', 'TimeoutError');
        reject(cancelled);
      }, timeoutMs);
      checkResumeOwnership(options);
      worker.postMessage(request);
    } catch (error) {
      reject(error);
    }
  }).then(
    parsed => ({ ok: true as const, parsed }),
    (error: unknown) => ({ ok: false as const, error })
  );
  try {
    // Timers/signals remain installed through termination. A native syscall may
    // delay termination; an obsolete result still never reaches adoption.
    await worker.terminate();
  } finally {
    clearTimeout(timer);
    worker.off('message', onMessage);
    worker.off('error', onError);
    worker.off('exit', onExit);
    options.signal?.removeEventListener('abort', onAbort);
  }
  checkResumeOwnership(options);
  if (cancelled) throw cancelled;
  if (!result.ok) throw result.error;
  return result.parsed;
}
