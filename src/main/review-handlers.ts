// src/main/review-handlers.ts
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
  DiffHunk,
  ResumeLoadPayload,
  GuideLoadPayload,
  AppConfig,
  OutputPathInfo,
  PayloadStats,
  ReviewState,
  ReviewComment,
  ExpandContextRequest,
  ImageLoadResult,
  RemoteDriftInfo,
} from '../shared/types';
import { scanDirectory, scanFile } from './directory-scanner';
import { computePayloadStats, countTotalLines } from './payload-sizing';

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
  };
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
 * Load a binary image as a base64 data URI for the rendered preview.
 */
export async function loadImage(
  session: ReviewSession,
  filePath: string
): Promise<ImageLoadResult> {
  const MIME_MAP: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml',
  };
  const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
  // Diff paths are repository-relative in git mode; resolve them against
  // the diff's repository root (in remote mode, the materialized clone),
  // never the process cwd.
  const baseDir =
    session.diffData?.source.type === 'git'
      ? session.diffData.source.repository
      : process.cwd();
  const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(baseDir, filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = MIME_MAP[ext] ?? 'application/octet-stream';

  // In a remote session the reviewed content lives at the fetched head
  // SHA, not in the clone's working tree (a temporary clone stays on the
  // default branch), so read the blob through git instead of the fs.
  const remote = session.diffData?.remote;
  if (remote && session.diffData?.source.type === 'git') {
    try {
      const { readGitBlobAsync } = await import('./git');
      const data = await readGitBlobAsync(
        session.diffData.source.repository,
        `${remote.remoteHeadSha}:${filePath}`
      );
      if (data.length > MAX_SIZE) {
        return { error: 'File too large to preview (>10 MB)' };
      }
      return { dataUri: `data:${mimeType};base64,${data.toString('base64')}` };
    } catch {
      return {
        error: 'Image preview unavailable — blob not found at the reviewed commit.',
      };
    }
  }

  try {
    const stat = await fs.promises.stat(resolved);
    if (stat.size > MAX_SIZE) {
      return { error: 'File too large to preview (>10 MB)' };
    }
    const data = await fs.promises.readFile(resolved);
    return { dataUri: `data:${mimeType};base64,${data.toString('base64')}` };
  } catch {
    return { error: 'Image preview unavailable — file not found on disk.' };
  }
}

/**
 * Return a single file's hunks for lazy (large-payload) mode, or null when the
 * session has no diff or the diff has no such file.
 */
export function getFileHunks(
  session: ReviewSession,
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
export function submitReviewState(
  session: ReviewSession,
  state: ReviewState
): void {
  console.error(
    '[ipc] Received REVIEW_SUBMIT from renderer:',
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
 * Read an attachment file from disk, as an ArrayBuffer the front end can use.
 * Returns null when the file cannot be read.
 */
export async function readAttachment(filePath: string) {
  try {
    const buffer = await fs.promises.readFile(filePath);
    return buffer.buffer; // Convert Node.js Buffer to ArrayBuffer
  } catch {
    console.error(`[attachment:read] Failed to read file: ${filePath}`);
    return null;
  }
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
    session.resumeRemoteDrift !== null
  ) {
    const payload: ResumeLoadPayload = {
      comments: session.resumeComments,
      viewedFiles: session.resumeViewedFiles,
    };
    if (session.resumeRemoteDrift !== null) {
      payload.remoteDrift = session.resumeRemoteDrift;
    }
    return payload;
  }
  return null;
}

/**
 * Expand the context of a single file by re-running git diff with more context
 * lines. The expanded hunks are written back to the session's diff data so a
 * later file load on the same session sees them. Returns null when the session
 * has no git diff, when nothing parses, or when git fails.
 */
export async function expandContext(
  session: ReviewSession,
  request: ExpandContextRequest
): Promise<{ hunks: DiffHunk[]; totalLines: number } | null> {
  const diffData = session.diffData;
  if (!diffData || diffData.source.type !== 'git') {
    return null;
  }

  try {
    const { runGitDiffAsync } = await import('./git');
    const { parseDiff } = await import('./diff-parser');

    const source = diffData.source as { type: 'git'; gitDiffArgs: string; repository: string };
    const originalArgs = source.gitDiffArgs
      .split(/\s+/)
      .filter(a => a.length > 0);

    // Strip -U/--unified flags. Stop at `--` — paths after it were the
    // original path restriction; the specific file is supplied below.
    const filteredArgs: string[] = [];
    for (let i = 0; i < originalArgs.length; i++) {
      const arg = originalArgs[i];
      if (arg.match(/^-U\d+$/) || arg.match(/^--unified=\d+$/)) {
        continue;
      }
      if (arg === '-U' || arg === '--unified') {
        i++; // skip next arg (the number)
        continue;
      }
      if (arg === '--') {
        break;
      }
      filteredArgs.push(arg);
    }

    const expandArgs = [
      ...filteredArgs,
      `-U${request.contextLines}`,
      '--',
      request.filePath,
    ];

    // Run in the diff's repository root — in remote mode this is the
    // materialized clone, not the process cwd.
    const rawDiff = await runGitDiffAsync(expandArgs, source.repository);
    const parsedFiles = parseDiff(rawDiff);

    if (parsedFiles.length === 0) {
      return null;
    }

    const expandedFile = parsedFiles[0];

    // Count total lines in the working tree file for gap detection.
    // Diff paths are repository-relative — resolve accordingly.
    let totalLines = 0;
    try {
      const content = await fs.promises.readFile(
        path.resolve(source.repository, request.filePath),
        'utf-8'
      );
      totalLines = content.split('\n').length;
      // If file ends with newline, last split element is empty — don't count it
      if (content.endsWith('\n')) totalLines--;
    } catch {
      // Can't determine line count — leave as 0 (bars will stay visible)
    }

    // Update the session's diff data
    session.diffData = {
      ...diffData,
      files: diffData.files.map(f => {
        const fPath = f.newPath || f.oldPath;
        if (fPath === request.filePath) {
          return { ...f, hunks: expandedFile.hunks };
        }
        return f;
      }),
    };

    return { hunks: expandedFile.hunks, totalLines };
  } catch (error) {
    console.error(
      `[ipc] Failed to expand context for ${request.filePath}:`,
      error
    );
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
  console.error(
    '[ipc] Starting directory review for:',
    directoryPath
  );

  // Check if the path is a file (not a directory)
  let isFile = false;
  try {
    isFile = fs.statSync(directoryPath).isFile();
  } catch {
    // Failed to stat — proceed as directory
  }

  let payload: DiffLoadPayload;
  if (isFile) {
    const files = await scanFile(directoryPath);
    payload = {
      files,
      source: { type: 'file', sourcePath: directoryPath },
    };
  } else {
    // Directory mode: scan all files as new additions
    const ignorePatterns = session.config?.ignore ?? [];
    const files = await scanDirectory(directoryPath, ignorePatterns);
    payload = {
      files,
      source: { type: 'directory', sourcePath: directoryPath },
    };
  }

  // Large payload guard — skipped entirely when there is no config.
  if (!session.config) {
    return { payload, stats: null, exceedsThresholds: false };
  }
  const stats = computePayloadStats(
    payload.files.length,
    countTotalLines(payload.files),
    session.config
  );
  return { payload, stats, exceedsThresholds: stats.exceedsAny };
}

/**
 * Commit a prepared review payload to the session, once the caller has decided
 * it should proceed. Returns the payload to hand to the transport.
 */
export function commitReviewStart(
  session: ReviewSession,
  payload: DiffLoadPayload
): DiffLoadPayload {
  session.diffData = payload;
  return preparePayload(payload);
}
