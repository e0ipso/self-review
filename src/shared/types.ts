// Re-export all types from the canonical source in @self-review/types.
// This file exists for backward compatibility — all src/ code imports from here.
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
} from '../../packages/types/src/index';

// ===== Electron API (preload bridge) =====
// Electron-specific — not part of @self-review/types.

import type {
  DiffLoadPayload,
  AppConfig,
  OutputPathInfo,
  ResumeLoadPayload,
  ReviewState,
  ExpandContextRequest,
  ExpandContextResponse,
  FindInPageRequest,
  FindInPageResult,
  VersionUpdateInfo,
  DiffHunk,
  ImageLoadResult,
} from '../../packages/types/src/index';

export interface ElectronAPI {
  requestDiffData: () => void;
  onDiffLoad: (callback: (payload: DiffLoadPayload) => void) => void;
  requestConfig: () => void;
  onConfigLoad: (callback: (payload: AppConfig, outputPathInfo?: OutputPathInfo) => void) => void;
  requestResumeData: () => void;
  onResumeLoad: (callback: (payload: ResumeLoadPayload) => void) => void;
  submitReview: (state: ReviewState) => void;
  onRequestReview: (callback: () => void) => void;
  onCloseRequested: (callback: () => void) => () => void;
  saveAndQuit: () => void;
  readAttachment: (filePath: string) => Promise<ArrayBuffer | null>;
  discardAndQuit: () => void;
  pickDirectory: () => Promise<string | null>;
  startDirectoryReview: (path: string) => Promise<void>;
  expandContext: (request: ExpandContextRequest) => Promise<ExpandContextResponse | null>;
  changeOutputPath: () => Promise<OutputPathInfo | null>;
  onOutputPathChanged: (callback: (info: OutputPathInfo) => void) => void;
  findInPage: (request: FindInPageRequest) => void;
  stopFindInPage: (action: string) => void;
  onFindResult: (callback: (result: FindInPageResult) => void) => () => void;
  requestVersionUpdate: () => void;
  onVersionUpdate: (callback: (info: VersionUpdateInfo) => void) => void;
  openExternal: (url: string) => Promise<void>;
  loadFileContent: (filePath: string) => Promise<DiffHunk[]>;
  loadImage: (filePath: string) => Promise<ImageLoadResult>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
