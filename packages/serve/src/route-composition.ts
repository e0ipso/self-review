// Legacy operation bundles may omit validation. Only composition selects that default.
import { installedServeEngine } from './engine-contract';
import { createRequestValidation, type RequestValidation } from './validate';
import type { ReviewTransportOperations } from './review-operations';

export function bindRouteValidation(
  operations: Pick<ReviewTransportOperations, 'requestValidation'>,
  validation?: RequestValidation
): RequestValidation {
  return (
    validation ?? operations.requestValidation ?? createRequestValidation(installedServeEngine)
  );
}

/** Modern composition never borrows validation from the installed default peer. */
export function bindSelectedRouteValidation(
  operations: import('./review-operations').ValidatedReviewOperations
): RequestValidation {
  return {
    parseExpandContextBody: body => operations.requestValidation.parseExpandContextBody(body),
    parseSuggestionApplyBody: body => operations.requestValidation.parseSuggestionApplyBody(body),
    parseReviewStateBody: body => operations.requestValidation.parseReviewStateBody(body),
  };
}
