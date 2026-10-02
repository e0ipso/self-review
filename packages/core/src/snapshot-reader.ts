// packages/core/src/snapshot-reader.ts
// The one place a reviewed path turns into bytes, read from the side the review compared (audit R13, A6).

import { execFile } from 'child_process';
import * as path from 'path';
import type { ReviewSourceIdentity, ReviewSourceSide } from './types';
import { MAX_SOURCE_FILE_BYTES } from './input-budgets';
import { errnoOf, readContainedFile, toSafeFsError } from './safe-fs';
import type { SafeFsErrorCode } from './safe-fs';
import { rootRelativeReviewedPath } from './source-identity';

export interface ReviewedSnapshot {
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
    case 'file': {
      // Walked from the filesystem root: the path was physical at load, so any link now is new.
      const fsRoot = path.parse(descriptor.path).root;
      return readPhysicalFile(fsRoot, path.relative(fsRoot, descriptor.path), maxBytes);
    }
    case 'index':
      // `:path` alone would read a leading `<n>:` in the path as a stage number.
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

async function readPhysicalFile(
  root: string,
  relativePath: string,
  maxBytes: number
): Promise<SnapshotReadResult> {
  try {
    return { ok: true, content: await readContainedFile(root, relativePath, maxBytes) };
  } catch (error) {
    const fsError = toSafeFsError(error, relativePath, 'read');
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
