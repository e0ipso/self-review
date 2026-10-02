// packages/core/src/snapshot-reader.ts
// Read the content of a reviewed file from the exact snapshot the review
// compared, and authorize a request-supplied path against the same source.
//
// Two things used to go wrong here, and both came from resolving paths on
// the fly. Previews and line counts read the working tree whatever the
// review was of, so a staged image preview showed the unstaged bytes
// (audit R13). And the serve front end contained paths under its launch
// directory while core opened them under the reviewed one, so a symlink in
// a directory review read a file outside it (audit A6). Now a session
// carries a `ReviewSourceIdentity`, this module is the one place a reviewed
// path turns into bytes, and every read names the side it wants: a commit
// blob, the index blob, or the working file opened without following links.

import { execFile } from 'child_process';
import { constants, realpathSync } from 'fs';
import * as path from 'path';
import type { ReviewSourceIdentity, ReviewSourceSide } from './types';
import { readFileWithinBudget } from './bounded-read';
import { MAX_SOURCE_FILE_BYTES } from './input-budgets';
import { SafeFsError, assertNoSymlinkAncestors, errnoOf } from './safe-fs';
import { rootRelativeReviewedPath } from './source-identity';

/** What a reader needs of a session: its identity and the paths it reviewed. */
export interface ReviewedSnapshot {
  sourceIdentity: ReviewSourceIdentity | null;
  reviewedPaths: ReadonlySet<string>;
}

export type ReviewedPathRefusal =
  /** The session has no source identity: nothing has been loaded. */
  | 'no-source'
  /** The committed diff never contained this path. */
  | 'not-reviewed'
  /** Absolute, empty, or leaving the source root. */
  | 'invalid-path';

export type ReviewedPathAuthorization =
  | {
      ok: true;
      /** The file under `sourceRoot`: the reviewed path restated from the root, normalized. */
      relativePath: string;
      sourceRoot: string;
    }
  | { ok: false; reason: ReviewedPathRefusal; message: string };

/**
 * Decide whether `filePath` names a file this session reviewed, and under
 * which root. This is the one path check every front end delegates to: a
 * path that passes here is the path the readers below open, so what was
 * authorized and what is read cannot diverge.
 *
 * The lexical checks run first, so an absolute path or a traversal is
 * refused as what it is whatever the set says; membership is then checked
 * on the path as sent, since the diff recorded it that way. The path handed
 * back is restated from the source root through the identity's prefix
 * (`rootRelativeReviewedPath`), so a `--relative` review of `sub/` reads
 * `sub/<path>` and never the root's same-named file.
 */
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

/**
 * `filePath` as a normalized relative path under the root, or null when it
 * is empty, absolute, contains a NUL, or climbs out. Diff paths are
 * `/`-separated whatever the platform; a backslash is an ordinary character.
 */
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
  /** No such file on that side. */
  | 'not-found'
  /** A directory, FIFO, socket or device. */
  | 'not-regular'
  /** A symbolic link sits at the path or on the way to it. */
  | 'unsafe-link'
  /** Larger than the byte budget. */
  | 'too-large'
  /** Any other failure, with its message. */
  | 'read-failed';

export type SnapshotReadResult =
  | { ok: true; content: Buffer }
  | { ok: false; reason: SnapshotReadFailure; message: string };

export interface SnapshotReadOptions {
  /** Most bytes to read. Defaults to `MAX_SOURCE_FILE_BYTES`. */
  maxBytes?: number;
}

function failure(reason: SnapshotReadFailure, message: string): SnapshotReadResult {
  return { ok: false, reason, message };
}

/**
 * The bytes of `filePath` on one side of the review: `git cat-file` of the
 * commit or index blob, or the working, scanned or named file opened under
 * the physical source root without following a symbolic link anywhere on
 * the way. Authorization runs first, so a path the review never contained
 * is refused before any side is consulted.
 */
export async function readReviewedContent(
  source: ReviewedSnapshot,
  filePath: string,
  side: 'old' | 'new',
  options: SnapshotReadOptions = {}
): Promise<SnapshotReadResult> {
  const authorized = authorizeReviewedPath(source, filePath);
  if (!authorized.ok) return failure(authorized.reason, authorized.message);
  const identity = source.sourceIdentity!;
  const descriptor = side === 'old' ? identity.oldSide : identity.newSide;
  const maxBytes = options.maxBytes ?? MAX_SOURCE_FILE_BYTES;
  return readSide(descriptor, authorized.sourceRoot, authorized.relativePath, maxBytes);
}

async function readSide(
  descriptor: ReviewSourceSide,
  sourceRoot: string,
  relativePath: string,
  maxBytes: number
): Promise<SnapshotReadResult> {
  switch (descriptor.kind) {
    case 'working-tree':
    case 'directory':
      return readPhysicalFile(sourceRoot, relativePath, maxBytes);
    case 'file':
      return readNamedFile(descriptor.path, maxBytes);
    case 'index':
      // Stage 0 explicitly: `:path` alone would read a leading `<n>:` in the
      // path as a stage number.
      return readGitBlob(sourceRoot, `:0:${relativePath}`, maxBytes);
    case 'commit':
      return readGitBlob(sourceRoot, `${descriptor.sha}:${relativePath}`, maxBytes);
    case 'none':
      return failure('side-unavailable', 'This side of the review has no content.');
    case 'unknown':
      return failure(
        'side-unavailable',
        `This side of the review could not be identified: ${descriptor.reason}.`
      );
  }
}

/** A regular file under `root`, with no symbolic link at the leaf or above it. */
async function readPhysicalFile(
  root: string,
  relativePath: string,
  maxBytes: number
): Promise<SnapshotReadResult> {
  try {
    assertNoSymlinkAncestors(root, relativePath);
  } catch (error) {
    return fromFsError(error, relativePath);
  }
  return readFileNoFollow(path.join(root, relativePath), maxBytes);
}

/**
 * The one file of a single-file review. Its physical path was resolved
 * when the review was loaded; if resolving it again lands elsewhere, a link
 * has been planted on the way since, and the file is not the one reviewed.
 */
async function readNamedFile(physicalPath: string, maxBytes: number): Promise<SnapshotReadResult> {
  try {
    if (realpathSync(physicalPath) !== physicalPath) {
      return failure('unsafe-link', 'The reviewed file is no longer where it was.');
    }
  } catch (error) {
    return fromFsError(error, physicalPath);
  }
  return readFileNoFollow(physicalPath, maxBytes);
}

async function readFileNoFollow(absolute: string, maxBytes: number): Promise<SnapshotReadResult> {
  try {
    const result = await readFileWithinBudget(absolute, maxBytes, { noFollow: true });
    switch (result.kind) {
      case 'ok':
        return { ok: true, content: result.content };
      case 'too-large':
        return failure(
          'too-large',
          `The file is ${result.size} bytes, over the ${maxBytes}-byte limit.`
        );
      case 'not-regular':
        return failure('not-regular', 'The path is not a regular file.');
    }
  } catch (error) {
    return fromFsError(error, absolute);
  }
}

function fromFsError(error: unknown, about: string): SnapshotReadResult {
  if (error instanceof SafeFsError) {
    if (error.code === 'unsafe-link') {
      return failure('unsafe-link', 'The path goes through a symbolic link.');
    }
    if (error.code === 'unsupported-target') {
      return failure('invalid-path', 'This path does not stay inside the reviewed source.');
    }
    return failure('read-failed', error.message);
  }
  switch (errnoOf(error)) {
    case 'ENOENT':
    case 'ENOTDIR':
      return failure('not-found', 'The file does not exist on this side of the review.');
    case 'ELOOP':
      return failure('unsafe-link', 'The path goes through a symbolic link.');
    case 'EISDIR':
      return failure('not-regular', 'The path is a directory.');
    default:
      return failure(
        'read-failed',
        `Cannot read ${about}: ${error instanceof Error ? error.message : String(error)}`
      );
  }
}

/**
 * One blob out of the object store, by `<sha>:<path>` or `:0:<path>`.
 * `cat-file blob` rather than `show`: it refuses a tree, and it never
 * applies a smudge filter, so the bytes are the ones git compared. Git runs
 * at the source root so a path is read relative to it, and `maxBuffer`
 * stops a blob past the budget before it is held in memory.
 */
function readGitBlob(root: string, spec: string, maxBytes: number): Promise<SnapshotReadResult> {
  return new Promise(resolve => {
    execFile(
      'git',
      ['cat-file', 'blob', spec],
      { cwd: root, encoding: 'buffer', maxBuffer: maxBytes + 1, timeout: 30_000 },
      (error, stdout, stderr) => {
        if (error) {
          if (errnoOf(error) === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
            resolve(failure('too-large', `The blob is over the ${maxBytes}-byte limit.`));
            return;
          }
          const detail = stderr.toString('utf-8').trim();
          if (
            /does not exist|not a valid object name|invalid object name|not a blob/i.test(detail)
          ) {
            resolve(failure('not-found', 'The file does not exist on this side of the review.'));
            return;
          }
          resolve(failure('read-failed', `git cat-file failed: ${detail || error.message}`));
          return;
        }
        if (stdout.length > maxBytes) {
          resolve(failure('too-large', `The blob is over the ${maxBytes}-byte limit.`));
          return;
        }
        resolve({ ok: true, content: stdout });
      }
    );
  });
}

/** The `O_NOFOLLOW` flag, re-exported so a host can open the same way. */
export const O_NOFOLLOW = constants.O_NOFOLLOW;
