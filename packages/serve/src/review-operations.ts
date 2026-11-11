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
import type { SubmissionOperations } from './review-submission';

/** Bound to one session; results and errors retain the core operation's contract. */
export interface ReviewOperations extends SubmissionOperations {
  authorizeReviewedPath: (path: string) => ReturnType<typeof core.authorizeReviewedPath>;
  getDiffLoad: () => ReturnType<typeof core.getDiffLoad>;
  getConfigLoad: () => ReturnType<typeof core.getConfigLoad>;
  getResumeLoad: () => ReturnType<typeof core.getResumeLoad>;
  getFileHunks: (path: string) => ReturnType<typeof core.getFileHunks>;
  loadImage: (path: string) => ReturnType<typeof core.loadImage>;
  readAttachment: (path: string) => ReturnType<typeof core.readAttachment>;
  expandContext: (request: ExpandContextRequest) => ReturnType<typeof core.expandContext>;
  applySuggestionForSession: (
    request: SuggestionApplyRequest
  ) => ReturnType<typeof core.applySuggestionForSession>;
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
    loadImage: path => core.loadImage(session, path),
    readAttachment: path => core.readAttachment(session, path),
    expandContext: request => core.expandContext(session, request),
    applySuggestionForSession: request => core.applySuggestionForSession(session, request),
    submitReviewState: state => core.submitReviewState(session, state),
    publishReview: (state: ReviewState) =>
      core.publishReview(
        state,
        output.path,
        core.publishOptionsFor(output, session.attachmentOrigins)
      ),
  };
}
