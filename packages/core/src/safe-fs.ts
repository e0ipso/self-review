// packages/core/src/safe-fs.ts
// No-follow filesystem primitives every core reader and writer goes through. Linux and macOS only:
// Node does not define `O_NOFOLLOW` on Windows.

import * as nodeFs from 'node:fs';
import { randomBytes } from 'node:crypto';
import * as path from 'node:path';
import { READ_FLAGS, readDescriptorWithinBudget } from './bounded-read';
import { formatBytes } from './input-budgets';

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

/** The subset of `fs` used here, synchronous so a test can inject a failure at an exact step. */
export interface FsLayer {
  openSync(path: string, flags: number, mode?: number): number;
  /** May write fewer bytes than given, as the real one may. */
  writeSync(fd: number, buffer: Uint8Array): number;
  fsyncSync(fd: number): void;
  fchmodSync(fd: number, mode: number): void;
  fchownSync(fd: number, uid: number, gid: number): void;
  closeSync(fd: number): void;
  renameSync(from: string, to: string): void;
  unlinkSync(path: string): void;
  lstatSync(path: string): nodeFs.Stats;
  fstatSync(fd: number): nodeFs.Stats;
  readFileSync(fd: number): Buffer;
  mkdirSync(path: string, mode: number): void;
  realpathSync(path: string): string;
}

export const nodeFsLayer: FsLayer = {
  openSync: (p, flags, mode) => nodeFs.openSync(p, flags, mode),
  writeSync: (fd, buffer) => nodeFs.writeSync(fd, buffer),
  fsyncSync: fd => nodeFs.fsyncSync(fd),
  fchmodSync: (fd, mode) => nodeFs.fchmodSync(fd, mode),
  fchownSync: (fd, uid, gid) => nodeFs.fchownSync(fd, uid, gid),
  closeSync: fd => nodeFs.closeSync(fd),
  renameSync: (from, to) => nodeFs.renameSync(from, to),
  unlinkSync: p => nodeFs.unlinkSync(p),
  lstatSync: p => nodeFs.lstatSync(p),
  fstatSync: fd => nodeFs.fstatSync(fd),
  readFileSync: fd => nodeFs.readFileSync(fd),
  mkdirSync: (p, mode) => {
    nodeFs.mkdirSync(p, { mode });
  },
  realpathSync: p => nodeFs.realpathSync(p),
};

const { O_WRONLY, O_CREAT, O_EXCL, O_NOFOLLOW, O_RDONLY } = nodeFs.constants;

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

/** Best effort: a failure here is not worth reporting over the one in flight. */
function quietly(fn: () => void): void {
  try {
    fn();
  } catch {
    // Ignored.
  }
}

export function lstatOrNull(filePath: string, fs: FsLayer = nodeFsLayer): nodeFs.Stats | null {
  try {
    return fs.lstatSync(filePath);
  } catch (error) {
    if (errnoOf(error) === 'ENOENT') return null;
    throw toSafeFsError(error, filePath, 'inspect');
  }
}

/**
 * Refuse a `rel` whose directories under `root` include a symlink. The leaf is the caller's
 * policy, and a missing component ends the walk: nothing can be linked where nothing is.
 */
export function assertNoSymlinkAncestors(root: string, rel: string, fs: FsLayer = nodeFsLayer) {
  const normalized = path.normalize(rel);
  if (
    path.isAbsolute(normalized) ||
    normalized === '..' ||
    normalized.startsWith(`..${path.sep}`)
  ) {
    throw new SafeFsError(
      'unsupported-target',
      path.join(root, rel),
      `Refusing ${rel}: it does not stay under ${root}`
    );
  }
  let current = root;
  for (const segment of path.dirname(normalized).split(path.sep)) {
    if (!segment || segment === '.') continue;
    current = path.join(current, segment);
    const stats = lstatOrNull(current, fs);
    if (stats === null) return;
    if (stats.isSymbolicLink()) {
      throw new SafeFsError(
        'unsafe-link',
        current,
        `Refusing to go through ${current}: it is a symbolic link`
      );
    }
  }
}

/**
 * No link on the way or at the leaf, no FIFO blocking, regular files only. The walk and the open are
 * separate syscalls, so afterwards the name must still resolve under `root` to the opened inode.
 */
export function openContainedFile(
  root: string,
  rel: string,
  fs: FsLayer = nodeFsLayer
): { fd: number; stats: nodeFs.Stats } {
  assertNoSymlinkAncestors(root, rel, fs);
  const target = path.join(root, rel);
  const fd = guarded(target, 'open', () => fs.openSync(target, READ_FLAGS | O_NOFOLLOW));
  try {
    const stats = fs.fstatSync(fd);
    if (stats.isDirectory()) {
      throw new SafeFsError('output-is-directory', target, `${target} is a directory`);
    }
    if (!stats.isFile()) {
      throw new SafeFsError('not-regular', target, `${target} is not a regular file`);
    }
    if (
      !sameFile(fs.lstatSync(target), stats) ||
      fs.realpathSync(target) !== path.join(fs.realpathSync(root), rel)
    ) {
      throw new SafeFsError('unsafe-link', target, `${target} changed while it was being opened`);
    }
    return { fd, stats };
  } catch (error) {
    quietly(() => fs.closeSync(fd));
    throw toSafeFsError(error, target, 'open');
  }
}

/** Read the whole of a file {@link openContainedFile} accepts, if it fits `maxBytes`. */
export async function readContainedFile(
  root: string,
  rel: string,
  maxBytes: number
): Promise<Buffer> {
  const { fd, stats } = openContainedFile(root, rel);
  const target = path.join(root, rel);
  try {
    const read = await readDescriptorWithinBudget(fd, stats, maxBytes);
    if (read.kind === 'ok') return read.content;
    throw new SafeFsError(
      'too-large',
      target,
      `The file is ${formatBytes(read.size)}, over the ${formatBytes(maxBytes)} limit`
    );
  } catch (error) {
    throw toSafeFsError(error, target, 'read');
  } finally {
    nodeFs.closeSync(fd);
  }
}

export interface WriteExclusiveOptions {
  /** Masked by the umask. Default 0o666. */
  mode?: number;
  /** Applied after creation, bypassing the umask. */
  exactMode?: number;
  /** Applied after creation; failing to is `unsupported-target` and removes the file. */
  exactOwner?: { uid: number; gid: number };
  fs?: FsLayer;
}

/**
 * Create `filePath`, which must not exist, write every byte and sync. A symlink at the path,
 * dangling or not, is `unsafe-link`. Any failure after creation removes the file again.
 */
export function writeExclusiveNoFollow(
  filePath: string,
  bytes: Uint8Array,
  options: WriteExclusiveOptions = {}
): FileIdentity {
  const fs = options.fs ?? nodeFsLayer;
  let fd: number;
  try {
    fd = fs.openSync(filePath, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, options.mode ?? 0o666);
  } catch (error) {
    if (errnoOf(error) === 'EEXIST' && isSymlink(filePath, fs)) {
      throw new SafeFsError(
        'unsafe-link',
        filePath,
        `Refusing to write ${filePath}: a symbolic link already sits at that name`
      );
    }
    throw toSafeFsError(error, filePath, 'create');
  }

  try {
    let offset = 0;
    while (offset < bytes.length) {
      const written = fs.writeSync(fd, bytes.subarray(offset));
      if (written <= 0) {
        throw new SafeFsError(
          'io-error',
          filePath,
          `Cannot write ${filePath}: write made no progress`
        );
      }
      offset += written;
    }
    if (options.exactMode !== undefined) fs.fchmodSync(fd, options.exactMode);
    if (options.exactOwner !== undefined) {
      const { uid, gid } = options.exactOwner;
      try {
        fs.fchownSync(fd, uid, gid);
      } catch (error) {
        throw new SafeFsError(
          'unsupported-target',
          filePath,
          `Cannot give ${filePath} its owner (uid ${uid}, gid ${gid})`,
          error
        );
      }
    }
    fs.fsyncSync(fd);
    const identity = snapshotIdentity(fs.fstatSync(fd));
    fs.closeSync(fd);
    return identity;
  } catch (error) {
    quietly(() => fs.closeSync(fd));
    unlinkQuietly(filePath, fs);
    throw toSafeFsError(error, filePath, 'write');
  }
}

export interface AtomicReplaceOptions {
  /** Give the replacement the replaced file's permission bits. */
  preserveMode?: boolean;
  /**
   * Give the replacement the replaced file's owner (`rename` swaps the inode). An owner this
   * process may not restore with `fchown` is refused as `unsupported-target` before any write.
   */
  preserveOwner?: boolean;
  /** Refused as `identity-changed` when the target is no longer this file (dev/ino). */
  expectedIdentity?: FileIdentity;
  /** With `expectedIdentity`: also refuse a same-inode rewrite (size or mtime moved). */
  expectUnmodified?: boolean;
  fs?: FsLayer;
  randomName?: () => string;
}

export interface AtomicReplaceResult {
  identity: FileIdentity;
  /** Whether a file existed at `target` before. */
  replaced: boolean;
}

/**
 * Replace or create `target` in one `rename` from a same-directory temp file. The `lstat`→`rename`
 * window is accepted: `rename` never follows a link and nothing before it creates through one.
 */
export function atomicReplace(
  target: string,
  bytes: Uint8Array,
  options: AtomicReplaceOptions = {}
): AtomicReplaceResult {
  const fs = options.fs ?? nodeFsLayer;
  const existing = inspectReplaceTarget(target, fs);
  const expected = options.expectedIdentity;
  if (expected && (!existing || !sameFile(existing, expected))) {
    throw new SafeFsError(
      'identity-changed',
      target,
      `Refusing to replace ${target}: it is no longer the file that was checked`
    );
  }
  if (expected && options.expectUnmodified && existing && !sameStamp(existing, expected)) {
    throw new SafeFsError(
      'identity-changed',
      target,
      `Refusing to replace ${target}: it was modified after it was checked`
    );
  }
  const exactOwner =
    options.preserveOwner && existing ? ownerToRestore(target, existing) : undefined;

  const random = options.randomName ?? defaultRandomName;
  const temp = path.join(path.dirname(target), `.${path.basename(target)}.${random()}.tmp`);
  try {
    writeExclusiveNoFollow(temp, bytes, {
      fs,
      exactMode: options.preserveMode && existing ? existing.mode : undefined,
      exactOwner,
    });
  } catch (error) {
    // Report the target, not the temp name, unless a link was planted at the temp name.
    if (error instanceof SafeFsError && error.code === 'unsupported-target') {
      throw new SafeFsError(
        'unsupported-target',
        target,
        `Refusing to replace ${target}: its owner could not be preserved on the replacement`,
        error.cause
      );
    }
    if (error instanceof SafeFsError && error.code !== 'unsafe-link' && error.cause !== undefined) {
      throw toSafeFsError(error.cause, target, 'write');
    }
    throw error;
  }
  return { identity: finishReplace(temp, target, fs), replaced: existing !== null };
}

/** Undefined when the new file already gets the right owner; only root may give one away. */
function ownerToRestore(
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

function finishReplace(temp: string, target: string, fs: FsLayer): FileIdentity {
  try {
    fs.renameSync(temp, target);
  } catch (error) {
    unlinkQuietly(temp, fs);
    throw toSafeFsError(error, target, 'replace');
  }
  syncDirectoryQuietly(path.dirname(target), fs);
  return guarded(target, 'inspect', () => snapshotIdentity(fs.lstatSync(target)));
}

/** `lstat` a replace target under the policy of {@link atomicReplace}; null when absent. */
export function inspectReplaceTarget(
  target: string,
  fs: FsLayer = nodeFsLayer
): FileIdentity | null {
  const stats = lstatOrNull(target, fs);
  if (stats === null) return null;
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

export function defaultRandomName(): string {
  return randomBytes(6).toString('hex');
}

function isSymlink(filePath: string, fs: FsLayer): boolean {
  try {
    return fs.lstatSync(filePath).isSymbolicLink();
  } catch {
    return false;
  }
}

export function unlinkQuietly(filePath: string, fs: FsLayer = nodeFsLayer): void {
  quietly(() => fs.unlinkSync(filePath));
}

/** Linux needs a directory fsync for a rename to survive a crash; macOS may refuse it (EINVAL). */
function syncDirectoryQuietly(dir: string, fs: FsLayer): void {
  quietly(() => {
    const fd = fs.openSync(dir, O_RDONLY);
    try {
      fs.fsyncSync(fd);
    } finally {
      quietly(() => fs.closeSync(fd));
    }
  });
}
