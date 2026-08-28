// src/main/review-handlers.ts
// Transport-agnostic review request handlers.
//
// These functions hold the bodies of the request handlers the Electron main
// process registers on `ipcMain`. They take plain arguments, return plain
// results, and import nothing from `electron`, so a second front end can run
// the same implementation instead of a copy of it.
//
// The state they consult (diff payload, guide payload, resume data) is
// populated during startup and is passed in as an explicit `ReviewSession`
// rather than read from module-level caches here. Each front end owns its own
// session and populates it during its own startup; nothing in this module is
// shared mutable state.

import * as fs from 'fs';
import path from 'path';
import {
  AppConfig,
  DiffHunk,
  DiffLoadPayload,
  ExpandContextRequest,
  ExpandContextResponse,
  GuideLoadPayload,
  ImageLoadResult,
  OutputPathInfo,
  RemoteDriftInfo,
  ResumeLoadPayload,
  ReviewComment,
  ReviewState,
} from '../shared/types';

/**
 * The state a review session accumulates, populated by whichever front end
 * starts the session and read (and, for expand-context, written) by the
 * handlers below.
 */
export interface ReviewSession {
  /** The diff under review. Null until startup resolves one. */
  diffData: DiffLoadPayload | null;
  /** The reconciled walkthrough guide sidecar, when one was discovered. */
  guideData: GuideLoadPayload | null;
  /** Merged YAML configuration. */
  config: AppConfig | null;
  /** Resolved output path and its writability. */
  outputPathInfo: OutputPathInfo | null;
  /** Comments restored from `--resume-from` and/or fetched forge threads. */
  resumeComments: ReviewComment[];
  /** Paths a resumed review had marked as done. */
  resumeViewedFiles: string[];
  /** Remote head drift, when a resumed remote document recorded a head SHA. */
  resumeRemoteDrift: RemoteDriftInfo | null;
  /** The last review state the UI pushed, consumed on save. */
  reviewState: ReviewState | null;
}

/** Create an empty session. Front ends populate it during their own startup. */
export function createReviewSession(): ReviewSession {
  return {
    diffData: null,
    guideData: null,
    config: null,
    outputPathInfo: null,
    resumeComments: [],
    resumeViewedFiles: [],
    resumeRemoteDrift: null,
    reviewState: null,
  };
}

/** The diff payload and the guide that rides with it, for one diff request. */
export interface DiffRequestResult {
  diff: DiffLoadPayload;
  /** Null when no guide sidecar was discovered for this session. */
  guide: GuideLoadPayload | null;
}

/**
 * Prepare a DiffLoadPayload for transmission.
 * In large-payload mode, strips hunks from files to reduce initial transfer size.
 * The full data stays in the session for on-demand loading via
 * {@link handleLoadFile}.
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
 * Resolve the initial diff request.
 *
 * Returns null when the session holds no diff, in which case nothing is sent.
 * The guide rides with the diff payload — it is metadata-only (paths, names,
 * descriptions) and never triggers eager hunk loading — so both normal and
 * large-payload modes carry it.
 */
export function handleDiffRequest(session: ReviewSession): DiffRequestResult | null {
  if (!session.diffData) {
    return null;
  }
  return {
    diff: preparePayload(session.diffData),
    guide: session.guideData,
  };
}

/**
 * The directory a repository-relative path in this session resolves against.
 *
 * Diff paths are repository-relative in git mode, so they resolve against the
 * diff's own repository root — in remote mode, the materialized clone — and
 * never against the process cwd. Other modes have no such root and fall back
 * to the cwd, which is what they were scanned relative to.
 *
 * Exported because serve mode has to answer the same question one step earlier
 * than the handlers do: an HTTP path parameter is refused before it reaches a
 * handler if it does not sit under this directory.
 */
export function sessionBaseDir(session: ReviewSession): string {
  return session.diffData?.source.type === 'git'
    ? session.diffData.source.repository
    : process.cwd();
}

/** Load a binary image as a base64 data URI for the rendered preview. */
export async function handleLoadImage(
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
  const baseDir = sessionBaseDir(session);
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

/** Load a single file's hunks on demand, for lazy (large-payload) mode. */
export async function handleLoadFile(
  session: ReviewSession,
  filePath: string
): Promise<DiffHunk[] | null> {
  if (!session.diffData) return null;
  const file = session.diffData.files.find(f => (f.newPath || f.oldPath) === filePath);
  if (!file) return null;
  return file.hunks;
}

/** Record the review state the UI pushed, for the save path to consume. */
export function handleReviewSubmit(session: ReviewSession, state: ReviewState): void {
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

/** Read a comment attachment off disk. Returns null when it cannot be read. */
export async function handleReadAttachment(filePath: string): Promise<ArrayBuffer | null> {
  try {
    const buffer = await fs.promises.readFile(filePath);
    return buffer.buffer; // Convert Node.js Buffer to ArrayBuffer
  } catch {
    console.error(`[attachment:read] Failed to read file: ${filePath}`);
    return null;
  }
}

/**
 * Resolve the resume request. Returns null when the session carries nothing
 * to restore, in which case nothing is sent.
 */
export function handleResumeRequest(session: ReviewSession): ResumeLoadPayload | null {
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
 * Expand context for a single file by re-running git diff with more context
 * lines. Updates the session's diff so later reads see the expanded hunks.
 */
export async function handleExpandContext(
  session: ReviewSession,
  request: ExpandContextRequest
): Promise<ExpandContextResponse | null> {
  if (!session.diffData || session.diffData.source.type !== 'git') {
    return null;
  }

  try {
    const { runGitDiffAsync } = await import('./git');
    const { parseDiff } = await import('./diff-parser');

    const source = session.diffData.source as { type: 'git'; gitDiffArgs: string; repository: string };
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

    // Update the session's diff
    session.diffData = {
      ...session.diffData,
      files: session.diffData.files.map(f => {
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
