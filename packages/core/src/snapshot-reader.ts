// packages/core/src/snapshot-reader.ts
// Authorized side reads. First-party loaded evidence pins index objects and detects source drift.

import { runBufferedCommand, type BufferedCommandRunner } from './command-runner';
import { CommandCancelledError, isCommandCancelled } from './forge-provider';
import * as path from 'path';
import type { ReviewSourceIdentity, ReviewSourceSide } from './types';
import { MAX_SOURCE_FILE_BYTES } from './input-budgets';
import { errnoOf, toSafeFsError } from './safe-fs';
import type { SafeFsErrorCode } from './safe-fs';
import { rootRelativeReviewedPath } from './source-identity';
import { readContainedFileBounded } from './safe-fs-async';
import { nodeReadFsLayer, type BoundedAsyncReadFsLayer } from './safe-fs-read';
import {
  identityStamp,
  loadedSnapshot,
  loadedReviewState,
  type LoadedReview,
  sourceStamp,
  captureSourceReads,
  RELOAD_REVIEW,
} from './loaded-snapshot';
import type { PhysicalCapture } from './loaded-snapshot';

export interface ReviewedSnapshot {
  /** Explicit load evidence. A logical identity copy alone has only legacy live semantics. */
  loadedReview?: LoadedReview | null;
  sourceIdentity: ReviewSourceIdentity | null;
  reviewedPaths: ReadonlySet<string>;
}

export type ReviewedPathRefusal =
  | 'no-source'
  | 'not-reviewed'
  /** Absolute, empty, or leaving the source root. */
  | 'invalid-path';

export type ReviewedPathAuthorization =
  | {
      ok: true;
      /** Restated from `sourceRoot` through the identity's prefix, normalized. */
      relativePath: string;
      sourceRoot: string;
    }
  | { ok: false; reason: ReviewedPathRefusal; message: string };

/** The one path check every front end delegates to; what passes is exactly what the readers open. */
export function authorizeReviewedPath(
  source: ReviewedSnapshot,
  filePath: string
): ReviewedPathAuthorization {
  const identity = source.sourceIdentity;
  if (identity === null) {
    return { ok: false, reason: 'no-source', message: 'No review has been loaded.' };
  }
  const invalid: ReviewedPathAuthorization = {
    ok: false,
    reason: 'invalid-path',
    message: 'This path does not stay inside the reviewed source.',
  };
  // The path as sent must be sound before a prefix is put in front of it:
  // `<prefix>//etc/passwd` would normalize into a relative path.
  if (normalizeReviewedPath(filePath) === null) return invalid;
  if (!source.reviewedPaths.has(filePath)) {
    return {
      ok: false,
      reason: 'not-reviewed',
      message: 'This file is not part of the reviewed diff.',
    };
  }
  const relativePath = normalizeReviewedPath(rootRelativeReviewedPath(identity, filePath));
  if (relativePath === null) return invalid;
  return { ok: true, relativePath, sourceRoot: identity.sourceRoot };
}

/** Diff paths are `/`-separated on every platform; a backslash is an ordinary character. */
function normalizeReviewedPath(filePath: string): string | null {
  if (filePath === '' || filePath.includes('\0') || path.posix.isAbsolute(filePath)) return null;
  const normalized = path.posix.normalize(filePath);
  if (normalized === '.' || normalized === '..' || normalized.startsWith('../')) return null;
  if (normalized.split('/').includes('..')) return null;
  return normalized;
}

export type SnapshotReadFailure =
  | ReviewedPathRefusal
  /** The side has no content (`none`) or could not be identified (`unknown`). */
  | 'side-unavailable'
  | 'not-found'
  /** A directory, FIFO, socket or device. */
  | 'not-regular'
  | 'unsafe-link'
  | 'too-large'
  | 'read-failed';

export type SnapshotReadResult =
  | { ok: true; content: Buffer }
  | { ok: false; reason: SnapshotReadFailure; message: string };

export interface SnapshotReadOptions {
  /** Defaults to `MAX_SOURCE_FILE_BYTES`. */
  maxBytes?: number;
  /** Aborts git children; a physical read closes its bounded descriptor before rejecting. */
  signal?: AbortSignal;
  timeoutMs?: number;
  runner?: BufferedCommandRunner;
  /** Bounded reader for legacy identities. Captured reads require the load's own reader. */
  readFs?: BoundedAsyncReadFsLayer;
}

function failure(reason: SnapshotReadFailure, message: string): SnapshotReadResult {
  return { ok: false, reason, message };
}

/** A blob from the object store, or the file under the physical source root; authorized first. */
export async function readReviewedContent(
  source: ReviewedSnapshot,
  filePath: string,
  side: 'old' | 'new',
  options: SnapshotReadOptions = {}
): Promise<SnapshotReadResult> {
  const authorized = authorizeReviewedPath(source, filePath);
  if (!authorized.ok) return failure(authorized.reason, authorized.message);
  const throwIfAborted = () => {
    if (options.signal?.aborted)
      throw new CommandCancelledError('aborted', 'self-review', [
        'read-reviewed-content',
        filePath,
      ]);
  };
  throwIfAborted();
  const identity = source.sourceIdentity!;
  const sides = identity.fileSources?.get(filePath) ?? identity;
  const descriptor = side === 'old' ? sides.oldSide : sides.newSide;
  const maxBytes = options.maxBytes ?? MAX_SOURCE_FILE_BYTES;
  const explicit = source.loadedReview ? loadedReviewState(source.loadedReview) : undefined;
  if (explicit && (explicit.identity !== identity || !explicit.reviewedPaths.has(filePath)))
    return failure('read-failed', RELOAD_REVIEW);
  const captured = explicit?.snapshot ?? loadedSnapshot(identity);
  if (captured && captured.identityStamp !== identityStamp(identity)) {
    return failure('read-failed', RELOAD_REVIEW);
  }
  if (captured && (descriptor.kind === 'index' || descriptor.kind === 'commit')) {
    if (captured.gitOptions?.runner && !captured.blobRunner && !options.runner) {
      return failure(
        'read-failed',
        'The supplied git source needs a binary snapshot runner for blob reads.'
      );
    }
    const spec =
      descriptor.kind === 'index'
        ? captured.index.get(filePath)
        : `${descriptor.sha}:${authorized.relativePath}`;
    const result = spec
      ? await readGitBlob(authorized.sourceRoot, spec, maxBytes, {
          ...options,
          runner: options.runner ?? captured.blobRunner,
        })
      : failure('side-unavailable', 'No stage-zero blob was captured for this side of the review.');
    throwIfAborted();
    return captured.identityStamp === identityStamp(identity)
      ? result
      : failure('read-failed', RELOAD_REVIEW);
  }
  const physical = ['working-tree', 'directory', 'file'].includes(descriptor.kind);
  if (captured && physical && !captured.physical.has(filePath)) {
    return failure('read-failed', RELOAD_REVIEW);
  }
  const result = await readSide(
    descriptor,
    authorized.sourceRoot,
    authorized.relativePath,
    maxBytes,
    options,
    captured?.physical.get(filePath)
  );
  throwIfAborted();
  if (captured && captured.identityStamp !== identityStamp(identity))
    return failure('read-failed', RELOAD_REVIEW);
  return result;
}

/** Read through an original load capability; structural/serialized identities are not accepted. */
export function readLoadedReviewContent(
  loadedReview: LoadedReview,
  filePath: string,
  side: 'old' | 'new',
  options: SnapshotReadOptions = {}
): Promise<SnapshotReadResult> {
  const state = loadedReviewState(loadedReview);
  return readReviewedContent(
    { sourceIdentity: state.identity, reviewedPaths: state.reviewedPaths, loadedReview },
    filePath,
    side,
    options
  );
}

async function readSide(
  descriptor: ReviewSourceSide,
  sourceRoot: string,
  relativePath: string,
  maxBytes: number,
  options: SnapshotReadOptions,
  capture?: PhysicalCapture
): Promise<SnapshotReadResult> {
  switch (descriptor.kind) {
    case 'working-tree':
    case 'directory':
      return readPhysicalFile(sourceRoot, relativePath, maxBytes, options, capture);
    case 'file': {
      // Walked from the filesystem root: the path was physical at load, so any link now is new.
      const fsRoot = path.parse(descriptor.path).root;
      return readPhysicalFile(
        fsRoot,
        path.relative(fsRoot, descriptor.path),
        maxBytes,
        options,
        capture
      );
    }
    case 'index':
      // `:path` alone would read a leading `<n>:` in the path as a stage number.
      return readGitBlob(sourceRoot, `:0:${relativePath}`, maxBytes, options);
    case 'commit':
      return readGitBlob(sourceRoot, `${descriptor.sha}:${relativePath}`, maxBytes, options);
    case 'none':
      return failure('side-unavailable', 'This side of the review has no content.');
    case 'unknown':
      return failure(
        'side-unavailable',
        `This side of the review could not be identified: ${descriptor.reason}.`
      );
  }
}

async function readPhysicalFile(
  root: string,
  relativePath: string,
  maxBytes: number,
  options: SnapshotReadOptions,
  capture?: PhysicalCapture
): Promise<SnapshotReadResult> {
  try {
    if (capture && options.readFs && options.readFs !== capture.readFs)
      return failure('read-failed', RELOAD_REVIEW);
    const layer = options.readFs ?? capture?.readFs ?? nodeReadFsLayer;
    const target = path.join(root, relativePath);
    const verify = async () => {
      if (
        capture &&
        (capture.target !== target || sourceStamp(await layer.lstat(target)) !== capture.stamp)
      ) {
        throw new Error(RELOAD_REVIEW);
      }
    };
    await verify();
    const observation = captureSourceReads(layer, options.signal);
    const content = await readContainedFileBounded(
      root,
      relativePath,
      maxBytes,
      observation.readFs,
      options.signal
    );
    if (capture && observation.captures.get(target)?.stamp !== capture.stamp)
      throw new Error(RELOAD_REVIEW);
    await verify();
    return { ok: true, content };
  } catch (error) {
    if (options.signal?.aborted)
      throw new CommandCancelledError('aborted', 'self-review', ['read-reviewed-content']);
    const fsError = toSafeFsError(error, relativePath, 'read');
    if (capture && fsError.code !== 'too-large') return failure('read-failed', RELOAD_REVIEW);
    const [reason, message = fsError.message] = FS_FAILURES[fsError.code] ?? ['read-failed'];
    return failure(reason, message);
  }
}

const FS_FAILURES: Partial<Record<SafeFsErrorCode, [SnapshotReadFailure, string?]>> = {
  'not-found': ['not-found', 'The file does not exist on this side of the review.'],
  'unsafe-link': ['unsafe-link', 'The path goes through a symbolic link.'],
  'output-is-directory': ['not-regular', 'The path is a directory.'],
  'not-regular': ['not-regular', 'The path is not a regular file.'],
  'unsupported-target': ['invalid-path', 'This path does not stay inside the reviewed source.'],
  'too-large': ['too-large'],
};

/** `cat-file blob`, not `show`: it refuses a tree and never smudges, so the bytes are the ones git compared. */
async function readGitBlob(
  root: string,
  spec: string,
  maxBytes: number,
  options: SnapshotReadOptions
): Promise<SnapshotReadResult> {
  try {
    const result = await (options.runner ?? runBufferedCommand)('git', ['cat-file', 'blob', spec], {
      cwd: root,
      maxOutputBytes: maxBytes + 1,
      timeoutMs: options.timeoutMs ?? 30_000,
      signal: options.signal,
    });
    if (result.exitCode !== 0) {
      const detail = result.stderr.toString('utf-8').trim();
      if (/does not exist|not a valid object name|invalid object name|not a blob/i.test(detail)) {
        return failure('not-found', 'The file does not exist on this side of the review.');
      }
      return failure('read-failed', `git cat-file failed: ${detail || `exit ${result.exitCode}`}`);
    }
    if (result.stdout.length > maxBytes)
      return failure('too-large', `The blob is over the ${maxBytes}-byte limit.`);
    return { ok: true, content: result.stdout };
  } catch (error) {
    if (isCommandCancelled(error) && error.reason === 'aborted') throw error;
    if (errnoOf(error) === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
      return failure('too-large', `The blob is over the ${maxBytes}-byte limit.`);
    }
    return failure(
      'read-failed',
      `git cat-file failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
