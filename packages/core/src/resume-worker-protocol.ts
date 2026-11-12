import type { ParsedReview } from './xml-parser';

export interface ResumeParseRequest {
  id: string;
  path: string;
}

/** Name/stack/cause are additive; legacy serve failures only carried message/code/details. */
export interface ResumeParseFailure {
  name?: string;
  message: string;
  stack?: string;
  code?: string;
  details?: readonly string[];
  cause?: unknown;
}

export type ResumeParseReply =
  | { id: string; kind: 'parsed'; parsed: ParsedReview }
  | { id: string; kind: 'failed'; error: ResumeParseFailure };

/** Validates the reply envelope without changing the parser's result or optional metadata. */
export function readResumeReply(
  reply: unknown,
  id: string,
  restoreFailure: (failure: ResumeParseFailure) => Error
): ParsedReview {
  if (!isRecord(reply) || reply.id !== id) {
    throw new Error('Resume parser returned an unowned reply');
  }
  if (reply.kind === 'failed' && isFailure(reply.error)) throw restoreFailure(reply.error);
  if (
    reply.kind === 'parsed' &&
    isRecord(reply.parsed) &&
    Array.isArray(reply.parsed.comments) &&
    Array.isArray(reply.parsed.viewedFiles) &&
    Array.isArray(reply.parsed.importDiagnostics)
  ) {
    return reply.parsed as unknown as ParsedReview;
  }
  throw new Error('Resume parser returned an invalid reply');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function isFailure(value: unknown): value is ResumeParseFailure {
  return (
    isRecord(value) &&
    typeof value.message === 'string' &&
    ['name', 'stack', 'code'].every(
      key => value[key] === undefined || typeof value[key] === 'string'
    ) &&
    (value.details === undefined ||
      (Array.isArray(value.details) && value.details.every(detail => typeof detail === 'string')))
  );
}

export function describeResumeFailure(
  error: unknown,
  xmlDetails: (error: Error) => Pick<ResumeParseFailure, 'code' | 'details'> | undefined
): ResumeParseFailure {
  if (!(error instanceof Error)) return { name: 'Error', message: String(error) };
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...xmlDetails(error),
    cause: describeCause((error as Error & { cause?: unknown }).cause),
  };
}

export function restoreResumeFailure(
  failure: ResumeParseFailure,
  createXmlError: (
    code: string,
    message: string,
    options: { details?: readonly string[]; cause?: unknown }
  ) => Error
): Error {
  const cause = restoreCause(failure.cause);
  const error = failure.code
    ? createXmlError(failure.code, failure.message, { details: failure.details, cause })
    : Object.assign(new Error(failure.message), cause === undefined ? {} : { cause });
  if (failure.name !== undefined) error.name = failure.name;
  if (failure.stack) error.stack = failure.stack;
  return error;
}

// Native Error structured cloning drops errno/code/path. Preserve read diagnostics explicitly.
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
  if (!isRecord(cause) || typeof cause.message !== 'string') return cause;
  return Object.assign(new Error(cause.message), cause);
}
