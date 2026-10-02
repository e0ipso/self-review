// @self-review/core — Node.js API for diff parsing, git operations, XML serialization, and configuration

// Types
export type {
  ChangeType,
  DiffLineType,
  DiffLine,
  DiffHunk,
  DiffFile,
  DiffSource,
  Suggestion,
  SuggestionApplyRequest,
  SuggestionApplyOutcome,
  ApplyDestinationOutcome,
  Attachment,
  LineRange,
  ReviewComment,
  CommentSeverity,
  CommentConfidence,
  FileReviewState,
  ReviewState,
  CategoryDef,
  AppConfig,
  DiffLoadPayload,
  ResumeLoadPayload,
  OutputPathInfo,
  ExpandContextRequest,
  ExpandContextResponse,
  FindInPageRequest,
  FindInPageResult,
  VersionUpdateInfo,
  PayloadStats,
  ImageLoadResult,
  ReviewSourceIdentity,
  ReviewSourceMode,
  ReviewSourceSide,
  ReviewGuide,
  GuideGroup,
  GuideFileEntry,
  ResolvedGuideGroup,
  ResolvedGuideFile,
} from './types';

// Diff parsing
export { parseDiff, parseDiffWithDiagnostics } from './diff-parser';
export type { DiffParseResult } from './diff-parser';

// XML I/O
export { serializeReview, ASSET_DIR_NAME } from './xml-serializer';
export type {
  SerializedReview,
  SerializeOptions,
  PlannedAsset,
  AssetNamer,
} from './xml-serializer';
export { parseReviewXml, parseReviewXmlString } from './xml-parser';
export type { ParsedReview } from './xml-parser';
export { ReviewXmlError, XmlIllegalCharacterError } from './xml-errors';
export type { ReviewXmlErrorCode, XmlIllegalCharacterLocation } from './xml-errors';

// Review output publication (the one way review XML and attachments reach disk)
export { publishReview, inspectOutputPath, ReviewPublishError } from './review-publisher';
export type {
  ReviewPublishErrorCode,
  ReviewOutputOrigin,
  ReviewOutputTarget,
  PublishReviewOptions,
  PublishReviewResult,
} from './review-publisher';

// Attachment provenance: where resumed attachment bytes live, which
// references may be read, and how they follow a relocated output
export {
  parseAttachmentReference,
  resolveAttachmentOrigins,
  authorizeAttachmentReference,
  readAssetFile,
  relocateAttachments,
  AttachmentRelocationError,
} from './attachment-origins';
export type {
  AttachmentOrigins,
  AttachmentReadResult,
  AttachmentReadFailureReason,
} from './attachment-origins';

// No-follow filesystem primitives shared by every core writer
export {
  SafeFsError,
  nodeFsLayer,
  assertNoSymlinkAncestors,
  openNoFollow,
  writeExclusiveNoFollow,
  atomicReplace,
  inspectReplaceTarget,
  snapshotIdentity,
  sameFile,
  classifyFsError,
} from './safe-fs';
export type {
  SafeFsErrorCode,
  FsLayer,
  FileIdentity,
  WriteExclusiveOptions,
  AtomicReplaceOptions,
  AtomicReplaceResult,
} from './safe-fs';

// Line-anchor validation (shared by the resume importer and Apply)
export { validateLineAnchor, validateLineRange } from './anchor-validation';
export type { AnchorCheck, AnchorFields, AnchorSide, LineAnchor } from './anchor-validation';

// Walkthrough guide schema
export { GUIDE_XSD_SCHEMA } from './guide-schema';

// Walkthrough guide parsing and reconciliation
export { parseGuideXml, reconcileGuide, IMPLICIT_GUIDE_GROUP_NAME } from './guide-parser';
export type { GuideParseResult } from './guide-parser';

// Git operations
export {
  runGitDiffAsync,
  getRepoRootAsync,
  getUntrackedFilesAsync,
  generateUntrackedDiffs,
  withParserCompatibleDiffArgs,
  PARSER_COMPATIBLE_GIT_CONFIG,
  PARSER_COMPATIBLE_DIFF_FLAGS,
} from './git';

// Forge providers (remote PR/MR conversation plane)
export { parseForgeUrl, ForgeCliUnavailableError } from './forge-provider';
export type {
  ForgeName,
  ForgeUrl,
  ForgeAnchorSide,
  ForgeThreadAnchor,
  ForgeThreadTurn,
  ForgeThread,
  FetchThreadsOptions,
  ForgeCommandResult,
  ForgeCommandRunner,
  ForgeProvider,
} from './forge-provider';

// Synthetic diffs (for non-git files/directories)
export { generateSyntheticDiffs, loadSyntheticFiles } from './synthetic-diff';
export type { SyntheticDiffOptions, SyntheticDiffResult } from './synthetic-diff';

// Directory/file scanning
export { scanDirectory, scanFile } from './directory-scanner';
export type { SourceScanOptions, SourceScanResult } from './directory-scanner';

// Input safety budgets (checked before reading; distinct from the
// max-files/max-total-lines transport thresholds)
export {
  MAX_SOURCE_ENTRIES,
  BINARY_SNIFF_BYTES,
  MAX_SOURCE_FILE_BYTES,
  MAX_SOURCE_TOTAL_BYTES,
  MAX_GIT_DIFF_OUTPUT_BYTES,
  MAX_GUIDE_BYTES,
  MAX_RESUME_XML_BYTES,
  MAX_RESUME_ATTACHMENTS,
  MAX_IMAGE_BYTES,
  DEFAULT_SOURCE_BUDGETS,
  resolveSourceBudgets,
  formatBytes,
} from './input-budgets';
export type { SourceBudgets } from './input-budgets';
export { readFileWithinBudget, readFileWithinBudgetSync } from './bounded-read';
export type { BoundedReadOptions, BoundedReadResult } from './bounded-read';

// Source identity (what a session reviews) and snapshot reads of reviewed
// content: the one path authorization and the one content resolver every
// front end delegates to
export {
  describeGitDiffSides,
  resolveGitSourceIdentity,
  resolveLocalSourceIdentity,
  resolveReviewedPathPrefix,
  rootRelativeReviewedPath,
  canonicalSourcePath,
} from './source-identity';
export type {
  GitDiffSideSpec,
  GitDiffSides,
  GitSourceIdentityOptions,
  LocalSourceIdentityOptions,
} from './source-identity';
export { authorizeReviewedPath, readReviewedContent } from './snapshot-reader';
export type {
  ReviewedSnapshot,
  ReviewedPathRefusal,
  ReviewedPathAuthorization,
  SnapshotReadFailure,
  SnapshotReadResult,
  SnapshotReadOptions,
} from './snapshot-reader';

// Configuration, with the origin of every value (user file, project file, default)
export { loadConfig, loadConfigWithProvenance } from './config';
export type {
  ConfigValueOrigin,
  ConfigProvenance,
  ConfigSource,
  LoadedConfig,
  LoadConfigOptions,
} from './config';

// Payload sizing
export { computePayloadStats, countTotalLines, getGitDiffStats } from './payload-sizing';

// Ignore filter
export { createIgnoreFilter } from './ignore-filter';

// File system utilities
export { checkWritability } from './fs-utils';

// Anchored suggestion application (writes a reviewed working file)
export { applySuggestion, isRepositoryControlPath } from './apply-suggestion';
export type {
  ApplyRefusalReason,
  ApplySuggestionOptions,
  ApplySuggestionRequest,
  ApplySuggestionApplied,
  ApplySuggestionRefused,
  ApplySuggestionResult,
} from './apply-suggestion';

// File type detection utilities
export {
  getLanguageFromPath,
  getRenderedTextMode,
  isHtmlFile,
  isMarkdownFile,
  isPreviewableImage,
  isPreviewableRenderedText,
  isPreviewableSvg,
} from './file-type-utils';
export type { RenderedTextMode } from './file-type-utils';

// GitHub forge provider (gh CLI backed)
export { createGitHubProvider } from './github-provider';

// Forge thread → ReviewComment mapper (remote PR/MR fetch direction)
export { mapThreadsToReviewComments, REVIEW_LEVEL_FILE_PATH } from './thread-mapper';

// GitLab forge provider (glab CLI backed)
export { createGitLabProvider } from './gitlab-provider';

// Clone-aware diff materializer (remote PR/MR git plane)
export {
  detectExistingClone,
  materialize,
  resolveRemoteDefaultBranch,
  defaultGitRunner,
} from './materializer';
export type { ExistingClone, MaterializeMode, MaterializeResult } from './materializer';

// Review session orchestration (transport agnostic; each handler takes the
// session it acts on and reads no module-scope state)
export {
  createReviewSession,
  preparePayload,
  getDiffLoad,
  loadImage,
  getFileHunks,
  getConfigLoad,
  submitReviewState,
  takeReviewState,
  readAttachment,
  recordResumedAttachments,
  getResumeLoad,
  expandContext,
  prepareDirectoryReview,
  commitReviewStart,
  commitDiffData,
  locateReviewedFile,
  resolveSourceBaseDir,
  resolveApplyDestination,
  applySuggestionForSession,
} from './review-handlers';
export type { ReviewSession, ReviewStartResult } from './review-handlers';

// Startup mode detection (git, directory, file, welcome)
export { determineMode, resolveStartupSource } from './startup-mode';
export type { StartupSource } from './startup-mode';

// The startup steps both front ends share: output target and its trust,
// diff arguments with configuration provenance, local review loading,
// resume into a session
export {
  resolveOutputTarget,
  publishOptionsFor,
  resolveStartupDiffArgs,
  loadLocalReview,
  loadResumeDocument,
  ConfiguredDiffArgsError,
} from './startup';
export type { ResolvedDiffArgs, LoadedLocalReview } from './startup';

// Application flag extraction shared by both command lines
export { extractApplicationOptions, ApplicationOptionError } from './cli-options';
export type { ApplicationOptionsSpec, ExtractedApplicationOptions } from './cli-options';

// Walkthrough guide sidecar discovery and tolerant loading
export { deriveGuidePath, resolveGuidePath, loadGuide } from './guide-loader';

// Git diff loading, staged/untracked defaulting, and argument normalisation
export { loadGitDiffWithUntracked, dedupeUntrackedByPath } from './git-diff-loader';
export type { LoadGitDiffOptions, LoadGitDiffResult } from './git-diff-loader';
export { applyStagedUntrackedDefault } from './staged-untracked';
export {
  normalizeGitDiffArgs,
  tokenizeGitDiffArgs,
  formatGitDiffArgs,
  classifyGitDiffArgs,
  findUnsupportedGitDiffOptions,
  findWriteCapableGitDiffOptions,
  describeDiffPathRelativity,
  consumesNextArgument,
} from './git-diff-args';
export type { DiffPathRelativity } from './git-diff-args';

// Remote PR/MR session bootstrap (URL -> materialized git-mode inputs) and the
// load/filter/map step the app and fetch-comments share
export {
  startRemoteSession,
  loadRemoteReview,
  bootstrapRemoteDiff,
  mergeRemoteThreads,
  applyRemoteProvenance,
  computeRemoteDrift,
  defaultRemoteSessionDeps,
} from './remote-mode';
export type {
  MaterializedRemoteSession,
  RemoteSession,
  RemoteSessionDeps,
  StartRemoteSessionOptions,
  RemoteReviewLoad,
  RemoteBootstrapResult,
} from './remote-mode';

// Headless fetch-comments orchestrator
export { buildRemoteReviewState, runFetchComments } from './fetch-comments';
export type {
  FetchCommentsDeps,
  BuildRemoteReviewStateArgs,
  FetchCommentsOptions,
} from './fetch-comments';
