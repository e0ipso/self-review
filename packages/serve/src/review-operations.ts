// Composition of the core engine for one HTTP session. Tests can replace individual
// operations with deferred or failing implementations without patching package imports.

import * as core from '@self-review/core';
import type {
  ReviewSession,
  ReviewState,
  ReviewOutputTarget,
  ExpandContextRequest,
  SuggestionApplyRequest,
} from '@self-review/core';
import { ownedReviewState } from './source-ownership';
import { applyCompatibleSuggestion } from './apply-compatibility';
import type { SubmissionOperations } from './review-submission';

export interface OperationOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

/** Bound to one session; results and errors retain the core operation's contract. */
export interface ReviewOperations extends SubmissionOperations {
  authorizeReviewedPath: (path: string) => ReturnType<typeof core.authorizeReviewedPath>;
  getDiffLoad: () => ReturnType<typeof core.getDiffLoad>;
  getConfigLoad: () => ReturnType<typeof core.getConfigLoad>;
  getResumeLoad: () => ReturnType<typeof core.getResumeLoad>;
  getFileHunks: (path: string) => ReturnType<typeof core.getFileHunks>;
  loadImage: (path: string, options?: OperationOptions) => ReturnType<typeof core.loadImage>;
  readAttachment: (
    path: string,
    options?: OperationOptions
  ) => ReturnType<typeof core.readAttachment>;
  expandContext: (
    request: ExpandContextRequest,
    options?: OperationOptions
  ) => ReturnType<typeof core.expandContext>;
  applySuggestionForSession: (
    request: SuggestionApplyRequest,
    options?: OperationOptions
  ) =>
    | ReturnType<typeof core.applySuggestionForSession>
    | Promise<ReturnType<typeof core.applySuggestionForSession>>;
}

export function createReviewOperations(
  session: ReviewSession,
  output: ReviewOutputTarget
): ReviewOperations {
  return {
    authorizeReviewedPath: path => core.authorizeReviewedPath(session, path),
    getDiffLoad: () => core.getDiffLoad(session),
    getConfigLoad: () => core.getConfigLoad(session),
    getResumeLoad: () => core.getResumeLoad(session),
    getFileHunks: path => core.getFileHunks(session, path),
    loadImage: (path, options) => core.loadImage(session, path, options),
    readAttachment: (path, options) => core.readAttachment(session, path, options),
    expandContext: (request, options) => core.expandContext(session, request, undefined, options),
    applySuggestionForSession: (request, options) =>
      applyCompatibleSuggestion(session, request, options),
    submitReviewState: state =>
      core.submitReviewState(session, ownedReviewState(session, state, output.path)),
    publishReview: (state: ReviewState, options) =>
      core.publishReview(ownedReviewState(session, state, output.path), output.path, {
        ...core.publishOptionsFor(output, session.attachmentOrigins),
        signal: options?.signal,
      }),
  };
}
