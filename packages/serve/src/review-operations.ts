// Composition of the core engine for one HTTP session. Tests can replace individual
// operations with deferred or failing implementations without patching package imports.

import type * as core from '@self-review/core';
import { installedServeEngine, type ServeEngine } from './engine-contract';
import type {
  ReviewSession,
  ReviewState,
  ReviewOutputTarget,
  ExpandContextRequest,
  SuggestionApplyRequest,
} from '@self-review/core';
import { ownedReviewState } from './source-ownership';
import type { SubmissionOperations, PublicationOperations } from './review-submission';
import { createRequestValidation, type RequestValidation } from './validate';
import { nonThrowingReporter } from './diagnostic-reporter';

export interface OperationOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

/** Bound to one session; results and errors retain the core operation's contract. */
export interface ReviewOperations extends SubmissionOperations {
  /** Optional for original operation sets. Bound together with the selected engine. */
  requestValidation?: RequestValidation;
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

export type ReviewTransportOperations = Omit<ReviewOperations, keyof SubmissionOperations>;
export type PublicationReviewOperations = ReviewTransportOperations & PublicationOperations;

/** The publication consumer needs reads, one writer and its peer's validation. */
export type PublicationEngine = Pick<
  ServeEngine,
  'applySuggestion' | 'requestContract' | 'validateReviewState'
> & {
  core: Pick<
    typeof core,
    | 'authorizeReviewedPath'
    | 'getDiffLoad'
    | 'getConfigLoad'
    | 'getResumeLoad'
    | 'getFileHunks'
    | 'loadImage'
    | 'readAttachment'
    | 'expandContext'
    | 'publishReview'
    | 'publishOptionsFor'
    | 'ReviewXmlError'
    | 'ReviewPublishError'
  >;
};

/** First-party operations publish the supplied state without a redundant handoff. */
export function createPublicationOperations(
  session: ReviewSession,
  output: ReviewOutputTarget,
  engine?: PublicationEngine,
  reportDiagnostic?: (message: string) => void
): PublicationReviewOperations;
/** Retain the original reflected parameter type for existing consumers. */
export function createPublicationOperations(
  session: ReviewSession,
  output: ReviewOutputTarget,
  engine?: ServeEngine,
  reportDiagnostic?: (message: string) => void
): PublicationReviewOperations;
export function createPublicationOperations(
  session: ReviewSession,
  output: ReviewOutputTarget,
  engine: PublicationEngine = installedServeEngine,
  reportDiagnostic?: (message: string) => void
): PublicationReviewOperations {
  const { core, applySuggestion } = engine;
  const report = reportDiagnostic && nonThrowingReporter(reportDiagnostic);
  return {
    requestValidation: createRequestValidation(engine),
    publicationError: core.ReviewPublishError,
    authorizeReviewedPath: path => core.authorizeReviewedPath(session, path),
    getDiffLoad: () => core.getDiffLoad(session),
    getConfigLoad: () => core.getConfigLoad(session),
    getResumeLoad: () => core.getResumeLoad(session),
    getFileHunks: path => core.getFileHunks(session, path),
    loadImage: (path, options) =>
      core.loadImage(session, path, report ? { ...options, reportDiagnostic: report } : options),
    readAttachment: (path, options) =>
      core.readAttachment(
        session,
        path,
        report ? { ...options, reportDiagnostic: report } : options
      ),
    expandContext: (request, options) => core.expandContext(session, request, undefined, options),
    applySuggestionForSession: (request, options) => applySuggestion(session, request, options),
    publishReview: (state: ReviewState, options) => {
      const owned = ownedReviewState(session, state, output.path, core.ReviewPublishError);
      // Preserve the CLI diagnostic without recreating the handoff cache mutation.
      if (report)
        report(
          '[review] Review state submitted:',
          JSON.stringify({
            timestamp: owned.timestamp,
            source: owned.source,
            fileCount: owned.files.length,
          })
        );
      return core.publishReview(owned, output.path, {
        ...core.publishOptionsFor(output, session.attachmentOrigins),
        signal: options?.signal,
        reportDiagnostic: report,
      });
    },
  };
}

/** Compatibility factory retains the original state-handoff operation. */
export function createReviewOperations(
  session: ReviewSession,
  output: ReviewOutputTarget
): ReviewOperations {
  return {
    ...createPublicationOperations(session, output),
    submitReviewState: state =>
      installedServeEngine.core.submitReviewState(
        session,
        ownedReviewState(session, state, output.path)
      ),
  };
}
