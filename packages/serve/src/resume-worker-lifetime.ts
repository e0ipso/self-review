import type { Worker } from 'node:worker_threads';
import { ReviewXmlError } from '@self-review/core';
import type { ParsedReview, ReviewXmlErrorCode } from '@self-review/core';
import {
  runResumeWorker as runOwnedResumeWorker,
  restoreResumeFailure,
} from '@self-review/core/resume-worker';
import type { ResumeWorkerOptions, ResumeParseRequest } from '@self-review/core/resume-worker';
export { checkResumeOwnership } from '@self-review/core/resume-worker';
export type { ResumeWorkerOptions, ResumeParseRequest } from '@self-review/core/resume-worker';

// Keep the original mutable serve details field; additional diagnostics are optional.
export type ResumeParseReply =
  | { id: string; kind: 'parsed'; parsed: ParsedReview }
  | {
      id: string;
      kind: 'failed';
      error: {
        message: string;
        code?: string;
        details?: string[];
        name?: string;
        stack?: string;
        cause?: unknown;
      };
    };

export function runResumeWorker(
  worker: Pick<Worker, 'on' | 'off' | 'postMessage' | 'terminate'>,
  request: ResumeParseRequest,
  options: ResumeWorkerOptions = {}
): Promise<ParsedReview> {
  return runOwnedResumeWorker(worker, request, options, failure =>
    restoreResumeFailure(
      failure,
      (code, message, options) => new ReviewXmlError(code as ReviewXmlErrorCode, message, options)
    )
  );
}
