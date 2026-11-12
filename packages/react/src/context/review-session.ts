// Compatibility entry point. Policy, projections and lifetime ownership have one-way imports.
export {
  DEFAULT_STATIC_SOURCE,
  LOADING_SOURCE,
  isPlaceholderSource,
  reviewSessionIdentity,
  sameRemoteSnapshot,
  type ReviewSessionState,
  type SessionAction,
} from './review-session-transitions';
export {
  createReviewSession,
  createReviewSessionStore,
  reviewSessionReducer,
  type ReviewSessionStore,
} from './review-session-store';
export type { FileReviewSummary, FileProgressSummary } from './review-session-indexes';
