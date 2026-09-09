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
  SuggestionApplyRequest,
  SuggestionApplyOutcome,
  ApplyDestinationOutcome,
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
   * Write a suggestion's proposed code into the reviewed working file.
   * Optional, and the only adapter method that writes anything: a host with
   * no destination it may write to simply omits it, and the UI then offers
   * no Apply control at all. The host resolves the destination directory,
   * because the UI knows only the review-relative path.
   *
   * Never throws for a refusal. A refused attempt resolves with
   * `status: 'refused'` and a reason, and leaves the file untouched.
   */
  applySuggestion?: (request: SuggestionApplyRequest) => Promise<SuggestionApplyOutcome>;

  /**
   * Ask the user to name the directory applies write into, and record it for
   * the rest of the session. Optional, and only ever needed by a review whose
   * files sit in a temporary clone the host deletes on exit.
   *
   * The host owns both the picker and the answer: the UI learns which
   * directory was chosen but never proposes one, so nothing the renderer
   * says can widen where the host writes.
   */
  chooseApplyDestination?: () => Promise<ApplyDestinationOutcome>;

  /**
   * Subscribe to walkthrough guide payloads. Push-style: the host calls the
   * callback if/when a guide sidecar is discovered; it may never fire.
   * The payload is display-ready (already reconciled against the diff).
   * Returns an unsubscribe function — required, because the subscribing
   * effect re-runs whenever the adapter identity changes.
   */
  onGuideLoad?: (callback: (payload: GuideLoadPayload) => void) => () => void;

  /**
   * Subscribe to diff payloads pushed after the initial load — the host may
   * replace the session wholesale (e.g. a remote PR/MR opened from the
   * welcome screen). `loadDiff` covers only the initial request/response;
   * this covers every later push. Returns an unsubscribe function.
   */
  onDiffLoad?: (callback: (payload: DiffLoadPayload) => void) => () => void;
}

/**
 * Optional configuration adapter for loading config from external sources.
 * If not provided, the component uses defaults or the config prop.
 */
export interface ConfigAdapter {
  /** Load configuration. Called once on mount. */
  loadConfig?: () => Promise<{ config: AppConfig; outputPathInfo?: OutputPathInfo }>;
}
