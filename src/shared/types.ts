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
}

// ===== Review State Types =====

export interface Suggestion {
  originalCode: string;
  proposedCode: string;
}

export interface LineRange {
  side: 'old' | 'new';
  start: number;
  end: number;
}

export interface ReviewComment {
  id: string;
  filePath: string;
  lineRange: LineRange | null;     // null = file-level comment
  body: string;
  category: string | null;
  suggestion: Suggestion | null;
  orphaned?: boolean;              // for --resume-from conflict handling
}

export interface FileReviewState {
  path: string;
  changeType: ChangeType;
  viewed: boolean;
  comments: ReviewComment[];
}

export interface ReviewState {
  timestamp: string;
  gitDiffArgs: string;
  repository: string;
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
  prismTheme: string;
  fontSize: number;
  outputFormat: string;
  ignore: string[];
  categories: CategoryDef[];
  defaultDiffArgs: string;
}

// ===== IPC Payload Types =====

export interface DiffLoadPayload {
  files: DiffFile[];
  gitDiffArgs: string;
  repository: string;
}

export interface ResumeLoadPayload {
  comments: ReviewComment[];
}

// ===== Electron API (preload bridge) =====

export interface ElectronAPI {
  onDiffLoad: (callback: (payload: DiffLoadPayload) => void) => void;
  onResumeLoad: (callback: (payload: ResumeLoadPayload) => void) => void;
  onConfigLoad: (callback: (payload: AppConfig) => void) => void;
  submitReview: (state: ReviewState) => void;
  onRequestReview: (callback: () => void) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}