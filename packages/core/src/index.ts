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
} from './types';

// Diff parsing
export { parseDiff } from './diff-parser';

// XML I/O
export { serializeReview } from './xml-serializer';
export { parseReviewXml, parseReviewXmlString } from './xml-parser';

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

