import type {
  DiffHunk,
  DiffLoadPayload,
  ResumeLoadPayload,
  ReviewState,
  ExpandContextRequest,
  ExpandContextResponse,
  OutputPathInfo,
  AppConfig,
  ImageLoadResult,
  GuideLoadPayload,
} from '@self-review/types';

/**
 * Platform adapter — consumers implement this to provide
 * data loading and lifecycle hooks. All methods except loadDiff
 * are optional; the library degrades gracefully when absent.
 */
export interface ReviewAdapter {
  /** Load diff data. Called once on mount. */
  loadDiff: () => Promise<DiffLoadPayload>;

  /** Load a previously saved review — comments and viewed files (resume flow). */
  loadResumedReview?: () => Promise<ResumeLoadPayload>;

  /** Submit/save a completed review. */
  submitReview?: (state: ReviewState) => Promise<void> | void;

  /** Expand context lines for a file (git repos only). */
  expandContext?: (request: ExpandContextRequest) => Promise<ExpandContextResponse | null>;

  /** Lazy-load hunks for a single file (large payload mode). */
  loadFileContent?: (filePath: string) => Promise<DiffHunk[] | null>;

  /** Read an attachment file for display. */
  readAttachment?: (filePath: string) => Promise<ArrayBuffer | null>;

  /** Change the output file path (e.g., open save dialog). */
  changeOutputPath?: () => Promise<OutputPathInfo | null>;

  /** Load a binary image as a base64 data URI for rendered preview. */
  loadImage?: (filePath: string) => Promise<ImageLoadResult>;

  /**
   * Subscribe to walkthrough guide payloads. Push-style: the host calls the
   * callback if/when a guide sidecar is discovered; it may never fire.
   * The payload is display-ready (already reconciled against the diff).
   */
  onGuideLoad?: (callback: (payload: GuideLoadPayload) => void) => void;
}

/**
 * Optional configuration adapter for loading config from external sources.
 * If not provided, the component uses defaults or the config prop.
 */
export interface ConfigAdapter {
  /** Load configuration. Called once on mount. */
  loadConfig?: () => Promise<{ config: AppConfig; outputPathInfo?: OutputPathInfo }>;
}
