// @self-review/core — Browser-safe subset (no Node.js APIs)
//
// Internal: not a package export. The webpack renderer build and the webapp
// e2e harness alias `@self-review/core` to this file so browser code can use
// the handful of pure modules below without the Node-only rest of the package.
// Everything re-exported here must run with no Node globals at all — the diff
// parser decodes git's octal-escaped paths with `TextDecoder`, not `Buffer`,
// and its suite pins that with `Buffer` removed.

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

// Diff parsing (pure JS, no Node.js deps — see the header)
export { parseDiff } from './diff-parser';

// Forge URL parsing (pure JS, no Node.js deps)
export { parseForgeUrl } from './forge-provider';
export type { ForgeUrl, ForgeName } from './forge-provider';

// Ignore filter (uses `ignore` package, browser-safe)
export { createIgnoreFilter } from './ignore-filter';
