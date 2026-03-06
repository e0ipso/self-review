import type {
  DiffHunk,
  DiffLoadPayload,
  ReviewComment,
  ReviewState,
  ExpandContextRequest,
  ExpandContextResponse,
  OutputPathInfo,
  AppConfig,
} from '@self-review/core';

/**
 * Platform adapter — consumers implement this to provide
 * data loading and lifecycle hooks. All methods except loadDiff
 * are optional; the library degrades gracefully when absent.
 */
export interface ReviewAdapter {
  /** Load diff data. Called once on mount. */
  loadDiff: () => Promise<DiffLoadPayload>;

  /** Load previously saved comments (resume flow). */
  loadResumedComments?: () => Promise<ReviewComment[]>;

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
}

/**
 * Optional configuration adapter for loading config from external sources.
 * If not provided, the component uses defaults or the config prop.
 */
export interface ConfigAdapter {
  /** Load configuration. Called once on mount. */
  loadConfig?: () => Promise<{ config: AppConfig; outputPathInfo?: OutputPathInfo }>;
}
