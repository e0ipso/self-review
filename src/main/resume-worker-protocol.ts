// Internal one-shot worker protocol. The worker reads the bounded path, never a main-thread XML copy.
import { ReviewXmlError } from '../../packages/core/src/xml-errors';
import type { ReviewXmlErrorCode } from '../../packages/core/src/xml-errors';
import type { ParsedReview } from '../../packages/core/src/xml-parser';

export interface ResumeParseRequest {
  id: string;
  path: string;
}

export interface ResumeParseFailure {
  name: string;
  message: string;
  stack?: string;
  code?: ReviewXmlErrorCode;
  details?: readonly string[];
  cause?: unknown;
}

export type ResumeParseReply =
  | { id: string; kind: 'parsed'; parsed: ParsedReview }
  | { id: string; kind: 'failed'; error: ResumeParseFailure };

export function describeResumeFailure(error: unknown): ResumeParseFailure {
  if (!(error instanceof Error)) return { name: 'Error', message: String(error) };
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...(error instanceof ReviewXmlError
      ? { code: error.code, details: error.details, cause: describeCause(error.cause) }
      : {}),
  };
}

export function restoreResumeFailure(failure: ResumeParseFailure): Error {
  const error = failure.code
    ? new ReviewXmlError(failure.code, failure.message, {
        details: failure.details,
        cause: restoreCause(failure.cause),
      })
    : new Error(failure.message);
  error.name = failure.name;
  if (failure.stack) error.stack = failure.stack;
  return error;
}

// Native Error structured cloning drops errno/code/path. Keep read diagnostics explicitly.
function describeCause(cause: unknown): unknown {
  if (!(cause instanceof Error)) return cause;
  const native = cause as NodeJS.ErrnoException;
  return {
    name: native.name,
    message: native.message,
    stack: native.stack,
    code: native.code,
    errno: native.errno,
    path: native.path,
    syscall: native.syscall,
  };
}

function restoreCause(cause: unknown): unknown {
  if (
    !cause ||
    typeof cause !== 'object' ||
    !('message' in cause) ||
    typeof cause.message !== 'string'
  ) {
    return cause;
  }
  return Object.assign(new Error(cause.message), cause);
}
