// Session-owned state and synchronous payload projections. No filesystem dependencies.
import type {
  DiffLoadPayload,
  DiffFile,
  DiffHunk,
  ResumeLoadPayload,
  GuideLoadPayload,
  AppConfig,
  OutputPathInfo,
  ReviewState,
  ReviewComment,
  ReviewSourceIdentity,
  RemoteDriftInfo,
} from './types';
import { loadedReviewIdentity, type LoadedReview } from './loaded-snapshot';
import type { AttachmentOrigins } from './attachment-origins';
import { stderrReporter, type DiagnosticReporter } from './diagnostics';
import { isolatedReporter } from './effect-diagnostics';
import { validateReviewState } from './review-state-validation';

/**
 * The state a single review session owns. One desktop application window is
 * one session; two sessions are independent and cannot observe each other.
 */
export interface ReviewSession {
  reviewState: ReviewState | null;
  diffData: DiffLoadPayload | null;
  guideData: GuideLoadPayload | null;
  config: AppConfig | null;
  outputPathInfo: OutputPathInfo | null;
  resumeComments: ReviewComment[];
  resumeViewedFiles: string[];
  resumeRemoteDrift: RemoteDriftInfo | null;
  resumeImportDiagnostics: string[];
  /**
   * Destination directory the user named for this session's applies, or
   * null when none has been named. Only a temporary-clone remote review
   * needs one; see {@link resolveApplyDestination}.
   */
  applyDestinationRoot: string | null;
  /**
   * Old and new path of every file in the committed diff, frozen by {@link commitDiffData}.
   * The authorization set for writes; resumed comments, submitted state and placeholder
   * entries can name other paths and never reach it.
   */
  reviewedPaths: ReadonlySet<string>;
  /**
   * Recorded by {@link commitDiffData}; null until then (and for welcome), when every read of
   * reviewed content refuses.
   */
  sourceIdentity: ReviewSourceIdentity | null;
  /** Host-local captured load, optional for legacy session objects. Never transport this value. */
  loadedReview?: LoadedReview | null;
  /**
   * Resumed reference to absolute path beside *the resumed document*; authorizes reads and tells
   * the publisher which bytes to carry. Never sent to the front end.
   */
  attachmentOrigins: AttachmentOrigins;
}

/** Create an empty session. */
export function createReviewSession(): ReviewSession {
  return {
    reviewState: null,
    diffData: null,
    guideData: null,
    config: null,
    outputPathInfo: null,
    resumeComments: [],
    resumeViewedFiles: [],
    resumeRemoteDrift: null,
    resumeImportDiagnostics: [],
    applyDestinationRoot: null,
    reviewedPaths: emptyReviewedPaths(),
    sourceIdentity: null,
    attachmentOrigins: new Map(),
  };
}

function emptyReviewedPaths(): ReadonlySet<string> {
  return freezeSet(new Set<string>());
}

function freezeSet(set: Set<string>): ReadonlySet<string> {
  const frozen = () => {
    throw new TypeError('reviewedPaths is captured when the diff is committed and cannot change');
  };
  Object.defineProperties(set, {
    add: { value: frozen },
    delete: { value: frozen },
    clear: { value: frozen },
  });
  return Object.freeze(set);
}

function reviewedPathsOf(files: readonly DiffFile[]): ReadonlySet<string> {
  const paths = new Set<string>();
  for (const file of files) {
    if (file.newPath) paths.add(file.newPath);
    if (file.oldPath) paths.add(file.oldPath);
  }
  return freezeSet(paths);
}

/**
 * The one place a diff is committed to a session: captures `reviewedPaths` and
 * records `sourceIdentity`; later `diffData` edits (expanded hunks) leave both alone.
 * The identity comes from the loader, and is `null` only for a payload that
 * reviews nothing (welcome), so reads refuse rather than guess a root.
 */
export function commitDiffData(
  session: Pick<ReviewSession, 'diffData' | 'reviewedPaths' | 'sourceIdentity'>,
  payload: DiffLoadPayload,
  identity: ReviewSourceIdentity | null
): void {
  if ('loadedReview' in session)
    (session as { loadedReview?: LoadedReview | null }).loadedReview = null;
  session.diffData = payload;
  session.reviewedPaths = reviewedPathsOf(payload.files);
  session.sourceIdentity = identity;
}

/** Commit explicit load evidence while preserving the original payload and identity aliases. */
export function commitLoadedReview(
  session: Pick<ReviewSession, 'diffData' | 'reviewedPaths' | 'sourceIdentity' | 'loadedReview'>,
  payload: DiffLoadPayload,
  loadedReview: LoadedReview
): void {
  const identity = loadedReviewIdentity(loadedReview);
  commitDiffData(session, payload, identity);
  session.loadedReview = loadedReview;
}

/**
 * The old side is where a deletion or a rename's old name lives. Null when the diff has no such
 * file.
 */
export function locateReviewedFile(
  session: Pick<ReviewSession, 'diffData'>,
  filePath: string
): { file: DiffFile; side: 'old' | 'new' } | null {
  const files = session.diffData?.files ?? [];
  const byNewPath = files.find(f => f.newPath !== '' && f.newPath === filePath);
  if (byNewPath) return { file: byNewPath, side: 'new' };
  const byOldPath = files.find(f => f.oldPath !== '' && f.oldPath === filePath);
  if (byOldPath) return { file: byOldPath, side: 'old' };
  return null;
}

/**
 * Prepare a DiffLoadPayload for IPC transmission.
 * In large-payload mode, strips hunks from files to reduce initial transfer size.
 * The full data stays in the session for on-demand loading via DIFF_LOAD_FILE.
 */
export function preparePayload(payload: DiffLoadPayload): DiffLoadPayload {
  if (payload.isLargePayload) {
    return {
      ...payload,
      files: payload.files.map(f => ({ ...f, hunks: [] as DiffHunk[], contentLoaded: false })),
    };
  }
  return {
    ...payload,
    files: payload.files.map(f => ({ ...f, contentLoaded: true })),
  };
}

/**
 * Resolve what a diff request should deliver: the prepared diff payload and,
 * when one is loaded, the guide that rides with it. Returns null when the
 * session has no diff, so the caller sends nothing at all.
 */
export function getDiffLoad(
  session: Pick<ReviewSession, 'diffData' | 'guideData'>
): { diff: DiffLoadPayload; guide: GuideLoadPayload | null } | null {
  if (!session.diffData) {
    return null;
  }
  // The guide rides after the diff payload in both normal and
  // large-payload modes — it is metadata-only (paths, names,
  // descriptions) and never triggers eager hunk loading.
  return {
    diff: preparePayload(session.diffData),
    guide: session.guideData,
  };
}

/** The read-only source root; {@link resolveApplyDestination} decides where applies write. */
export function resolveSourceBaseDir(
  session: Pick<ReviewSession, 'sourceIdentity'>
): string | null {
  return session.sourceIdentity?.sourceRoot ?? null;
}

/**
 * Return a single file's hunks for lazy (large-payload) mode, or null when the
 * session has no diff or the diff has no such file.
 */
export function getFileHunks(
  session: Pick<ReviewSession, 'diffData'>,
  filePath: string
): DiffHunk[] | null {
  if (!session.diffData) return null;
  const file = session.diffData.files.find(f => (f.newPath || f.oldPath) === filePath);
  if (!file) return null;
  return file.hunks;
}

/**
 * Resolve the config and the output path info that travel with it. Returns null
 * when the session has no config, so the caller sends nothing at all: the
 * renderer distinguishes an absent message from an empty one.
 */
export function getConfigLoad(
  session: Pick<ReviewSession, 'config' | 'outputPathInfo'>
): { config: AppConfig; outputPathInfo: OutputPathInfo | null } | null {
  if (!session.config) {
    return null;
  }
  return { config: session.config, outputPathInfo: session.outputPathInfo };
}

/**
 * Store a review state submitted by the front end on the session.
 */
export function submitReviewState(
  session: Pick<ReviewSession, 'reviewState'>,
  state: ReviewState,
  reportDiagnostic: DiagnosticReporter = stderrReporter
): void {
  state = validateReviewState(state);
  isolatedReporter(reportDiagnostic)(
    '[review] Review state submitted:',
    JSON.stringify({
      timestamp: state.timestamp,
      source: state.source,
      fileCount: state.files.length,
    })
  );
  session.reviewState = state;
}

/**
 * Take the submitted review state off the session, clearing it so it is
 * consumed exactly once. Returns null when nothing has been submitted.
 */
export function takeReviewState(session: Pick<ReviewSession, 'reviewState'>): ReviewState | null {
  const state = session.reviewState;
  session.reviewState = null;
  return state;
}

/**
 * Resolve the resumed comments, viewed files and remote drift for a session.
 * Returns null when there is nothing to resume, so the caller sends nothing
 * at all.
 */
export function getResumeLoad(
  session: Pick<
    ReviewSession,
    'resumeComments' | 'resumeViewedFiles' | 'resumeRemoteDrift' | 'resumeImportDiagnostics'
  >
): ResumeLoadPayload | null {
  if (
    session.resumeComments.length > 0 ||
    session.resumeViewedFiles.length > 0 ||
    session.resumeRemoteDrift !== null ||
    session.resumeImportDiagnostics.length > 0
  ) {
    const payload: ResumeLoadPayload = {
      comments: session.resumeComments,
      viewedFiles: session.resumeViewedFiles,
    };
    if (session.resumeRemoteDrift !== null) {
      payload.remoteDrift = session.resumeRemoteDrift;
    }
    if (session.resumeImportDiagnostics.length > 0) {
      payload.importDiagnostics = session.resumeImportDiagnostics;
    }
    return payload;
  }
  return null;
}
