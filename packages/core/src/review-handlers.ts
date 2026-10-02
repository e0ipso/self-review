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
import { singleFileRediffArgs, type DiffPathRelativity } from './git-diff-args';
import { computePayloadStats, countTotalLines } from './payload-sizing';
import { applySuggestion } from './apply-suggestion';
import { MAX_GIT_DIFF_OUTPUT_BYTES, MAX_IMAGE_BYTES } from './input-budgets';
import { isPreviewableImage } from './file-type-utils';
import { readReviewedContent } from './snapshot-reader';
import { canonicalSourcePath, resolveLocalSourceIdentity } from './source-identity';
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
  /** Import diagnostics from the resumed document; see `ResumeLoadPayload`. */
  resumeImportDiagnostics: string[];
  /**
   * Destination directory the user named for this session's applies, or
   * null when none has been named. Only a temporary-clone remote review
   * needs one; see {@link resolveApplyDestination}.
   */
  applyDestinationRoot: string | null;
  /**
   * Every path the committed diff contained — `newPath` and `oldPath` of
   * each file, so a rename's both names and a deletion's old name count —
   * captured once by {@link commitDiffData} and frozen. This is the
   * authorization set for anything that writes a reviewed file: the
   * reviewer saw exactly these paths. Resumed comments, submitted review
   * state and the renderer's placeholder entries can all name other paths,
   * and none of them reach this set.
   */
  reviewedPaths: ReadonlySet<string>;
  /**
   * What this session reviews — mode, physical source root, structured
   * argv and the two snapshots compared — recorded by {@link commitDiffData}
   * alongside the diff. Every read of reviewed content and every path
   * authorization resolves against it; null until a diff is committed (and
   * for a welcome session, which reviews nothing), when every such read
   * refuses.
   */
  sourceIdentity: ReviewSourceIdentity | null;
  /**
   * Where each resumed attachment's bytes live: the reference the resumed
   * document wrote, mapped to an absolute path beside *that document*.
   * Recorded once by {@link recordResumedAttachments}; empty when nothing
   * was resumed. It authorizes attachment reads and tells the publisher
   * which bytes to carry when the review is saved somewhere else
   * (`PublishReviewOptions.attachmentOrigins`). Never sent to the front end,
   * which keeps the relative reference.
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

/** A set no later caller can grow: `add`/`delete`/`clear` throw. */
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

/** The paths of a diff's files, old and new, with no empty names. */
function reviewedPathsOf(files: readonly DiffFile[]): ReadonlySet<string> {
  const paths = new Set<string>();
  for (const file of files) {
    if (file.newPath) paths.add(file.newPath);
    if (file.oldPath) paths.add(file.oldPath);
  }
  return freezeSet(paths);
}

/**
 * Make `payload` the session's diff. This is the one place a diff is
 * committed to a session — every front end's startup, the welcome screen's
 * directory start and the remote bootstrap all land here — and the moment
 * {@link ReviewSession.reviewedPaths} is captured from it and
 * {@link ReviewSession.sourceIdentity} is recorded. Later edits to
 * `session.diffData` (expanded context writes hunks back) leave both as
 * they were.
 *
 * The identity is the loader's to supply — it is the one that knows which
 * snapshots the diff compared — and `null` only for a payload that reviews
 * nothing (the welcome screen). A session without one refuses every read
 * of reviewed content rather than guessing a root.
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
 * The reviewed file `filePath` names and the side of the review its content
 * is on: the new side, or the old side for a deletion or a rename's old
 * name. Null when the diff has no such file.
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

/**
 * The physical directory the session's reviewed paths are relative to —
 * the repository root (in remote mode, the materialized clone), the
 * reviewed directory, or the reviewed file's parent — or null when the
 * session has no source identity yet. This is the read-only source root;
 * {@link resolveApplyDestination} decides where applies may write.
 */
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
 * Load a reviewed image as a base64 data URI for the rendered preview.
 *
 * The bytes come from the snapshot the review compared — the index for a
 * staged review, the commit for a range or a PR head, the working tree or
 * scanned directory otherwise — never from wherever the working tree
 * happens to be now. Only a path the committed diff contained, of a type
 * the preview renders, is read at all; a deleted image is read from the
 * old side, which is the only side that still has it.
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

/**
 * The number of lines of `file` on the side of the review that has it (the
 * new side, or the old side of a deletion), read from the reviewed
 * snapshot. `prefix` is what the review's paths are relative to under the
 * source root (`--relative`); empty for root-relative paths. Zero when it
 * cannot be read; the caller treats that as unknown.
 */
async function countReviewedLines(
  session: ReviewSession,
  file: DiffFile,
  prefix: string
): Promise<number> {
  const side = file.newPath ? 'new' : 'old';
  const filePath = side === 'new' ? file.newPath : file.oldPath;
  if (!session.reviewedPaths.has(filePath)) return 0;
  // The reader resolves paths against the source root, so a reviewed path
  // relative to a subdirectory is restated from the root. It is the same
  // file under its root-relative name, authorized by the check above.
  const rootPath = rootRelativePath(prefix, filePath);
  const snapshot = { sourceIdentity: session.sourceIdentity, reviewedPaths: new Set([rootPath]) };
  const result = await readReviewedContent(snapshot, rootPath, side, {
    maxBytes: MAX_GIT_DIFF_OUTPUT_BYTES,
  });
  if (!result.ok) {
    console.error(`[review] Line count unavailable for ${filePath}: ${result.message}`);
    return 0;
  }
  return countLines(result.content);
}

/** Lines in `content`, where a trailing newline ends the last line rather than starting one. */
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
 * nothing. The engine in `apply-suggestion.ts` does the work; this handler
 * names the destination the session reviews, which the engine never derives
 * for itself, and authorizes the target against the session.
 *
 * Authorization is membership in {@link ReviewSession.reviewedPaths}: the
 * file must be one the committed diff contained (`not-reviewed` otherwise).
 * That is what stops a resumed document, or a client that can reach this
 * handler, from naming a file the reviewer never looked at. Repository
 * control files are refused by the engine even when a crafted payload lists
 * them. Beyond the path, the request is not bound to a particular comment:
 * the session holds no registry of live suggestions (the front end owns
 * review state until it is submitted), so the binding is the anchor plus the
 * byte-exact match of `originalCode` against the file, which the engine
 * checks before writing and which a request cannot satisfy for lines it
 * does not know.
 *
 * A refusal travels as a value, never as a thrown error. The front end
 * renders its `detail` next to the suggestion the attempt came from.
 */
export function applySuggestionForSession(
  session: ReviewSession,
  request: SuggestionApplyRequest
): SuggestionApplyOutcome {
  const destinationRoot = resolveApplyDestination(session);
  if (!destinationRoot) {
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
    filePath: request.filePath,
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
  // grows a field.
  if (result.status === 'applied') {
    return {
      status: 'applied',
      filePath: result.filePath,
      replacedLines: result.replacedLines,
    };
  }
  return {
    status: 'refused',
    filePath: result.filePath,
    reason: result.reason,
    detail: result.detail,
  };
}

/**
 * Record where the attachments of a resumed review live: beside the resumed
 * document (`resumeDocumentPath`), wherever the app was launched from and
 * wherever the review will be saved. Replaces any origins recorded before.
 *
 * Returns one diagnostic line per attachment reference that is not
 * `.self-review-assets/<name>` and will therefore never be read; the host
 * adds them to the resume import diagnostics.
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
 * Read one attachment the front end displays, by the reference the review
 * names it with (`.self-review-assets/<name>`), never by a path.
 *
 * The reference is authorized against the session: an imported one reads
 * from its recorded origin beside the resumed document; any other reads from
 * the current output's asset directory. Anything else — an absolute path,
 * traversal, a nested directory — is `not-authorized` and touches nothing.
 * The asset directory must be a real directory, the file is opened without
 * following links, and only a regular file within `MAX_IMAGE_BYTES` is read.
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
 * What the reviewed paths are relative to, as a directory under the source
 * root with no leading slash: empty for root-relative paths, the
 * `--relative=<dir>` directory as given, or, for a bare `--relative`, the
 * directory the review was launched from. Null when that directory is not
 * inside the source root, so the paths cannot be restated.
 */
function resolveRelativePrefix(
  identity: ReviewSourceIdentity,
  relative: DiffPathRelativity
): string | null {
  switch (relative.kind) {
    case 'root':
      return '';
    case 'directory':
      return relative.directory;
    case 'cwd': {
      const fromRoot = path.relative(
        identity.sourceRoot,
        canonicalSourcePath(identity.invocationCwd)
      );
      if (fromRoot.startsWith('..') || path.isAbsolute(fromRoot)) return null;
      return fromRoot.split(path.sep).join('/');
    }
  }
}

/** `filePath`, relative to `prefix` (see {@link resolveRelativePrefix}), from the root. */
function rootRelativePath(prefix: string, filePath: string): string {
  if (prefix === '') return filePath;
  return prefix.endsWith('/') ? `${prefix}${filePath}` : `${prefix}/${filePath}`;
}

/**
 * Expand the context of a single file by re-running the review's own git
 * diff over that file with more context lines.
 *
 * The comparison is the one the review loaded: the session's structured
 * argv, with only its context options (and file-order options, which a
 * single file has no use for) taken out by {@link singleFileRediffArgs} —
 * so a revision after a bare `-U` stays a revision. Git runs at the source
 * root; a `--relative` review is restated as `--relative=<dir>` from there,
 * and the file's paths are passed as root-relative literal pathspecs, both
 * of a rename or copy so git pairs them again. The entry returned is the
 * one whose old and new paths are the requested file's, not whichever git
 * printed first.
 *
 * The expanded hunks are written back to the session's diff data so a
 * later file load on the same session sees them. Returns null when the
 * session has no git diff, when the diff has no such tracked file, when
 * git's output does not contain it, or when git fails.
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
    const prefix = resolveRelativePrefix(identity, rediff.relative);
    if (prefix === null) {
      console.error(
        `[review] Cannot expand ${request.filePath}: the review was launched outside its repository`
      );
      return null;
    }
    const paths = [...new Set([target.oldPath, target.newPath].filter(p => p !== ''))];
    const expandArgs = [
      ...rediff.args,
      ...(prefix === '' ? [] : [`--relative=${prefix}`]),
      `-U${request.contextLines}`,
      '--',
      ...paths.map(p => `:(top,literal)${rootRelativePath(prefix, p)}`),
    ];

    // The source root: the repository, or in remote mode the materialized
    // clone, never the process cwd.
    const rawDiff = await runGitDiffAsync(expandArgs, identity.sourceRoot);
    const expandedFile = parseDiff(rawDiff).find(
      f => f.oldPath === target.oldPath && f.newPath === target.newPath
    );
    if (!expandedFile) {
      console.error(`[review] Expanded diff for ${request.filePath} did not contain the file`);
      return null;
    }

    // The file's length on the reviewed side, for gap detection: the index
    // for a staged review, the PR head for a remote one — never the working
    // tree a temporary clone left on its default branch. Zero when it cannot
    // be read, which keeps the bars visible.
    const totalLines = await countReviewedLines(session, target, prefix);

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
  /** The identity to commit with the payload; see {@link commitDiffData}. */
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

  // Directory mode scans all files as new additions. Scan diagnostics (a
  // budget hit, an unreadable source) ride on the payload so the review
  // never presents a failed or partial load as an empty one.
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
