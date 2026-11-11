// Shared replacement policy for synchronous and asynchronous filesystem adapters.
import type * as nodeFs from 'node:fs';

export type SafeFsErrorCode =
  | 'output-is-directory'
  /** EACCES, EPERM or EROFS. */
  | 'permission-denied'
  /** ENOSPC or EDQUOT. */
  | 'no-space'
  /** A symlink sits where this module would read, create or replace a file, or on the way to it. */
  | 'unsafe-link'
  /** Exists, but replacing it would change semantics: hard-linked, not a regular file, or foreign-owned. */
  | 'unsupported-target'
  /** The file at the target is not the one the caller checked. */
  | 'identity-changed'
  /** ENOENT or ENOTDIR. */
  | 'not-found'
  /** A FIFO, socket or device. */
  | 'not-regular'
  | 'too-large'
  | 'io-error';

export class SafeFsError extends Error {
  readonly code: SafeFsErrorCode;
  readonly path: string;
  readonly cause?: unknown;

  constructor(code: SafeFsErrorCode, path: string, message: string, cause?: unknown) {
    super(message);
    this.name = 'SafeFsError';
    this.code = code;
    this.path = path;
    if (cause !== undefined) this.cause = cause;
  }
}

export interface FileIdentity {
  dev: number;
  ino: number;
  /** Permission bits only (`mode & 0o7777`). */
  mode: number;
  nlink: number;
  size: number;
  mtimeMs: number;
  uid: number;
  gid: number;
}

export function snapshotIdentity(stats: nodeFs.Stats): FileIdentity {
  return {
    dev: stats.dev,
    ino: stats.ino,
    mode: stats.mode & 0o7777,
    nlink: stats.nlink,
    size: stats.size,
    mtimeMs: stats.mtimeMs,
    uid: stats.uid,
    gid: stats.gid,
  };
}

export function sameFile(a: FileIdentity, b: FileIdentity): boolean {
  return a.dev === b.dev && a.ino === b.ino;
}

/** A rewrite within the filesystem's timestamp granularity passes; callers compare content too. */
export function sameStamp(a: FileIdentity, b: FileIdentity): boolean {
  return a.size === b.size && a.mtimeMs === b.mtimeMs;
}

const ERRNO_CODES = new Map<string, SafeFsErrorCode>([
  ['ENOENT', 'not-found'],
  ['ENOTDIR', 'not-found'],
  ['EISDIR', 'output-is-directory'],
  ['EACCES', 'permission-denied'],
  ['EPERM', 'permission-denied'],
  ['EROFS', 'permission-denied'],
  ['ENOSPC', 'no-space'],
  ['EDQUOT', 'no-space'],
  ['ELOOP', 'unsafe-link'],
]);

/** The code a caller maps to its own reason; anything unknown is `io-error`. */
export function classifyFsError(error: unknown): SafeFsErrorCode {
  return ERRNO_CODES.get(errnoOf(error) ?? '') ?? 'io-error';
}

export function errnoOf(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

/** Wrap a raw fs failure, passing a `SafeFsError` through untouched. */
export function toSafeFsError(error: unknown, filePath: string, action: string): SafeFsError {
  if (error instanceof SafeFsError) return error;
  const reason = error instanceof Error ? error.message : String(error);
  return new SafeFsError(
    classifyFsError(error),
    filePath,
    `Cannot ${action} ${filePath}: ${reason}`,
    error
  );
}

export function guarded<T>(filePath: string, action: string, fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    throw toSafeFsError(error, filePath, action);
  }
}

/** Checked before staging and again after the temp file has been written and synced. */
export function assertExpectedTarget(
  target: string,
  existing: FileIdentity | null,
  options: {
    expectedIdentity?: FileIdentity;
    expectUnmodified?: boolean;
    preserveMode?: boolean;
    preserveOwner?: boolean;
  }
): void {
  const expected = options.expectedIdentity;
  if (expected && (!existing || !sameFile(existing, expected))) {
    throw new SafeFsError(
      'identity-changed',
      target,
      `Refusing to replace ${target}: it is no longer the file that was checked`
    );
  }
  if (
    expected &&
    existing &&
    ((options.preserveMode && expected.mode !== existing.mode) ||
      (options.preserveOwner && (expected.uid !== existing.uid || expected.gid !== existing.gid)))
  ) {
    throw new SafeFsError(
      'identity-changed',
      target,
      `Refusing to replace ${target}: its permissions or owner changed`
    );
  }
  if (expected && options.expectUnmodified && existing && !sameStamp(existing, expected)) {
    throw new SafeFsError(
      'identity-changed',
      target,
      `Refusing to replace ${target}: it was modified after it was checked`
    );
  }
}

/** Undefined when the new file already gets the right owner; only root may give one away. */
export function ownerToRestore(
  target: string,
  existing: FileIdentity
): { uid: number; gid: number } | undefined {
  if (typeof process.geteuid !== 'function' || typeof process.getegid !== 'function')
    return undefined;
  const me = { uid: process.geteuid(), gid: process.getegid() };
  if (existing.uid === me.uid && existing.gid === me.gid) return undefined;
  if (existing.uid !== me.uid && me.uid !== 0) {
    throw new SafeFsError(
      'unsupported-target',
      target,
      `Refusing to replace ${target}: it is owned by another user (uid ${existing.uid}), and replacing it would change its owner`
    );
  }
  return { uid: existing.uid, gid: existing.gid };
}

export function replacementIdentity(target: string, stats: nodeFs.Stats): FileIdentity {
  if (stats.isSymbolicLink()) {
    throw new SafeFsError(
      'unsafe-link',
      target,
      `Refusing to write ${target}: it is a symbolic link, and this program does not follow links when saving`
    );
  }
  if (stats.isDirectory()) {
    throw new SafeFsError(
      'output-is-directory',
      target,
      `Cannot write ${target}: it is a directory`
    );
  }
  if (!stats.isFile()) {
    throw new SafeFsError(
      'unsupported-target',
      target,
      `Cannot write ${target}: it exists but is not a regular file`
    );
  }
  // A rename would detach this name from the other links.
  if (stats.nlink > 1) {
    throw new SafeFsError(
      'unsupported-target',
      target,
      `Refusing to replace ${target}: it has ${stats.nlink} hard links, and replacing it would silently detach the others`
    );
  }
  return snapshotIdentity(stats);
}
