// Desktop error reconstruction uses the same Core classes as the host.
import { ReviewXmlError } from '../../packages/core/src/xml-errors';
import type { ReviewXmlErrorCode } from '../../packages/core/src/xml-errors';
import {
  describeResumeFailure as describeFailure,
  restoreResumeFailure as restoreFailure,
} from '../../packages/core/src/resume-worker';
import type { ResumeParseFailure as SharedFailure } from '../../packages/core/src/resume-worker';
import type { ParsedReview } from '../../packages/core/src/xml-parser';
export type { ResumeParseRequest } from '../../packages/core/src/resume-worker';

export interface ResumeParseFailure extends SharedFailure {
  name: string;
  code?: ReviewXmlErrorCode;
}

export type ResumeParseReply =
  | { id: string; kind: 'parsed'; parsed: ParsedReview }
  | { id: string; kind: 'failed'; error: ResumeParseFailure };

export function describeResumeFailure(error: unknown): ResumeParseFailure {
  return describeFailure(error, error =>
    error instanceof ReviewXmlError ? { code: error.code, details: error.details } : undefined
  ) as ResumeParseFailure;
}

export function restoreResumeFailure(failure: SharedFailure): Error {
  return restoreFailure(
    failure,
    (code, message, options) => new ReviewXmlError(code as ReviewXmlErrorCode, message, options)
  );
}
