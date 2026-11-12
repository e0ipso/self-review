// Supported host operations. Adapter implementations live under the filesystem subpath.
export { loadConfig, loadConfigWithProvenance } from './config';
export type { LoadConfigOptions, LoadedConfig, ConfigProvenance } from './config';
export { resolveStartupSourceAsync } from './startup-mode';
export type {
  StartupSource,
  StartupSourceOptions,
  StartupPathProbe,
  StartupPathStats,
} from './startup-mode';
export {
  resolveOutputTarget,
  publishOptionsFor,
  resolveStartupDiffArgs,
  loadLocalReview,
  loadResumeDocument,
  ConfiguredDiffArgsError,
} from './startup';
export type { LoadedLocalReview, ResolvedDiffArgs } from './startup';
export {
  createReviewSession,
  commitDiffData,
  getDiffLoad,
  submitReviewState,
  takeReviewState,
} from './review-handlers';
export type { ReviewSession } from './review-handlers';
export { publishReview, inspectOutputPath, ReviewPublishError } from './review-publisher';
export type {
  PublishReviewOptions,
  PublishReviewResult,
  ReviewOutputTarget,
} from './review-publisher';
export { bootstrapRemoteDiff } from './remote-mode';
export type { RemoteLifetimeOptions, RemoteBootstrapResult } from './remote-mode';
export { runFetchComments } from './fetch-comments';
export type { FetchCommentsOptions } from './fetch-comments';
export { scanDirectory, scanFile } from './directory-scanner';
export type { SourceScanOptions, SourceScanResult } from './directory-scanner';
export type { DiagnosticReporter } from './diagnostics';
export { prepareDirectoryReview, commitReviewStart } from './review-start';
export {
  setApplyDestination,
  applySuggestionForSession,
  applySuggestionForSessionAsync,
} from './review-suggestions';
export type {
  ApplySuggestionForSessionAsyncOptions,
  ApplySuggestionForSessionOptions,
  SuggestionOperationOptions,
} from './review-suggestions';
export type { PublicationFileSystem } from './publication-fs';
export type { TemporaryCloneStorage } from './materializer';

export { loadGitReviewSnapshot } from './loaded-git-review';
export type { GitSnapshotDependencies } from './loaded-git-review';

export type { LoadedReview } from './loaded-snapshot';
export { loadedReviewIdentity, loadedReviewPaths } from './loaded-snapshot';
export { readLoadedReviewContent } from './snapshot-reader';
export { commitLoadedReview } from './review-session';
export type { LocalReviewDependencies, LocalReviewLoadOptions } from './startup';
export { resolveLocalSourceIdentityAsync } from './source-identity';
export type { LocalSourcePaths } from './source-identity';
export { loadGuide } from './guide-loader';
export type { LoadGuideOptions, BoundedGuideReader } from './guide-loader';
export { loadImage, readAttachment } from './review-content';
export type { LoadImageOptions, ReadAttachmentOptions, AttachmentReader } from './review-content';

export type { ReviewSchemaValidator } from './review-xml-validator';
