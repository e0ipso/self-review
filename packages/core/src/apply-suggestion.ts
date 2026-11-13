// apply-suggestion.ts
// Writes one anchored suggestion into one working file, or refuses and
// writes nothing. Node-only, Electron-free, and free of process-global
// state: the caller names the destination root, so nothing here ever
// consults `process.cwd()`.
//
// The engine is deliberately narrow. It performs a byte-for-byte context
// check and a literal line replacement — no fuzzy matching, no force flag,
// no staging, no git. Every outcome is reported: a refusal names its reason
// and leaves the file untouched (PRD Section 5.4.8). Containment and the
// transactional write live here, not in a transport (audit A3/A4, R04).

import * as path from 'path';
import { constants as bufferConstants } from 'node:buffer';
import { MAX_SOURCE_FILE_BYTES } from './input-budgets';
import { prepareSuggestionContent } from './suggestion-content';
import { readSuggestionSync, boundedChunks } from './suggestion-read';
import { atomicReplaceAsync, nodeAsyncFsLayer, openContainedFileAsync } from './safe-fs-async';
import type { AsyncFsLayer } from './safe-fs-async';
import type { LineRange, Suggestion } from './types';
import { validateLineRange } from './anchor-validation';
import {
  atomicReplace,
  errnoOf,
  nodeFsLayer,
  openContainedFile,
  snapshotIdentity,
  toSafeFsError,
} from './safe-fs';
import type { FileIdentity, FsLayer, SafeFsErrorCode } from './safe-fs';

/**
 * Why an apply was refused. Every value is a structural fact about the
 * request or the file — never a fragment of the file's contents, so a
 * refusal is safe to surface in the UI and in logs.
 */
export type ApplyRefusalReason =
  /** The suggestion is file-level: there is nothing to replace. */
  | 'no-anchor'
  /**
   * The anchor names deleted lines (`side: 'old'`). Those lines are not in
   * the working file, and the app holds no old→new line mapping, so the
   * target is undefined rather than merely missing.
   */
  | 'old-side-anchor'
  /** Unknown side, non-positive or non-integer bounds, or reversed; checked before any I/O. */
  | 'invalid-anchor'
  /** `destinationRoot` is relative; resolving it would consult the cwd. */
  | 'destination-not-absolute'
  | 'destination-missing'
  /** `filePath` resolves outside `destinationRoot`. */
  | 'path-escapes-destination'
  | 'control-file'
  /** A link on the way or at the leaf, a hard-linked or special file, or a swap during the open. */
  | 'unsafe-target'
  /** Replacing the file would change its owner, which this process cannot restore. */
  | 'unsupported-target'
  /** No file at the resolved path. */
  | 'file-missing'
  /** The path exists but could not be read (permissions, a directory, …). */
  | 'file-unreadable'
  /**
   * The file is not valid UTF-8. Rewriting it would round-trip its bytes
   * through a lossy decode and corrupt regions outside the anchor.
   */
  | 'file-not-utf8'
  /** The anchor falls outside the file's line count. */
  | 'anchor-out-of-range'
  /** The anchored lines no longer match `suggestion.originalCode`. */
  | 'context-mismatch'
  /** The file was replaced or rewritten between the read and the commit. */
  | 'file-changed'
  /** The context matched but the write itself failed. */
  | 'write-failed';

export interface ApplySuggestionRequest {
  /**
   * Absolute path of the directory the reviewed files live in. Always
   * supplied by the caller: a git-mode working tree, a directory-mode root,
   * a reused clone, or the destination the user picked for a temporary-clone
   * review. Never derived here.
   */
  destinationRoot: string;
  /** Path of the file to modify, relative to `destinationRoot`. */
  filePath: string;
  /** The comment's anchor. `null` (file-level) is refused. */
  lineRange: LineRange | null;
  suggestion: Suggestion;
}

export interface ApplySuggestionOptions {
  fs?: FsLayer;
  randomName?: () => string;
  /** Input and resulting output limits, independently enforced. Both default to 5 MiB. */
  maxInputBytes?: number;
  maxOutputBytes?: number;
  /** Last synchronous authorization check before rename; throwing refuses the write. */
  beforeCommit?: () => void;
}

export interface ApplySuggestionAsyncOptions extends Omit<ApplySuggestionOptions, 'fs'> {
  fs?: AsyncFsLayer;
  /** Check the resolved physical root after resolution and before staging, before any write. */
  validateDestination?: (physicalRoot: string) => void;
  /** Cancellation rejects with signal.reason before commit. A committed write stays applied. */
  signal?: AbortSignal;
}

export interface ApplySuggestionApplied {
  status: 'applied';
  /** Echoed from the request, so a batch caller can attribute the result. */
  filePath: string;
  absolutePath: string;
  /** How many on-disk lines the proposal replaced. */
  replacedLines: number;
}

export interface ApplySuggestionRefused {
  status: 'refused';
  filePath: string;
  reason: ApplyRefusalReason;
  /** One sentence naming the refusal, safe to show to the reviewer. */
  detail: string;
}

export type ApplySuggestionResult = ApplySuggestionApplied | ApplySuggestionRefused;

/**
 * A `.git` segment at any depth, directory or worktree file: git executes what is in there. `.gitmodules`
 * and the like are reviewed content, gated by diff membership in the session handler instead.
 */
export function isRepositoryControlPath(filePath: string): boolean {
  return filePath.split(/[\\/]+/).some(segment => segment.toLowerCase() === '.git');
}

function refuse(
  filePath: string,
  reason: ApplyRefusalReason,
  detail: string
): ApplySuggestionRefused {
  return { status: 'refused', filePath, reason, detail };
}

const FS_REFUSALS: Partial<Record<SafeFsErrorCode, [ApplyRefusalReason, string]>> = {
  'not-found': ['file-missing', 'The file is not in the destination directory.'],
  'unsafe-link': [
    'unsafe-target',
    'The path goes through a symbolic link, and this program does not write through links.',
  ],
  'not-regular': ['unsafe-target', 'The path is not a regular file.'],
  'output-is-directory': ['file-unreadable', 'The path is a directory, not a file.'],
  'unsupported-target': [
    'unsupported-target',
    'The file is owned by another user, and replacing it would change its owner.',
  ],
  'identity-changed': [
    'file-changed',
    'The file changed on disk after it was read, so nothing was written.',
  ],
};

function refuseFsError(
  filePath: string,
  error: unknown,
  fallback: 'file-unreadable' | 'write-failed'
): ApplySuggestionRefused {
  const fsError = toSafeFsError(error, filePath, 'access');
  if (fsError.code === 'too-large') return refuse(filePath, fallback, fsError.message);
  const [reason, detail] = FS_REFUSALS[fsError.code] ?? [
    fallback,
    `The file could not be ${fallback === 'write-failed' ? 'written' : 'read'} (${errnoOf(fsError.cause) ?? 'unknown'}).`,
  ];
  return refuse(filePath, reason, detail);
}

/** Purely lexical, so an escape is refused before the filesystem is consulted. */
function relativeWithinRoot(filePath: string): string | null {
  if (filePath === '' || path.posix.isAbsolute(filePath) || path.win32.isAbsolute(filePath)) {
    return null;
  }
  if (filePath.split('/').some(segment => segment === '..')) return null;
  const normalized = path.posix.normalize(filePath);
  if (normalized === '.' || normalized === '..' || normalized.startsWith('../')) return null;
  return normalized;
}

interface OpenedTarget {
  identity: FileIdentity;
  buffer: Buffer;
}

/** Read through the descriptor that was checked, so the bytes compared are the recorded inode's. */
function openAndRead(
  realRoot: string,
  rel: string,
  filePath: string,
  fs: FsLayer,
  maxInputBytes: number
): OpenedTarget | ApplySuggestionRefused {
  let opened: ReturnType<typeof openContainedFile>;
  try {
    opened = openContainedFile(realRoot, rel, fs);
  } catch (error) {
    return refuseFsError(filePath, error, 'file-unreadable');
  }
  const { fd, stats } = opened;
  try {
    if (stats.nlink > 1) {
      return refuse(
        filePath,
        'unsafe-target',
        `The file has ${stats.nlink} hard links, and replacing it would silently detach the others.`
      );
    }
    return {
      identity: snapshotIdentity(stats),
      buffer: readSuggestionSync(fd, path.join(realRoot, rel), stats.size, maxInputBytes, fs),
    };
  } catch (error) {
    return refuseFsError(filePath, error, 'file-unreadable');
  } finally {
    try {
      fs.closeSync(fd);
    } catch {
      // Read-only descriptor; nothing depends on the close.
    }
  }
}

/**
 * Apply one anchored suggestion to one file under `destinationRoot`.
 *
 * On a byte-for-byte match between the anchored lines and
 * `suggestion.originalCode`, the anchored lines are replaced with
 * `suggestion.proposedCode` and the file is rewritten. Lines outside the
 * anchor keep their exact bytes, including their line terminators, and the
 * file's trailing-newline state is preserved either way. Any other outcome
 * refuses with a reason and writes nothing.
 */
function validateRequest(
  request: ApplySuggestionRequest
): { rel: string; start: number; end: number } | ApplySuggestionRefused {
  const { destinationRoot, filePath, lineRange } = request;
  if (!lineRange) {
    return refuse(
      filePath,
      'no-anchor',
      'This suggestion is file-level, so there are no lines to replace.'
    );
  }
  if (lineRange.side === 'old') {
    return refuse(
      filePath,
      'old-side-anchor',
      'This suggestion is anchored to deleted lines, which are not in the working file.'
    );
  }
  if (lineRange.side !== 'new') {
    return refuse(filePath, 'invalid-anchor', 'The anchor does not name a side of the diff.');
  }
  const anchor = validateLineRange(lineRange);
  if (!anchor.ok) {
    return refuse(
      filePath,
      'invalid-anchor',
      `The anchor is not a usable range: ${anchor.reason}.`
    );
  }
  const { start, end } = anchor.anchor;

  if (!path.isAbsolute(destinationRoot)) {
    return refuse(
      filePath,
      'destination-not-absolute',
      'The destination directory must be an absolute path.'
    );
  }
  const rel = relativeWithinRoot(filePath);
  if (rel === null) {
    return refuse(
      filePath,
      'path-escapes-destination',
      'The file path resolves outside the destination directory.'
    );
  }
  if (isRepositoryControlPath(rel)) {
    return refuse(
      filePath,
      'control-file',
      'The path is repository metadata (.git), which is never part of a review.'
    );
  }

  return { rel, start, end };
}

/** Invalid limit options throw RangeError, before any file is opened. */
function limits(options: Pick<ApplySuggestionOptions, 'maxInputBytes' | 'maxOutputBytes'>) {
  const maxInputBytes = options.maxInputBytes ?? MAX_SOURCE_FILE_BYTES;
  const maxOutputBytes = options.maxOutputBytes ?? MAX_SOURCE_FILE_BYTES;
  for (const [name, value] of Object.entries({ maxInputBytes, maxOutputBytes })) {
    if (!Number.isSafeInteger(value) || value < 0 || value >= bufferConstants.MAX_LENGTH) {
      throw new RangeError(
        `${name} must be a nonnegative safe integer below ${bufferConstants.MAX_LENGTH}`
      );
    }
  }
  return { maxInputBytes, maxOutputBytes };
}

/**
 * Bounded synchronous Apply for existing callers. Only the anchor is decoded and proposal encoded;
 * untouched regions are copied as bytes. Invalid options throw RangeError; refusals are values.
 */
export function applySuggestion(
  request: ApplySuggestionRequest,
  options: ApplySuggestionOptions = {}
): ApplySuggestionResult {
  const checked = validateRequest(request);
  if ('status' in checked) return checked;
  const { rel, start, end } = checked;
  const { destinationRoot, filePath, suggestion } = request;
  const fs = options.fs ?? nodeFsLayer;
  const { maxInputBytes, maxOutputBytes } = limits(options);

  let realRoot: string;
  try {
    realRoot = fs.realpathSync(path.resolve(destinationRoot));
  } catch (error) {
    return refuse(
      filePath,
      'destination-missing',
      `The destination directory could not be resolved (${errnoOf(error) ?? 'unknown'}).`
    );
  }
  const absolutePath = path.join(realRoot, rel);

  const opened = openAndRead(realRoot, rel, filePath, fs, maxInputBytes);
  if ('status' in opened) return opened;
  const { identity, buffer } = opened;

  const prepared = prepareSuggestionContent(buffer, start, end, suggestion, maxOutputBytes);
  if ('reason' in prepared) return refuse(filePath, prepared.reason, prepared.detail);

  try {
    atomicReplace(absolutePath, prepared.bytes, {
      fs,
      preserveMode: true,
      preserveOwner: true,
      expectedIdentity: identity,
      expectUnmodified: true,
      randomName: options.randomName,
      beforeCommit: options.beforeCommit,
    });
  } catch (error) {
    return refuseFsError(filePath, error, 'write-failed');
  }

  return { status: 'applied', filePath, absolutePath, replacedLines: prepared.replacedLines };
}

/**
 * Promise-based Apply with the same byte budgets, validation and replacement policy as Apply.
 * Bulk reads and writes use native asynchronous I/O in chunks of at most 64 KiB. Operations are
 * independent; competing applies are checked against the inode/stamp they read, not serialized.
 * Cancellation rejects before commit and removes staging. After rename it returns applied even
 * if the signal aborts. The portable final check/rename race is documented in atomicReplaceAsync.
 */
export async function applySuggestionAsync(
  request: ApplySuggestionRequest,
  options: ApplySuggestionAsyncOptions = {}
): Promise<ApplySuggestionResult> {
  options = { ...options };
  options.signal?.throwIfAborted();
  // Capture caller-owned data before the first await.
  request = {
    ...request,
    lineRange: request.lineRange && { ...request.lineRange },
    suggestion: { ...request.suggestion },
  };
  const checked = validateRequest(request);
  if ('status' in checked) return checked;
  const { rel, start, end } = checked;
  const { destinationRoot, filePath, suggestion } = request;
  const { maxInputBytes, maxOutputBytes } = limits(options);
  const layer = options.fs ?? nodeAsyncFsLayer;
  let realRoot: string;
  try {
    realRoot = await layer.realpath(path.resolve(destinationRoot));
    options.signal?.throwIfAborted();
  } catch (error) {
    options.signal?.throwIfAborted();
    return refuse(
      filePath,
      'destination-missing',
      `The destination directory could not be resolved (${errnoOf(error) ?? 'unknown'}).`
    );
  }
  const absolutePath = path.join(realRoot, rel);
  try {
    options.validateDestination?.(realRoot);
  } catch (error) {
    options.signal?.throwIfAborted();
    return refuseFsError(filePath, error, 'write-failed');
  }
  let opened: Awaited<ReturnType<typeof openContainedFileAsync>>;
  try {
    opened = await openContainedFileAsync(realRoot, rel, layer, options.signal);
  } catch (error) {
    options.signal?.throwIfAborted();
    return refuseFsError(filePath, error, 'file-unreadable');
  }
  const { handle, stats } = opened;
  let buffer: Buffer;
  try {
    if (stats.nlink > 1)
      return refuse(
        filePath,
        'unsafe-target',
        `The file has ${stats.nlink} hard links, and replacing it would silently detach the others.`
      );
    const chunks = boundedChunks(absolutePath, stats.size, maxInputBytes);
    let step = chunks.next();
    while (!step.done) {
      options.signal?.throwIfAborted();
      const { buffer, offset, length } = step.value;
      const { bytesRead } = await handle.read(buffer, offset, length, null);
      options.signal?.throwIfAborted();
      step = chunks.next(bytesRead);
    }
    buffer = step.value;
  } catch (error) {
    options.signal?.throwIfAborted();
    return refuseFsError(filePath, error, 'file-unreadable');
  } finally {
    try {
      await handle.close();
    } catch {
      /* Read-only descriptor; no commit depends on close. */
    }
    options.signal?.throwIfAborted();
  }
  options.signal?.throwIfAborted();
  const prepared = prepareSuggestionContent(buffer, start, end, suggestion, maxOutputBytes);
  if ('reason' in prepared) return refuse(filePath, prepared.reason, prepared.detail);
  try {
    options.validateDestination?.(realRoot);
    await atomicReplaceAsync(absolutePath, prepared.bytes, {
      fs: layer,
      preserveMode: true,
      preserveOwner: true,
      expectedIdentity: snapshotIdentity(stats),
      expectUnmodified: true,
      randomName: options.randomName,
      signal: options.signal,
      beforeCommit: options.beforeCommit,
    });
  } catch (error) {
    options.signal?.throwIfAborted();
    return refuseFsError(filePath, error, 'write-failed');
  }
  return { status: 'applied', filePath, absolutePath, replacedLines: prepared.replacedLines };
}
