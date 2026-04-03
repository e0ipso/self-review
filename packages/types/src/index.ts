// @self-review/types — Shared TypeScript type definitions.
// Zero runtime dependencies. Used by @self-review/core, @self-review/react,
// and the Electron app's src/shared/types.ts.

// ===== Git Diff Types =====

export type ChangeType = 'added' | 'modified' | 'deleted' | 'renamed';

export type DiffLineType = 'context' | 'addition' | 'deletion';

export interface DiffLine {
  type: DiffLineType;
  oldLineNumber: number | null;
  newLineNumber: number | null;
  content: string;
}

export interface DiffHunk {
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffFile {
  oldPath: string;
  newPath: string;
  changeType: ChangeType;
  isBinary: boolean;
  hunks: DiffHunk[];
  isUntracked?: boolean;
  contentLoaded?: boolean;
}

// ===== Diff Source Types =====

export type DiffSource =
  | { type: 'git'; gitDiffArgs: string; repository: string }
  | { type: 'directory'; sourcePath: string }
  | { type: 'file'; sourcePath: string }
  | { type: 'welcome' }
  | { type: 'loading' };

// ===== Review State Types =====

export interface Suggestion {
  originalCode: string;
  proposedCode: string;
}

export interface Attachment {
  id: string;
  fileName: string;
  mediaType: string;
  data?: ArrayBuffer; // Present in-memory during session, stripped before XML serialization
}

export interface LineRange {
  side: 'old' | 'new';
  start: number;
  end: number;
}

export interface ReviewComment {
  id: string;
  filePath: string;
  lineRange: LineRange | null; // null = file-level comment
  body: string;
  category: string;
  suggestion: Suggestion | null;
  author?: string;
  orphaned?: boolean; // for --resume-from conflict handling
  attachments?: Attachment[];
}

export interface FileReviewState {
  path: string;
  changeType: ChangeType;
  viewed: boolean;
  comments: ReviewComment[];
}

export interface ReviewState {
  timestamp: string;
  source: DiffSource;
  files: FileReviewState[];
}

// ===== Configuration Types =====

export interface CategoryDef {
  name: string;
  description: string;
  color: string;
}

export interface AppConfig {
  theme: 'light' | 'dark' | 'system';
  diffView: 'split' | 'unified';
  fontSize: number;
  outputFormat: string;
  outputFile: string;
  ignore: string[];
  categories: CategoryDef[];
  defaultDiffArgs: string;
  showUntracked: boolean;
  wordWrap: boolean;
  maxFiles: number;
  maxTotalLines: number;
}

// ===== IPC Payload Types =====

export interface DiffLoadPayload {
  files: DiffFile[];
  source: DiffSource;
  isLargePayload?: boolean;
}

export interface ResumeLoadPayload {
  comments: ReviewComment[];
}

// ===== Output Path Types =====

export interface OutputPathInfo {
  resolvedOutputPath: string;
  outputPathWritable: boolean;
}

// ===== Expand Context Types =====

export interface ExpandContextRequest {
  filePath: string;
  contextLines: number;
}

export interface ExpandContextResponse {
  hunks: DiffHunk[];
  totalLines: number;
}

// ===== Find in Page Types =====

export interface FindInPageRequest {
  text: string;
  forward: boolean;
  findNext: boolean;
}

export interface FindInPageResult {
  activeMatchOrdinal: number;
  matches: number;
  finalUpdate: boolean;
}

// ===== Version Update Types =====

export interface VersionUpdateInfo {
  latestVersion: string;
  releaseUrl: string;
}

// ===== Image Preview Types =====

export type ImageLoadResult = { dataUri: string } | { error: string };

// ===== Payload Guard Types =====

export interface PayloadStats {
  fileCount: number;
  totalLines: number;
  exceedsFiles: boolean;
  exceedsLines: boolean;
  exceedsAny: boolean;
}
