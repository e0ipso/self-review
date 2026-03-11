// @self-review/core — Browser-safe subset (no Node.js APIs)
// This entry point is used by the webpack renderer build.

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

// Diff parsing (pure JS, no Node.js deps)
export { parseDiff } from './diff-parser';

// File type detection utilities (pure JS, no Node.js deps)
export { isPreviewableImage, isPreviewableSvg } from './file-type-utils';

// Ignore filter (uses `ignore` package, browser-safe)
export { createIgnoreFilter } from './ignore-filter';
