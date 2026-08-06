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
