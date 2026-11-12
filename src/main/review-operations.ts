// Concrete engine binding belongs at the desktop composition root. Registrars consume this role.
import {
  applySuggestionForSessionAsync,
  commitReviewStart,
  expandContext,
  getConfigLoad,
  getDiffLoad,
  getFileHunks,
  getResumeLoad,
  loadImage,
  prepareDirectoryReview,
  readAttachment,
  setApplyDestination,
  submitReviewState,
} from '../../packages/core/src/review-handlers';
import type { ReviewSession } from '../../packages/core/src/review-handlers';
import { checkContentBudget } from './content-budget';
import type {
  ReviewState,
  SuggestionApplyRequest,
  ExpandContextRequest,
  DiffLoadPayload,
  ReviewSourceIdentity,
} from '../shared/types';

export function bindDesktopReviewOperations(session: ReviewSession, canMutate = () => true) {
  const writable = () => {
    if (!canMutate()) throw new Error('The review is finishing.');
  };
  return {
    getDiffLoad: () => {
      checkContentBudget(session.diffData, session.diffData?.isLargePayload);
      checkContentBudget(session.guideData);
      return getDiffLoad(session);
    },
    getConfigLoad: () => getConfigLoad(session),
    getResumeLoad: () => getResumeLoad(session),
    getConfig: () => session.config,
    captureReadSnapshot: () => {
      const identity = session.sourceIdentity;
      const paths = session.reviewedPaths;
      const source = session.diffData?.source;
      return () => {
        if (
          session.sourceIdentity !== identity ||
          session.reviewedPaths !== paths ||
          session.diffData?.source !== source
        )
          throw new Error('The review session has changed.');
      };
    },
    captureSnapshot: () => {
      const original = session.sourceIdentity;
      const diff = session.diffData;
      return () => {
        if (session.sourceIdentity !== original || session.diffData !== diff)
          throw new Error('The review session has changed.');
      };
    },
    invalidateReviewState: () => {
      writable();
      session.reviewState = null;
    },
    submitReviewState: (state: ReviewState) => {
      writable();
      submitReviewState(session, state);
    },
    getFileHunks: (path: string) => getFileHunks(session, path),
    loadImage: (path: string, signal: AbortSignal) => loadImage(session, path, { signal }),
    readAttachment: (reference: unknown, signal: AbortSignal) =>
      readAttachment(session, reference, { signal }),
    applySuggestion: (request: SuggestionApplyRequest, signal: AbortSignal) => {
      writable();
      return applySuggestionForSessionAsync(session, request, { signal });
    },
    setApplyDestination: (path: string) => {
      writable();
      return setApplyDestination(session, path);
    },
    expandContext: (request: ExpandContextRequest, signal: AbortSignal) => {
      writable();
      return expandContext(session, request, undefined, { signal, timeoutMs: 30_000 });
    },
    prepareDirectoryReview: (path: string, signal?: AbortSignal) =>
      prepareDirectoryReview(session, path, { signal }),
    commitReviewStart: (payload: DiffLoadPayload, identity: ReviewSourceIdentity) => {
      writable();
      return commitReviewStart(session, payload, identity);
    },
  };
}
export type DesktopReviewOperations = ReturnType<typeof bindDesktopReviewOperations>;
