// Re-export all types from the canonical source in @self-review/types.
// This file exists for backward compatibility — all src/ code imports from here.
export type {
  ReviewReads,
  DesktopReadRequest,
  DesktopReadResult,
  ContentLoadRefusal,
  ReviewSaveResult,
  ApplicationLocale,
  ChangeType,
  DiffLineType,
  DiffLine,
  DiffHunk,
  DiffFile,
  DiffSource,
  Suggestion,
  Attachment,
  LineRange,
  Reply,
  ReviewComment,
  CommentSeverity,
  CommentConfidence,
  RemoteForge,
  RemoteSessionInfo,
  RemoteDriftInfo,
  ReviewSourceIdentity,
  ReviewSourceMode,
  ReviewSourceSide,
  RemoteOpenUrlResult,
  FileReviewState,
  ReviewState,
  CategoryDef,
  AppConfig,
  DiffLoadPayload,
  ResumeLoadPayload,
  GuideLoadPayload,
  OutputPathInfo,
  ExpandContextRequest,
  ExpandContextResponse,
  FindInPageAction,
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
  SuggestionApplyRequest,
  SuggestionApplyOutcome,
  ApplyDestinationOutcome,
} from '../../packages/types/src/index';

// ===== Electron API (preload bridge) =====
// Electron-specific — not part of @self-review/types.

/** Application metadata shown in the About dialog. */
export interface AppInfo {
  /** App version, from package.json via app.getVersion(). */
  version: string;
  /** App icon as a base64 data URI, or null if it could not be loaded. */
  iconDataUri: string | null;
}

import type {
  DesktopReadRequest,
  DesktopReadResult,
  ContentLoadRefusal,
  ReviewSaveResult,
  ApplicationLocale,
  DiffLoadPayload,
  AppConfig,
  OutputPathInfo,
  ResumeLoadPayload,
  GuideLoadPayload,
  ReviewState,
  ExpandContextRequest,
  ExpandContextResponse,
  FindInPageRequest,
  FindInPageResult,
  VersionUpdateInfo,
  DiffHunk,
  ImageLoadResult,
  RemoteOpenUrlResult,
  SuggestionApplyRequest,
  SuggestionApplyOutcome,
  ApplyDestinationOutcome,
} from '../../packages/types/src/index';

/** Subscriptions have independent, idempotent disposers. Invocations are never replayed.
 * Writes keep their main-process owner until the final result, without a retryable timeout.
 */
export interface ElectronAPI {
  /** Optional correlated reads. No AbortSignal crosses structured clone. */
  readContent?: (request: DesktopReadRequest) => Promise<DesktopReadResult>;
  cancelContentRead?: (requestId: string) => void;
  onContentRefused?: (callback: (failure: ContentLoadRefusal) => void) => () => void;
  requestDiffData: () => void;
  onDiffLoad: (callback: (payload: DiffLoadPayload) => void) => () => void;
  requestConfig: () => void;
  onConfigLoad: (
    callback: (payload: AppConfig, outputPathInfo?: OutputPathInfo) => void
  ) => () => void;
  requestResumeData: () => void;
  onResumeLoad: (callback: (payload: ResumeLoadPayload) => void) => () => void;
  onGuideLoad: (callback: (payload: GuideLoadPayload) => void) => () => void;
  submitReview: (state: ReviewState) => void;
  onCloseRequested: (callback: () => void) => () => void;
  saveAndQuit: () => void;
  /** Optional acknowledged state handoff, never publication. */
  handoffReview?: (state: ReviewState) => Promise<void>;
  /** Publish one snapshot. No close until acknowledgeReviewSave receives its receipt. */
  saveReview?: (state: ReviewState) => Promise<ReviewSaveResult>;
  getSaveResult?: () => Promise<ReviewSaveResult | null>;
  acknowledgeReviewSave?: (receipt: string) => void;
  /** Legacy save failure notification; older peers may omit it. */
  onSaveFailed?: (callback: () => void) => () => void;
  getApplicationLocale?: () => Promise<ApplicationLocale>;
  readAttachment: (filePath: string) => Promise<ArrayBuffer | null>;
  discardAndQuit: () => void;
  pickDirectory: () => Promise<string | null>;
  startDirectoryReview: (path: string) => Promise<void>;
  expandContext: (request: ExpandContextRequest) => Promise<ExpandContextResponse | null>;
  changeOutputPath: () => Promise<OutputPathInfo | null>;
  onOutputPathChanged: (callback: (info: OutputPathInfo) => void) => () => void;
  findInPage: (request: FindInPageRequest) => void;
  stopFindInPage: (action: string) => void;
  onFindResult: (callback: (result: FindInPageResult) => void) => () => void;
  requestVersionUpdate: () => void;
  onVersionUpdate: (callback: (info: VersionUpdateInfo) => void) => () => void;
  onShowAbout: (callback: () => void) => () => void;
  getAppInfo: () => Promise<AppInfo>;
  openExternal: (url: string) => Promise<void>;
  loadFileContent: (filePath: string) => Promise<DiffHunk[] | null>;
  loadImage: (filePath: string) => Promise<ImageLoadResult>;
  openRemoteUrl: (url: string) => Promise<RemoteOpenUrlResult>;
  applySuggestion: (request: SuggestionApplyRequest) => Promise<SuggestionApplyOutcome>;
  chooseApplyDestination: () => Promise<ApplyDestinationOutcome>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
