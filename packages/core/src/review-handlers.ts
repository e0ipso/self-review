// packages/core/src/review-handlers.ts
// Transport-agnostic review handler bodies.
//
// Every function here takes the session it operates on as a parameter and
// returns a value. Nothing in this module reaches state that is not reachable
// through that parameter, and nothing in it touches Electron: the registration
// layer (src/main/ipc-handlers.ts) owns the transport and does the sending.

import * as fs from 'fs';
import path from 'path';
import {
  DiffLoadPayload,
  DiffFile,
  DiffHunk,
  ResumeLoadPayload,
  GuideLoadPayload,
  AppConfig,
  OutputPathInfo,
  PayloadStats,
  ReviewState,
  ReviewComment,
  ReviewSourceIdentity,
  ExpandContextRequest,
  ImageLoadResult,
  RemoteDriftInfo,
  SuggestionApplyRequest,
  SuggestionApplyOutcome,
  ApplyDestinationOutcome,
} from './types';
import { scanDirectory, scanFile } from './directory-scanner';
import { singleFileRediffArgs } from './git-diff-args';
import { computePayloadStats, countTotalLines } from './payload-sizing';
import { applySuggestion } from './apply-suggestion';
import { MAX_GIT_DIFF_OUTPUT_BYTES, MAX_IMAGE_BYTES } from './input-budgets';
import { isPreviewableImage } from './file-type-utils';
import { readReviewedContent } from './snapshot-reader';
import { resolveLocalSourceIdentity, rootRelativeReviewedPath } from './source-identity';
import {
  authorizeAttachmentReference,
  readAssetFile,
  resolveAttachmentOrigins,
} from './attachment-origins';
import type { AttachmentOrigins, AttachmentReadResult } from './attachment-origins';
import { ASSET_DIR_NAME } from './xml-serializer';

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
  session: ReviewSession,
  payload: DiffLoadPayload,
  identity: ReviewSourceIdentity | null
): void {
  session.diffData = payload;
  session.reviewedPaths = reviewedPathsOf(payload.files);
  session.sourceIdentity = identity;
}

/**
 * The old side is where a deletion or a rename's old name lives. Null when the diff has no such
 * file.
 */
export function locateReviewedFile(
  session: ReviewSession,
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
  session: ReviewSession
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
export function resolveSourceBaseDir(session: ReviewSession): string | null {
  return session.sourceIdentity?.sourceRoot ?? null;
}

const IMAGE_MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.bmp': 'image/bmp',
};

/**
 * Reads from the snapshot the review compared, never the current working tree; only reviewed,
 * previewable paths are read.
 */
export async function loadImage(
  session: ReviewSession,
  filePath: string
): Promise<ImageLoadResult> {
  if (!session.reviewedPaths.has(filePath)) {
    return { error: 'Image preview unavailable — this file is not part of the reviewed diff.' };
  }
  if (!isPreviewableImage(filePath)) {
    return { error: 'Image preview unavailable — this file is not a previewable image.' };
  }
  const located = locateReviewedFile(session, filePath);
  const side = located?.side ?? 'new';

  const result = await readReviewedContent(session, filePath, side, { maxBytes: MAX_IMAGE_BYTES });
  if (!result.ok) {
    if (result.reason === 'too-large') {
      return { error: 'File too large to preview (>10 MB)' };
    }
    console.error(`[review] Image preview unavailable for ${filePath}: ${result.message}`);
    return { error: `Image preview unavailable — ${result.message}` };
  }
  const mimeType = IMAGE_MIME_TYPES[path.posix.extname(filePath).toLowerCase()];
  return { dataUri: `data:${mimeType};base64,${result.content.toString('base64')}` };
}

/** Zero when unreadable; the caller treats that as unknown. */
async function countReviewedLines(session: ReviewSession, file: DiffFile): Promise<number> {
  const side = file.newPath ? 'new' : 'old';
  const filePath = side === 'new' ? file.newPath : file.oldPath;
  const result = await readReviewedContent(session, filePath, side, {
    maxBytes: MAX_GIT_DIFF_OUTPUT_BYTES,
  });
  if (!result.ok) {
    console.error(`[review] Line count unavailable for ${filePath}: ${result.message}`);
    return 0;
  }
  return countLines(result.content);
}

function countLines(content: Buffer): number {
  let newlines = 0;
  for (const byte of content) {
    if (byte === 0x0a) newlines++;
  }
  return content.length > 0 && content[content.length - 1] === 0x0a ? newlines : newlines + 1;
}

/**
 * Return a single file's hunks for lazy (large-payload) mode, or null when the
 * session has no diff or the diff has no such file.
 */
export function getFileHunks(session: ReviewSession, filePath: string): DiffHunk[] | null {
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
  session: ReviewSession
): { config: AppConfig; outputPathInfo: OutputPathInfo | null } | null {
  if (!session.config) {
    return null;
  }
  return { config: session.config, outputPathInfo: session.outputPathInfo };
}

/**
 * Store a review state submitted by the front end on the session.
 */
export function submitReviewState(session: ReviewSession, state: ReviewState): void {
  console.error(
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
export function takeReviewState(session: ReviewSession): ReviewState | null {
  const state = session.reviewState;
  session.reviewState = null;
  return state;
}

/**
 * True when this session reviews a remote PR/MR that was materialized into
 * a temporary clone. That clone is removed when the app exits, so a write
 * into it is lost the moment the review ends (PRD Section 5.4.8).
 */
export function isTemporaryCloneSession(session: ReviewSession): boolean {
  return session.diffData?.remote?.temporaryClone === true;
}

/** Canonical form of a path, following symlinks when the path exists. */
function canonicalize(target: string): string {
  try {
    return fs.realpathSync(target);
  } catch {
    return path.resolve(target);
  }
}

/** True when `candidate` is `root` itself or sits anywhere beneath it. */
function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(canonicalize(root), canonicalize(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

/**
 * The directory an apply may write into for this session, or null when the
 * session has none.
 *
 * For every review whose files sit in a place the user controls — a git
 * working tree, a scanned directory, a reused remote clone — that is the
 * root the reviewed paths are relative to, and no one is asked anything.
 *
 * A temporary-clone review is the one exception. Its files live in a
 * directory the app deletes on exit, so the clone is never a destination:
 * the answer is the directory the user named, and null until they name one.
 */
export function resolveApplyDestination(session: ReviewSession): string | null {
  if (isTemporaryCloneSession(session)) {
    return session.applyDestinationRoot;
  }
  return resolveSourceBaseDir(session);
}

/**
 * Record the directory the user named as this session's apply destination.
 *
 * The caller supplies a path the user picked; this decides whether it can
 * be written into and stores it only if so. The temporary clone, and
 * anything inside it, is refused however it was reached — that directory
 * is gone when the review ends, which is the whole reason a destination is
 * asked for.
 */
export function setApplyDestination(
  session: ReviewSession,
  directoryPath: string
): ApplyDestinationOutcome {
  if (!path.isAbsolute(directoryPath)) {
    return {
      status: 'rejected',
      reason: 'destination-not-absolute',
      detail: 'Pick a destination by its full path.',
    };
  }

  let isDirectory = false;
  try {
    isDirectory = fs.statSync(directoryPath).isDirectory();
  } catch {
    isDirectory = false;
  }
  if (!isDirectory) {
    return {
      status: 'rejected',
      reason: 'destination-not-a-directory',
      detail: 'That destination is not a directory that exists.',
    };
  }

  const clonePath = isTemporaryCloneSession(session) ? resolveSourceBaseDir(session) : null;
  if (clonePath && isWithin(clonePath, directoryPath)) {
    return {
      status: 'rejected',
      reason: 'destination-inside-temporary-clone',
      detail:
        'That directory is inside the temporary clone, which is deleted when the review ends.',
    };
  }

  session.applyDestinationRoot = canonicalize(directoryPath);
  console.error(`[suggestion:apply] destination set for this session`);
  return { status: 'chosen', destinationRoot: session.applyDestinationRoot };
}

/**
 * Apply one suggestion to the reviewed working file, or refuse and write
 * nothing. The engine does the work; this handler names the destination, which
 * the engine never derives, and authorizes the target.
 *
 * Authorization is membership in {@link ReviewSession.reviewedPaths}
 * (`not-reviewed` otherwise), so a resumed document or a client reaching this
 * handler cannot name an unreviewed file. The request is not bound to a
 * comment (the session keeps no registry of live suggestions); the binding is
 * the anchor plus the engine's byte-exact `originalCode` match.
 *
 * The engine gets the path through the identity's prefix, so a `--relative`
 * review of `sub/` writes `sub/<path>`, never the root's same-named file.
 *
 * A refusal travels as a value, never a thrown error.
 */
export function applySuggestionForSession(
  session: ReviewSession,
  request: SuggestionApplyRequest
): SuggestionApplyOutcome {
  const destinationRoot = resolveApplyDestination(session);
  const identity = session.sourceIdentity;
  if (!destinationRoot || identity === null) {
    const temporary = isTemporaryCloneSession(session);
    return {
      status: 'refused',
      filePath: request.filePath,
      reason: temporary ? 'destination-required' : 'no-destination',
      detail: temporary
        ? 'This pull request was cloned into a temporary directory that is deleted when the review ends. Choose a destination directory to apply into.'
        : 'This review has no working directory to write into.',
    };
  }

  if (!session.reviewedPaths.has(request.filePath)) {
    console.error(`[suggestion:apply] ${request.filePath}: refused (not-reviewed)`);
    return {
      status: 'refused',
      filePath: request.filePath,
      reason: 'not-reviewed',
      detail: 'This file is not part of the reviewed diff, so nothing was written.',
    };
  }

  const result = applySuggestion({
    destinationRoot,
    filePath: rootRelativeReviewedPath(identity, request.filePath),
    lineRange: request.lineRange,
    suggestion: request.suggestion,
  });
  console.error(
    `[suggestion:apply] ${request.filePath}: ${
      result.status === 'applied' ? 'applied' : `refused (${result.reason})`
    }`
  );

  // Projected field by field rather than passed through. The engine also
  // reports the resolved absolute path, which the front end has no use for
  // and should not be handed; naming the fields here keeps the wire shape
  // exactly what SuggestionApplyOutcome declares, today and after the engine
  // grows a field. The path is the request's, not the engine's root-relative one.
  if (result.status === 'applied') {
    return {
      status: 'applied',
      filePath: request.filePath,
      replacedLines: result.replacedLines,
    };
  }
  return {
    status: 'refused',
    filePath: request.filePath,
    reason: result.reason,
    detail: result.detail,
  };
}

/**
 * Records that resumed attachments live beside the resumed document, whatever the
 * launch directory or save location. Returns one diagnostic per reference that is
 * not `.self-review-assets/<name>` and so will never be read.
 */
export function recordResumedAttachments(
  session: ReviewSession,
  comments: readonly ReviewComment[],
  resumeDocumentPath: string
): string[] {
  const { origins, diagnostics } = resolveAttachmentOrigins(comments, resumeDocumentPath);
  session.attachmentOrigins = origins;
  return diagnostics;
}

/**
 * Read one attachment by its `.self-review-assets/<name>` reference, never a path:
 * an imported one from its recorded origin, any other from the current output's asset
 * directory. Anything else is `not-authorized` and touches nothing.
 */
export async function readAttachment(
  session: ReviewSession,
  reference: unknown
): Promise<AttachmentReadResult> {
  const outputPath = session.outputPathInfo?.resolvedOutputPath;
  const currentAssetDir = outputPath ? path.join(path.dirname(outputPath), ASSET_DIR_NAME) : null;
  const assetPath = authorizeAttachmentReference(
    reference,
    session.attachmentOrigins,
    currentAssetDir
  );
  if (assetPath === null) {
    console.error(`[attachment:read] Refused: ${JSON.stringify(reference)}`);
    return {
      ok: false,
      reason: 'not-authorized',
      message: `Attachments are read only from the review's ${ASSET_DIR_NAME} directory`,
    };
  }
  const result = await readAssetFile(assetPath);
  if (!result.ok) {
    console.error(`[attachment:read] ${result.reason}: ${result.message}`);
  }
  return result;
}

/**
 * Resolve the resumed comments, viewed files and remote drift for a session.
 * Returns null when there is nothing to resume, so the caller sends nothing
 * at all.
 */
export function getResumeLoad(session: ReviewSession): ResumeLoadPayload | null {
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

/**
 * Re-run the review's own git diff over one file with more context, via
 * {@link singleFileRediffArgs}. Git runs at the source root; a `--relative` review is
 * restated with the prefix resolved at load time, and the file's paths (both, for a
 * rename or copy, so git pairs them) are root-relative literal pathspecs. The entry
 * returned is the one matching the file's old and new paths, not git's first.
 *
 * Expanded hunks are written back to the session's diff data. Returns null when
 * there is no git diff or tracked file, git's output lacks the file, or git fails.
 */
export async function expandContext(
  session: ReviewSession,
  request: ExpandContextRequest
): Promise<{ hunks: DiffHunk[]; totalLines: number } | null> {
  const diffData = session.diffData;
  const identity = session.sourceIdentity;
  if (!diffData || diffData.source.type !== 'git' || identity === null) {
    return null;
  }
  if (identity.mode !== 'git' && identity.mode !== 'remote') {
    return null;
  }
  if (!Number.isSafeInteger(request.contextLines) || request.contextLines < 0) {
    return null;
  }
  // Untracked files are synthetic additions git never compared.
  const target = diffData.files.find(
    f => !f.isUntracked && (f.newPath || f.oldPath) === request.filePath
  );
  if (!target) {
    return null;
  }

  try {
    const { runGitDiffAsync } = await import('./git');
    const { parseDiff } = await import('./diff-parser');

    const rediff = singleFileRediffArgs(identity.gitDiffArgv);
    const prefix = identity.pathPrefix;
    const paths = [...new Set([target.oldPath, target.newPath].filter(p => p !== ''))];
    const expandArgs = [
      ...rediff.args,
      ...(prefix === '' ? [] : [`--relative=${prefix}`]),
      `-U${request.contextLines}`,
      '--',
      ...paths.map(p => `:(top,literal)${rootRelativeReviewedPath(identity, p)}`),
    ];

    // Never the process cwd.
    const rawDiff = await runGitDiffAsync(expandArgs, identity.sourceRoot);
    const expandedFile = parseDiff(rawDiff).find(
      f => f.oldPath === target.oldPath && f.newPath === target.newPath
    );
    if (!expandedFile) {
      console.error(`[review] Expanded diff for ${request.filePath} did not contain the file`);
      return null;
    }

    // The reviewed side's length, for gap detection; zero keeps the bars visible.
    const totalLines = await countReviewedLines(session, target);

    session.diffData = {
      ...diffData,
      files: diffData.files.map(f => (f === target ? { ...f, hunks: expandedFile.hunks } : f)),
    };

    return { hunks: expandedFile.hunks, totalLines };
  } catch (error) {
    console.error(`[review] Failed to expand context for ${request.filePath}:`, error);
    return null;
  }
}

/**
 * What a review start produced: the payload built from the scanned path, the
 * stats it was measured against (null when the session has no config, in which
 * case no thresholds apply), and whether those stats exceeded a threshold.
 *
 * The payload is deliberately *not* stored on the session: the caller may still
 * need to abandon it (a user declining a large review keeps the review they
 * were already looking at), so committing it is the caller's decision.
 */
export interface ReviewStartResult {
  payload: DiffLoadPayload;
  identity: ReviewSourceIdentity;
  stats: PayloadStats | null;
  exceedsThresholds: boolean;
}

/**
 * Scan a picked path and build the diff payload for a directory (or single
 * file) review, measured against the session's large-payload thresholds.
 * Nothing is stored on the session — see `ReviewStartResult`.
 */
export async function prepareDirectoryReview(
  session: ReviewSession,
  directoryPath: string
): Promise<ReviewStartResult> {
  console.error('[review] Starting directory review for:', directoryPath);

  // Check if the path is a file (not a directory)
  let isFile = false;
  try {
    isFile = fs.statSync(directoryPath).isFile();
  } catch {
    // Failed to stat — proceed as directory
  }

  // Scan diagnostics ride on the payload so a failed load never looks empty.
  const scan = isFile
    ? await scanFile(directoryPath)
    : await scanDirectory(directoryPath, session.config?.ignore ?? []);
  const type = isFile ? 'file' : 'directory';
  const payload: DiffLoadPayload = {
    files: scan.files,
    source: { type, sourcePath: directoryPath },
    ...(scan.diagnostics.length > 0 ? { diagnostics: scan.diagnostics } : {}),
  };
  const identity = resolveLocalSourceIdentity({ type, sourcePath: directoryPath });

  // Large payload guard — skipped entirely when there is no config.
  if (!session.config) {
    return { payload, identity, stats: null, exceedsThresholds: false };
  }
  const stats = computePayloadStats(
    payload.files.length,
    countTotalLines(payload.files),
    session.config
  );
  return { payload, identity, stats, exceedsThresholds: stats.exceedsAny };
}

/**
 * Commit a prepared review payload to the session, once the caller has decided
 * it should proceed. Returns the payload to hand to the transport.
 */
export function commitReviewStart(
  session: ReviewSession,
  payload: DiffLoadPayload,
  identity: ReviewSourceIdentity | null
): DiffLoadPayload {
  commitDiffData(session, payload, identity);
  return preparePayload(payload);
}
