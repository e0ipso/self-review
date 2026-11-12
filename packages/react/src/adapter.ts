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
  /** Optional cancellable reads. Omitted members fall back to their legacy counterparts. */
  reads?: import('@self-review/types').ReviewReads;
  /** Load diff data. Called once on mount. */
  loadDiff: () => Promise<DiffLoadPayload>;

  /** Load the initial session's saved comments and viewed files. Capture waits for this
   * acknowledgement, including an empty result. Rejections stay visible until manual retry.
   * Later sessions pushed through onDiffLoad use onResumeLoad, so an old cached initial
   * response is never treated as their feedback. Hosts must bound this read's lifetime.
   */
  loadResumedReview?: () => Promise<ResumeLoadPayload>;

  /**
   * Later resume pushes, delivered after their owning diff push. A new push supersedes any
   * pending loadResumedReview response. A replacement diff push reserves resume readiness
   * until its acknowledgement arrives, even when there are no comments. Old adapters can
   * omit this subscription; their later diff pushes have no associated resume hydration.
   */
  onResumeLoad?: (callback: (payload: ResumeLoadPayload) => void) => () => void;

  /** Legacy host-specific completion: desktop hands off state; HTTP publishes it.
   * Its void/promise return keeps the host's original meaning and supplies no additional receipt.
   * Prefer handoffReview/publishReview when completion matters; pair publication with beginSave.
   */
  submitReview?: (state: ReviewState) => Promise<void> | void;

  /** Accept state in the host's session, without promising disk publication. */
  handoffReview?: (state: ReviewState) => Promise<void> | void;

  /** Resolve only after publication is acknowledged. Rejection may have uncertain:true;
   * a missing acknowledgement never proves that a write was rolled back. Never replay automatically.
   */
  publishReview?: (state: ReviewState) => Promise<void>;

  /** Expand context lines for a file (git repos only). */
  expandContext?: (request: ExpandContextRequest) => Promise<ExpandContextResponse | null>;

  /** Lazy-load hunks for a single file (large payload mode). */
  loadFileContent?: (filePath: string) => Promise<DiffHunk[] | null>;

  /** Optional native clipboard capability. Reject on failure so the UI can report it. */
  writeClipboard?: (text: string) => Promise<void>;

  /** Read attachment bytes. Null means missing content; transport/access failures reject. */
  readAttachment?: (filePath: string) => Promise<ArrayBuffer | null>;

  /** Change the output file path (e.g., open save dialog). */
  changeOutputPath?: () => Promise<OutputPathInfo | null>;

  /** Load a binary image as a base64 data URI for rendered preview. */
  loadImage?: (filePath: string) => Promise<ImageLoadResult>;

  /**
   * Write a suggestion's proposed code into the reviewed working file.
   * Optional, and the only adapter method that changes reviewed source: a host with
   * no destination it may write to simply omits it, and the UI then offers
   * no Apply control at all. The host resolves the destination directory,
   * because the UI knows only the review-relative path.
   *
   * Malformed DTO shapes may reject at the transport boundary. Structurally valid requests,
   * including null, zero, reversed or out-of-range numeric anchors, reach the engine.
   * Transport failures reject. Only explicit uncertain:false guarantees no commit.
   * Otherwise callers must retain an unknown outcome and require destination inspection before retry.
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
 * @deprecated No component consumes this interface. Load configuration in the host and pass
 * it through ReviewPanel.config, ReviewProviders.config or ConfigProvider.initialConfig.
 * Kept for source compatibility with existing consumers.
 */
export interface ConfigAdapter {
  /** Load configuration. Called once on mount. */
  loadConfig?: () => Promise<{ config: AppConfig; outputPathInfo?: OutputPathInfo }>;
}

/** Optional rejection metadata shared by host adapters. `false` is a positive guarantee that
 * the command did not commit; absence, `true`, timeouts and disconnects imply no such guarantee.
 */
export interface ReviewOperationError extends Error {
  readonly uncertain?: boolean;
}
