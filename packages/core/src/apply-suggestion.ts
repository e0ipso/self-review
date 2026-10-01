// apply-suggestion.ts
// Writes one anchored suggestion into one working file, or refuses and
// writes nothing. Node-only, Electron-free, and free of process-global
// state: the caller names the destination root, so nothing here ever
// consults `process.cwd()`.
//
// The engine is deliberately narrow. It performs a byte-for-byte context
// check and a literal line replacement — no fuzzy matching, no force flag,
// no staging, no git. Every outcome is reported: a refusal names its reason
// and leaves the file untouched (PRD Section 5.4.8).
//
// Two properties are enforced here rather than in any transport, because
// this is the one place the bytes move (security audit A3/A4, R04):
//
// - Physical containment. The destination root is resolved with `realpath`,
//   every directory on the way to the file is `lstat`ed and refused if it is
//   a symlink, the file itself is opened `O_NOFOLLOW`, and only a regular
//   file with a single hard link is accepted. A path that names a repository
//   control file (any `.git` segment) is refused before any of that.
// - Transactional replacement. The original is read through the descriptor
//   that was inspected, the new content goes to a same-directory temp file
//   with the original's mode and owner, and `rename` swaps it in only after
//   the target is confirmed to still be the inspected inode, unmodified. A
//   failure at any point removes the temp file and leaves the target byte
//   for byte as it was, so "refused" is never reported after a mutation.
//
// Authorization against the reviewed diff (is this a file the reviewer
// looked at?) needs the session and lives in `review-handlers.ts`.

import * as path from 'path';
import { constants as fsConstants } from 'fs';
import type { LineRange, Suggestion } from './types';
import { validateLineRange } from './anchor-validation';
import {
  SafeFsError,
  assertNoSymlinkAncestors,
  atomicReplace,
  errnoOf,
  nodeFsLayer,
  openNoFollow,
  sameFile,
  snapshotIdentity,
} from './safe-fs';
import type { FileIdentity, FsLayer } from './safe-fs';

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
  /**
   * The anchor is not a usable line range: an unknown side, or a start or
   * end that is not a positive safe integer, or a reversed range. Checked
   * before any I/O.
   */
  | 'invalid-anchor'
  /** `destinationRoot` is relative; resolving it would consult the cwd. */
  | 'destination-not-absolute'
  /** `destinationRoot` does not exist (or cannot be resolved). */
  | 'destination-missing'
  /** `filePath` is absolute, empty, or has a `..` segment: it does not stay under `destinationRoot`. */
  | 'path-escapes-destination'
  /** `filePath` names repository metadata (`.git` at any depth); see {@link isRepositoryControlPath}. */
  | 'control-file'
  /**
   * The path does not lead to a plain file inside the destination: a symlink
   * at the leaf or on an ancestor, a file with more than one hard link, a
   * special file, or a file that was swapped while it was being opened.
   */
  | 'unsafe-target'
  /** The file exists but replacing it would change its owner, which this process cannot restore. */
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
  /** Path of the file to modify, relative to `destinationRoot`, with `/` separators. */
  filePath: string;
  /** The comment's anchor. `null` (file-level) is refused. */
  lineRange: LineRange | null;
  suggestion: Suggestion;
}

export interface ApplySuggestionOptions {
  /** Filesystem layer; injectable so a test can fail a write mid-way. */
  fs?: FsLayer;
  /** Random component of the temp file name; injectable for tests. */
  randomName?: () => string;
}

export interface ApplySuggestionApplied {
  status: 'applied';
  /** Echoed from the request, so a batch caller can attribute the result. */
  filePath: string;
  /** The physical path that was rewritten (under the resolved destination root). */
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

const { O_RDONLY } = fsConstants;

/**
 * True when `filePath` names repository metadata rather than content: any
 * segment equal to `.git` (case-insensitively), at any depth. That covers
 * the repository's own `.git/` directory, a nested repository's, and the
 * `.git` *file* a linked worktree or submodule checkout carries, all of
 * which git acts on (`config` can name a command to run, `hooks/` are
 * executables) and none of which are ever part of a reviewed diff.
 *
 * Tracked files that merely influence git — `.gitmodules`, `.gitattributes`,
 * `.gitignore` — are content: they appear in diffs and are reviewed like any
 * other file, so they are not control paths here. Membership in the reviewed
 * diff (checked by the session handler) is what gates them.
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

/** The errno behind a failure, looking through a `SafeFsError` to its cause. */
function underlyingErrno(error: unknown): string | undefined {
  return error instanceof SafeFsError ? errnoOf(error.cause) : errnoOf(error);
}

/**
 * The session-relative path in normalized POSIX form, or null when it is
 * not one: absolute, empty, or carrying a `..` segment. Purely lexical, so a
 * refusal here happens before the filesystem is consulted.
 */
function relativeWithinRoot(filePath: string): string | null {
  if (filePath === '' || path.posix.isAbsolute(filePath) || path.win32.isAbsolute(filePath)) {
    return null;
  }
  if (filePath.split('/').some(segment => segment === '..')) return null;
  const normalized = path.posix.normalize(filePath);
  if (normalized === '.' || normalized === '..' || normalized.startsWith('../')) return null;
  return normalized;
}

/** True when `candidate` sits strictly beneath `root` (both already real paths). */
function isBeneath(root: string, candidate: string): boolean {
  const rel = path.relative(root, candidate);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
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

/**
 * The lines a proposal stands for. `proposedCode` is lines joined by `\n`,
 * the same shape as `originalCode`; one trailing line terminator (`\n` or
 * `\r\n`) is a terminator rather than an extra empty line, so `'x'` and
 * `'x\n'` are both one line while `'x\n\n'` is `x` followed by an empty
 * line. The empty string is zero lines: the anchored lines are deleted and
 * nothing is put in their place.
 */
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

/**
 * Open the target no-follow, confirm it is a plain file inside `realRoot`,
 * and read it through that same descriptor, so the bytes compared are the
 * bytes of the inode whose identity is recorded.
 */
function openAndRead(
  realRoot: string,
  absolutePath: string,
  filePath: string,
  fs: FsLayer
): OpenedTarget | ApplySuggestionRefused {
  let fd: number;
  try {
    fd = openNoFollow(absolutePath, O_RDONLY, 0, fs);
  } catch (error) {
    if (error instanceof SafeFsError && error.code === 'unsafe-link') {
      return refuse(
        filePath,
        'unsafe-target',
        'The file is a symbolic link, and this program does not write through links.'
      );
    }
    const code = underlyingErrno(error);
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      return refuse(filePath, 'file-missing', 'The file is not in the destination directory.');
    }
    return refuse(
      filePath,
      'file-unreadable',
      `The file could not be opened (${code ?? 'unknown'}).`
    );
  }

  try {
    const stats = fs.fstatSync(fd);
    if (stats.isDirectory()) {
      return refuse(filePath, 'file-unreadable', 'The path is a directory, not a file.');
    }
    if (!stats.isFile()) {
      return refuse(filePath, 'unsafe-target', 'The path is not a regular file.');
    }
    if (stats.nlink > 1) {
      return refuse(
        filePath,
        'unsafe-target',
        `The file has ${stats.nlink} hard links, and replacing it would silently detach the others.`
      );
    }
    const identity = snapshotIdentity(stats);
    // The name must still refer to the file that was opened, and its real
    // location must be beneath the real root: this closes the window in
    // which a directory on the way could have been swapped for a link.
    if (!sameFile(snapshotIdentity(fs.lstatSync(absolutePath)), identity)) {
      return refuse(filePath, 'unsafe-target', 'The file changed while it was being opened.');
    }
    if (!isBeneath(realRoot, fs.realpathSync(absolutePath))) {
      return refuse(
        filePath,
        'unsafe-target',
        'The file resolves outside the destination directory.'
      );
    }
    return { identity, buffer: fs.readFileSync(fd) };
  } catch (error) {
    return refuse(
      filePath,
      'file-unreadable',
      `The file could not be read (${underlyingErrno(error) ?? 'unknown'}).`
    );
  } finally {
    try {
      fs.closeSync(fd);
    } catch {
      // The descriptor is only for reading; nothing depends on the close.
    }
  }
}

/**
 * Apply one anchored suggestion to one file under `destinationRoot`.
 *
 * On a byte-for-byte match between the anchored lines and
 * `suggestion.originalCode`, the anchored lines are replaced with the lines
 * of `suggestion.proposedCode` (see `proposalLines`: an empty proposal
 * deletes the anchored lines; one trailing newline is a terminator) and the
 * file is rewritten in one `rename`. Lines outside the anchor keep their
 * exact bytes, including their line terminators; the file's trailing-newline
 * state is preserved, except that a file left with no lines at all is
 * empty. Any other outcome refuses with a reason and writes nothing.
 *
 * Order of checks: the anchor and the path are validated lexically before
 * the filesystem is consulted; then the destination is resolved and the
 * target opened under the containment policy described at the top of this
 * file; then the content is compared; and only then is the replacement
 * written, under the identity the open recorded.
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
      `The destination directory could not be resolved (${underlyingErrno(error) ?? 'unknown'}).`
    );
  }
  try {
    assertNoSymlinkAncestors(realRoot, rel, fs);
  } catch (error) {
    if (error instanceof SafeFsError && error.code === 'unsafe-link') {
      return refuse(
        filePath,
        'unsafe-target',
        'A directory on the way to the file is a symbolic link, and this program does not write through links.'
      );
    }
    if (error instanceof SafeFsError && error.code === 'unsupported-target') {
      return refuse(
        filePath,
        'path-escapes-destination',
        'The file path resolves outside the destination directory.'
      );
    }
    return refuse(
      filePath,
      'file-unreadable',
      `The path could not be inspected (${underlyingErrno(error) ?? 'unknown'}).`
    );
  }
  const absolutePath = path.join(realRoot, rel);

  const opened = openAndRead(realRoot, absolutePath, filePath, fs);
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
    if (error instanceof SafeFsError) {
      switch (error.code) {
        case 'identity-changed':
          return refuse(
            filePath,
            'file-changed',
            'The file changed on disk after it was read, so nothing was written.'
          );
        case 'unsafe-link':
        case 'output-is-directory':
          return refuse(
            filePath,
            'unsafe-target',
            'The path no longer leads to a plain file, so nothing was written.'
          );
        case 'unsupported-target':
          return refuse(
            filePath,
            'unsupported-target',
            'The file is owned by another user, and replacing it would change its owner.'
          );
        default:
          break;
      }
    }
    return refuse(
      filePath,
      'write-failed',
      `The file could not be written (${underlyingErrno(error) ?? 'unknown'}).`
    );
  }

  return { status: 'applied', filePath, absolutePath, replacedLines: anchored.length };
}
