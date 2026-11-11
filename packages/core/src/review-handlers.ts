// Stable transport-neutral facade. Session state, content reads, suggestion writes, expansion,
// and review preparation each live in a module with their own dependencies.
export {
  createReviewSession,
  commitDiffData,
  locateReviewedFile,
  preparePayload,
  getDiffLoad,
  resolveSourceBaseDir,
  getFileHunks,
  getConfigLoad,
  submitReviewState,
  takeReviewState,
  getResumeLoad,
} from './review-session';
export type { ReviewSession } from './review-session';
export { loadImage, recordResumedAttachments, readAttachment } from './review-content';
export {
  isTemporaryCloneSession,
  resolveApplyDestination,
  setApplyDestination,
  applySuggestionForSession,
} from './review-suggestions';
export { expandContext } from './review-context';
export type { ContextExpansionDependencies } from './review-context';
export { prepareDirectoryReview, commitReviewStart } from './review-start';
export type { ReviewStartResult } from './review-start';
