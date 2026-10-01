// packages/core/src/safe-fs.ts
// Small no-follow filesystem primitives shared by every core writer: the
// review publisher today, suggestion apply and attachment relocation next.
//
// The threat these answer is filesystem indirection, not lexical traversal:
// a symlink planted where this program expects to create a file, so an
// ordinary `writeFileSync` lands its bytes somewhere else. Every create here
// is exclusive and no-follow, every replace goes through a same-directory
// temp file and `rename`, and every failure is reported as a `SafeFsError`
// with a code a host can act on. Node's `fs` is behind a small interface so a
// test can fail a write after N bytes and prove what the caller leaves behind.
//
// Linux and macOS only: `O_NOFOLLOW` is the whole point, and Node does not
// define it on Windows, which this application does not support.

import * as nodeFs from 'node:fs';
import { randomBytes } from 'node:crypto';
import * as path from 'node:path';

export type SafeFsErrorCode =
  /** The target of a replace is a directory. */
  | 'output-is-directory'
  /** EACCES, EPERM or EROFS from the operating system. */
  | 'permission-denied'
  /** ENOSPC or EDQUOT: the write cannot complete for lack of room. */
  | 'no-space'
  /** A symlink sits where this writer would create or replace a file. */
  | 'unsafe-link'
  /**
   * The target exists but cannot be replaced without changing semantics:
   * more than one hard link, not a regular file, or not owned by this user.
   */
  | 'unsupported-target'
  /** The file at the target is not the one the caller checked. */
  | 'identity-changed'
  /** Any other filesystem failure; `cause` carries the original error. */
  | 'io-error';

export class SafeFsError extends Error {
  readonly code: SafeFsErrorCode;
  /** The path the failed operation was about. */
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

/**
 * The subset of `fs` these primitives use, synchronous throughout so a
 * sequence of operations has no interleaving a test cannot reproduce.
 * `writeSync` may write fewer bytes than given, as the real one may.
 */
export interface FsLayer {
  openSync(path: string, flags: number, mode?: number): number;
  writeSync(fd: number, buffer: Uint8Array): number;
  fsyncSync(fd: number): void;
  fchmodSync(fd: number, mode: number): void;
  closeSync(fd: number): void;
  renameSync(from: string, to: string): void;
  unlinkSync(path: string): void;
  lstatSync(path: string): nodeFs.Stats;
  fstatSync(fd: number): nodeFs.Stats;
  mkdirSync(path: string, mode: number): void;
  realpathSync(path: string): string;
}

export const nodeFsLayer: FsLayer = {
  openSync: (p, flags, mode) => nodeFs.openSync(p, flags, mode),
  writeSync: (fd, buffer) => nodeFs.writeSync(fd, buffer),
  fsyncSync: fd => nodeFs.fsyncSync(fd),
  fchmodSync: (fd, mode) => nodeFs.fchmodSync(fd, mode),
  closeSync: fd => nodeFs.closeSync(fd),
  renameSync: (from, to) => nodeFs.renameSync(from, to),
  unlinkSync: p => nodeFs.unlinkSync(p),
  lstatSync: p => nodeFs.lstatSync(p),
  fstatSync: fd => nodeFs.fstatSync(fd),
  mkdirSync: (p, mode) => {
    nodeFs.mkdirSync(p, { mode });
  },
  realpathSync: p => nodeFs.realpathSync(p),
};

const { O_WRONLY, O_CREAT, O_EXCL, O_NOFOLLOW, O_RDONLY } = nodeFs.constants;

/** What `fstat` says a file is, enough to tell it from another file later. */
export interface FileIdentity {
  dev: number;
  ino: number;
  /** Permission bits only (`mode & 0o7777`). */
  mode: number;
  nlink: number;
}

export function snapshotIdentity(stats: nodeFs.Stats): FileIdentity {
  return { dev: stats.dev, ino: stats.ino, mode: stats.mode & 0o7777, nlink: stats.nlink };
}

export function sameFile(a: FileIdentity, b: FileIdentity): boolean {
  return a.dev === b.dev && a.ino === b.ino;
}

/** Map an errno to the code a host can act on; anything unknown is `io-error`. */
export function classifyFsError(error: unknown): SafeFsErrorCode {
  const code = errnoOf(error);
  switch (code) {
    case 'EISDIR':
      return 'output-is-directory';
    case 'EACCES':
    case 'EPERM':
    case 'EROFS':
      return 'permission-denied';
    case 'ENOSPC':
    case 'EDQUOT':
      return 'no-space';
    case 'ELOOP':
      return 'unsafe-link';
    default:
      return 'io-error';
  }
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
  const code = classifyFsError(error);
  const reason = error instanceof Error ? error.message : String(error);
  return new SafeFsError(code, filePath, `Cannot ${action} ${filePath}: ${reason}`, error);
}

/**
 * Refuse a relative path whose directory components, resolved under `root`,
 * include a symlink. The leaf is not checked: creating it no-follow is the
 * caller's job (`writeExclusiveNoFollow`), and an existing leaf is a policy
 * decision the caller makes with `lstat`. Components that do not exist yet
 * end the walk, since nothing can be linked where nothing is.
 *
 * `rel` must stay under `root` lexically; `..` is refused as
 * `unsupported-target` because it is not a link problem but still not a path
 * this function can vouch for.
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
  const segments = path
    .dirname(normalized)
    .split(path.sep)
    .filter(s => s && s !== '.');
  let current = root;
  for (const segment of segments) {
    current = path.join(current, segment);
    let stats: nodeFs.Stats;
    try {
      stats = fs.lstatSync(current);
    } catch (error) {
      if (errnoOf(error) === 'ENOENT') return;
      throw toSafeFsError(error, current, 'inspect');
    }
    if (stats.isSymbolicLink()) {
      throw new SafeFsError(
        'unsafe-link',
        current,
        `Refusing to write through ${current}: it is a symbolic link`
      );
    }
  }
}

/**
 * `open` with `O_NOFOLLOW` added, so a symlink at `filePath` fails (ELOOP)
 * instead of being followed. Returns the descriptor; the caller closes it.
 */
export function openNoFollow(
  filePath: string,
  flags: number,
  mode: number,
  fs: FsLayer = nodeFsLayer
): number {
  try {
    return fs.openSync(filePath, flags | O_NOFOLLOW, mode);
  } catch (error) {
    throw toSafeFsError(error, filePath, 'open');
  }
}

export interface WriteExclusiveOptions {
  /** Mode for the new file, masked by the umask. Default 0o666. */
  mode?: number;
  /** Mode to apply exactly, after creation, bypassing the umask. */
  exactMode?: number;
  fs?: FsLayer;
}

/**
 * Create `filePath`, which must not exist, and write every byte into it,
 * synced to disk. A symlink at the path, dangling or not, is refused as
 * `unsafe-link`: `O_EXCL` fails on the link itself. Any failure after
 * creation removes the file again, so a caller that sees an error owns
 * nothing new on disk.
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
    fs.fsyncSync(fd);
    const identity = snapshotIdentity(fs.fstatSync(fd));
    fs.closeSync(fd);
    return identity;
  } catch (error) {
    try {
      fs.closeSync(fd);
    } catch {
      // Already failing; the unlink below is what matters.
    }
    unlinkQuietly(filePath, fs);
    throw toSafeFsError(error, filePath, 'write');
  }
}

export interface AtomicReplaceOptions {
  /**
   * Give the new file the permission bits of the one it replaces. A target
   * that does not exist yet gets the umask default either way.
   */
  preserveMode?: boolean;
  /**
   * The file the caller inspected before deciding to write. Refused as
   * `identity-changed` when the target is no longer that file (dev/ino).
   */
  expectedIdentity?: FileIdentity;
  fs?: FsLayer;
  /** Random component of the temp file name; injectable for tests. */
  randomName?: () => string;
}

export interface AtomicReplaceResult {
  /** The identity of the file now at `target`. */
  identity: FileIdentity;
  /** Whether a file existed at `target` before the replace. */
  replaced: boolean;
}

/**
 * Replace the file at `target` with `bytes`, or create it, in one `rename`:
 * readers see either the old content or the new, never a truncated file,
 * and a failure anywhere before the rename leaves the old file untouched.
 *
 * Refused, writing nothing:
 * - a symlink at `target` (`unsafe-link`): it is replaced by `rename` rather
 *   than followed, but a policy that replaces a link silently is still one a
 *   planted link can exploit, so it is reported instead;
 * - a directory (`output-is-directory`);
 * - a file with more than one hard link (`unsupported-target`): the rename
 *   would detach this name from the other, which is not what "replace the
 *   file" means to whoever created the link;
 * - a target that is not the `expectedIdentity` (`identity-changed`).
 *
 * The temp file is created in the target's own directory (a rename across
 * filesystems is a copy), exclusively and no-follow, and is removed on any
 * failure. Between `lstat` and `rename` there is a window a concurrent
 * process could use; it is accepted, since `rename` never follows a link and
 * the primitives before it never create through one.
 */
export function atomicReplace(
  target: string,
  bytes: Uint8Array,
  options: AtomicReplaceOptions = {}
): AtomicReplaceResult {
  const fs = options.fs ?? nodeFsLayer;
  const existing = inspectReplaceTarget(target, fs);
  if (options.expectedIdentity && (!existing || !sameFile(existing, options.expectedIdentity))) {
    throw new SafeFsError(
      'identity-changed',
      target,
      `Refusing to replace ${target}: it is no longer the file that was checked`
    );
  }

  const dir = path.dirname(target);
  const random = options.randomName ?? defaultRandomName;
  const temp = path.join(dir, `.${path.basename(target)}.${random()}.tmp`);
  try {
    writeExclusiveNoFollow(temp, bytes, {
      fs,
      exactMode: options.preserveMode && existing ? existing.mode : undefined,
    });
  } catch (error) {
    // The temp name is an implementation detail; a reviewer acting on the
    // message needs the file they asked for. A link planted at the temp
    // name is the one case where the temp path is the point.
    if (error instanceof SafeFsError && error.code !== 'unsafe-link' && error.cause !== undefined) {
      throw toSafeFsError(error.cause, target, 'write');
    }
    throw error;
  }
  return { identity: finishReplace(temp, target, fs), replaced: existing !== null };
}

function finishReplace(temp: string, target: string, fs: FsLayer): FileIdentity {
  try {
    fs.renameSync(temp, target);
  } catch (error) {
    unlinkQuietly(temp, fs);
    throw toSafeFsError(error, target, 'replace');
  }
  syncDirectoryQuietly(path.dirname(target), fs);
  try {
    return snapshotIdentity(fs.lstatSync(target));
  } catch (error) {
    throw toSafeFsError(error, target, 'inspect');
  }
}

/**
 * `lstat` the target of a replace and apply the refusal policy documented on
 * {@link atomicReplace}. Returns `null` when nothing exists there yet.
 */
export function inspectReplaceTarget(
  target: string,
  fs: FsLayer = nodeFsLayer
): FileIdentity | null {
  let stats: nodeFs.Stats;
  try {
    stats = fs.lstatSync(target);
  } catch (error) {
    if (errnoOf(error) === 'ENOENT') return null;
    throw toSafeFsError(error, target, 'inspect');
  }
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

/** Remove a file this process created; a failure here is not worth reporting over the one in flight. */
export function unlinkQuietly(filePath: string, fs: FsLayer = nodeFsLayer): void {
  try {
    fs.unlinkSync(filePath);
  } catch {
    // Best effort.
  }
}

/**
 * Make the rename durable. Linux needs an fsync on the directory for the new
 * name to survive a crash; where that is not permitted (macOS returns EINVAL
 * on some filesystems) the rename itself has still happened.
 */
function syncDirectoryQuietly(dir: string, fs: FsLayer): void {
  let fd: number;
  try {
    fd = fs.openSync(dir, O_RDONLY);
  } catch {
    return;
  }
  try {
    fs.fsyncSync(fd);
  } catch {
    // Best effort.
  } finally {
    try {
      fs.closeSync(fd);
    } catch {
      // Best effort.
    }
  }
}
