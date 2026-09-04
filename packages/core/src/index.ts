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
  ReviewGuide,
  GuideGroup,
  GuideFileEntry,
  ResolvedGuideGroup,
  ResolvedGuideFile,
} from './types';

// Diff parsing
export { parseDiff } from './diff-parser';

// XML I/O
export { serializeReview } from './xml-serializer';
export { parseReviewXml, parseReviewXmlString } from './xml-parser';

// Walkthrough guide schema
export { GUIDE_XSD_SCHEMA } from './guide-schema';

// Walkthrough guide parsing and reconciliation
export {
  parseGuideXml,
  reconcileGuide,
  IMPLICIT_GUIDE_GROUP_NAME,
} from './guide-parser';
export type { GuideParseResult } from './guide-parser';

// Git operations
export {
  runGitDiff,
  runGitDiffAsync,
  getRepoRoot,
  getRepoRootAsync,
  getUntrackedFilesAsync,
  validateGitAvailable,
  generateUntrackedDiffs,
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
export { generateSyntheticDiffs } from './synthetic-diff';

// Directory/file scanning
export { scanDirectory, scanFile } from './directory-scanner';

// Configuration
export { loadConfig } from './config';

// Payload sizing
export { computePayloadStats, countTotalLines, getGitDiffStats } from './payload-sizing';

// Ignore filter
export { createIgnoreFilter } from './ignore-filter';

// File system utilities
export { checkWritability } from './fs-utils';

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
export {
  mapThreadsToReviewComments,
  REVIEW_LEVEL_FILE_PATH,
} from './thread-mapper';

// GitLab forge provider (glab CLI backed)
export { createGitLabProvider } from './gitlab-provider';

// Clone-aware diff materializer (remote PR/MR git plane)
export {
  detectExistingClone,
  materialize,
  resolveRemoteDefaultBranch,
  defaultGitRunner,
} from './materializer';
export type {
  ExistingClone,
  MaterializeMode,
  MaterializeResult,
} from './materializer';

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
  getResumeLoad,
  expandContext,
  prepareDirectoryReview,
  commitReviewStart,
} from './review-handlers';
export type { ReviewSession, ReviewStartResult } from './review-handlers';

// Startup mode detection (git, directory, file, welcome)
export { determineMode } from './startup-mode';

// Walkthrough guide sidecar discovery and tolerant loading
export { deriveGuidePath, resolveGuidePath, loadGuide } from './guide-loader';

// Git diff loading, staged/untracked defaulting, and argument normalisation
export { loadGitDiffWithUntracked } from './git-diff-loader';
export type { LoadGitDiffOptions } from './git-diff-loader';
export { applyStagedUntrackedDefault } from './staged-untracked';
export { normalizeGitDiffArgs } from './git-diff-args';

// Remote PR/MR session bootstrap (URL -> materialized git-mode inputs)
export {
  startRemoteSession,
  bootstrapRemoteDiff,
  mergeRemoteThreads,
  applyRemoteProvenance,
  computeRemoteDrift,
} from './remote-mode';
export type {
  RemoteSession,
  RemoteSessionDeps,
  RemoteBootstrapResult,
} from './remote-mode';
