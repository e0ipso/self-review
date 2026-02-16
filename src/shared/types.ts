// src/shared/types.ts
// Shared type definitions — THE CONTRACT between main and renderer.
// All agents import from here. Do not duplicate these types.

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
}

// ===== Diff Source Types =====

export type DiffSource =
  | { type: 'git'; gitDiffArgs: string; repository: string }
  | { type: 'directory'; sourcePath: string }
  | { type: 'welcome' };

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
}

// ===== IPC Payload Types =====

export interface DiffLoadPayload {
  files: DiffFile[];
  source: DiffSource;
}

export interface ResumeLoadPayload {
  comments: ReviewComment[];
}

// ===== Electron API (preload bridge) =====

export interface ElectronAPI {
  requestDiffData: () => void;
  onDiffLoad: (callback: (payload: DiffLoadPayload) => void) => void;
  requestConfig: () => void;
  onConfigLoad: (callback: (payload: AppConfig) => void) => void;
  requestResumeData: () => void;
  onResumeLoad: (callback: (payload: ResumeLoadPayload) => void) => void;
  submitReview: (state: ReviewState) => void;
  onRequestReview: (callback: () => void) => void;
  onCloseRequested: (callback: () => void) => void;
  saveAndQuit: () => void;
  readAttachment: (filePath: string) => Promise<ArrayBuffer | null>;
  discardAndQuit: () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
