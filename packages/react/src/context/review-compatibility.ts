import type { DiffFile } from '@self-review/types';
import type { ReviewContextValue } from './ReviewContext';
import type { ReviewCommands } from './review-commands';
import type { ReviewSessionStore } from './review-session';
import type { UseReviewStateReturn } from '../hooks/useReviewState';

/** Legacy projection remains complete while first-party features select their own data. */
export function projectReviewContext(
  store: ReviewSessionStore,
  state: ReturnType<ReviewSessionStore['getSnapshot']>,
  diffFiles: DiffFile[],
  commands: ReviewCommands,
  review: UseReviewStateReturn,
  retryLoad: () => Promise<void>,
  retryResume: () => Promise<void>
): ReviewContextValue {
  return {
    ...commands,
    files: state.files,
    diffFiles,
    diffSource: state.diffSource,
    setDiffFiles: files => store.dispatch({ type: 'diff-files', files }),
    getCommentsForFile: review.getCommentsForFile,
    getCommentsForLine: review.getCommentsForLine,
    remoteDrift: state.resumedReview?.remoteDrift ?? null,
    importDiagnostics: state.resumedReview?.importDiagnostics ?? [],
    remote: state.remote,
    diagnostics: state.diagnostics,
    isLargePayload: state.isLargePayload,
    applyDestination: state.applyDestination,
    reviewedPaths: state.reviewedPaths,
    sessionId: state.sessionId,
    snapshotId: state.snapshotId,
    loadError: state.loadError,
    resumeError: state.resumeError,
    retryLoad,
    retryResume,
  };
}
