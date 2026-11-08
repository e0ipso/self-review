// @self-review/core — Browser-safe subset (no Node.js APIs)
// Internal: aliased by the renderer build; everything here must run with no Node globals.

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

// Forge URL parsing (pure JS, no Node.js deps)
export { parseForgeUrl } from './forge-provider';
export type { ForgeUrl, ForgeName } from './forge-provider';

// Ignore filter (uses `ignore` package, browser-safe)
export { createIgnoreFilter } from './ignore-filter';
