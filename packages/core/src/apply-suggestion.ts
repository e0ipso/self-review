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

/**
 * Split file text into lines, keeping each line's own bytes intact.
 *
 * The split is on `\n` only, so a CRLF file's `\r` stays at the end of the
 * line it terminates. That makes the comparison against `originalCode`
 * byte-exact (the diff parser hands the same `\r` through in `DiffLine`),
 * and it means rejoining preserves mixed line endings exactly as found.
 */
function splitLines(content: string): string[] {
  if (content === '') return [];
  const lines = content.split('\n');
  // A trailing terminator produces an empty final element that is not a line.
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/** One trailing `\n` or `\r\n` terminates rather than adds a line; `''` is zero lines (a deletion). */
function proposalLines(proposedCode: string): string[] {
  if (proposedCode === '') return [];
  const body = proposedCode.endsWith('\r\n')
    ? proposedCode.slice(0, -2)
    : proposedCode.endsWith('\n')
      ? proposedCode.slice(0, -1)
      : proposedCode;
  return body.split('\n');
}

/**
 * True when every line being replaced carries a CRLF terminator. Only then
 * is it unambiguous that a hand-typed LF proposal should be written back as
 * CRLF; a mixed or LF region takes the proposal verbatim.
 */
function isCrlfRegion(anchored: string[]): boolean {
  return anchored.length > 0 && anchored.every(line => line.endsWith('\r'));
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
  fs: FsLayer
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
    return { identity: snapshotIdentity(stats), buffer: fs.readFileSync(fd) };
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
export function applySuggestion(
  request: ApplySuggestionRequest,
  options: ApplySuggestionOptions = {}
): ApplySuggestionResult {
  const { destinationRoot, filePath, lineRange, suggestion } = request;
  const fs = options.fs ?? nodeFsLayer;

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

  const opened = openAndRead(realRoot, rel, filePath, fs);
  if ('status' in opened) return opened;
  const { identity, buffer } = opened;

  const content = buffer.toString('utf8');
  if (!Buffer.from(content, 'utf8').equals(buffer)) {
    return refuse(filePath, 'file-not-utf8', 'The file is not valid UTF-8 text.');
  }

  const lines = splitLines(content);
  if (end > lines.length) {
    return refuse(
      filePath,
      'anchor-out-of-range',
      `Lines ${start}-${end} are outside this file, which has ${lines.length} line(s).`
    );
  }

  const anchored = lines.slice(start - 1, end);
  if (anchored.join('\n') !== suggestion.originalCode) {
    return refuse(
      filePath,
      'context-mismatch',
      `Lines ${start}-${end} no longer match the code this suggestion was written against.`
    );
  }

  const proposed = proposalLines(suggestion.proposedCode);
  const replacement = isCrlfRegion(anchored)
    ? proposed.map(line => (line.endsWith('\r') ? line : `${line}\r`))
    : proposed;
  const updated = [...lines.slice(0, start - 1), ...replacement, ...lines.slice(end)];
  const output =
    updated.length === 0 ? '' : updated.join('\n') + (content.endsWith('\n') ? '\n' : '');

  try {
    atomicReplace(absolutePath, Buffer.from(output, 'utf8'), {
      fs,
      preserveMode: true,
      preserveOwner: true,
      expectedIdentity: identity,
      expectUnmodified: true,
      randomName: options.randomName,
    });
  } catch (error) {
    return refuseFsError(filePath, error, 'write-failed');
  }

  return { status: 'applied', filePath, absolutePath, replacedLines: anchored.length };
}
