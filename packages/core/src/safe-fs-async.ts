// Promise-based I/O under the same target, identity and ownership policy as safe-fs.
import * as fs from 'node:fs/promises';
import type { Stats } from 'node:fs';
import { constants } from 'node:fs';
import * as path from 'node:path';
import { randomBytes } from 'node:crypto';
import { READ_FLAGS } from './bounded-read';
import {
  SafeFsError,
  errnoOf,
  toSafeFsError,
  snapshotIdentity,
  sameFile,
  assertExpectedTarget,
  ownerToRestore,
  replacementIdentity,
} from './safe-fs-policy';
import type { AtomicReplaceOptions, AtomicReplaceResult } from './safe-fs';

/** Only the handle operations these readers and writers use. Methods retain their receiver. */
export interface AsyncFileHandle {
  stat(): Promise<Stats>;
  read(
    buffer: Buffer,
    offset: number,
    length: number,
    position: number | null
  ): Promise<{ bytesRead: number }>;
  write(buffer: Uint8Array): Promise<{ bytesWritten: number }>;
  sync(): Promise<void>;
  chmod(mode: number): Promise<void>;
  chown(uid: number, gid: number): Promise<void>;
  close(): Promise<void>;
}

export interface AsyncFsLayer {
  open(target: string, flags: number, mode?: number): Promise<AsyncFileHandle>;
  lstat(target: string): Promise<Stats>;
  realpath(target: string): Promise<string>;
  /** Resolve on commit; reject only if the rename did not commit. */
  rename(from: string, to: string): Promise<void>;
  unlink(target: string): Promise<void>;
}

export const nodeAsyncFsLayer: AsyncFsLayer = {
  open: (target, flags, mode) => fs.open(target, flags, mode),
  lstat: target => fs.lstat(target),
  realpath: target => fs.realpath(target),
  rename: (from, to) => fs.rename(from, to),
  unlink: target => fs.unlink(target),
};

export interface AtomicReplaceAsyncOptions extends Omit<AtomicReplaceOptions, 'fs'> {
  fs?: AsyncFsLayer;
  /** Reject with signal.reason before commit. An abort during a successful rename cannot undo it. */
  signal?: AbortSignal;
}

async function quietly(fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch {
    /* Cleanup must not mask the primary outcome. */
  }
}

async function lstatOrNull(target: string, layer: Pick<AsyncFsLayer, 'lstat'>) {
  try {
    return await layer.lstat(target);
  } catch (error) {
    if (errnoOf(error) === 'ENOENT') return null;
    throw toSafeFsError(error, target, 'inspect');
  }
}

async function inspectTarget(target: string, layer: Pick<AsyncFsLayer, 'lstat'>) {
  const stats = await lstatOrNull(target, layer);
  return stats === null ? null : replacementIdentity(target, stats);
}

/** No-follow open, followed by descriptor/name/physical-containment checks. Caller owns close. */
export async function openContainedFileAsync(
  root: string,
  rel: string,
  layer: Pick<AsyncFsLayer, 'open' | 'lstat' | 'realpath'> = nodeAsyncFsLayer,
  signal?: AbortSignal
): Promise<{ handle: AsyncFileHandle; stats: Stats }> {
  signal?.throwIfAborted();
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
    const stats = await lstatOrNull(current, layer);
    signal?.throwIfAborted();
    if (stats === null) break;
    if (stats.isSymbolicLink())
      throw new SafeFsError(
        'unsafe-link',
        current,
        `Refusing to go through ${current}: it is a symbolic link`
      );
  }
  const target = path.join(root, rel);
  const handle = await layer.open(target, READ_FLAGS | constants.O_NOFOLLOW).catch(error => {
    signal?.throwIfAborted();
    throw toSafeFsError(error, target, 'open');
  });
  try {
    signal?.throwIfAborted();
    const stats = await handle.stat();
    if (stats.isDirectory())
      throw new SafeFsError('output-is-directory', target, `${target} is a directory`);
    if (!stats.isFile())
      throw new SafeFsError('not-regular', target, `${target} is not a regular file`);
    const named = await layer.lstat(target);
    const physical = await layer.realpath(target);
    const physicalRoot = await layer.realpath(root);
    signal?.throwIfAborted();
    if (!sameFile(named, stats) || physical !== path.join(physicalRoot, rel)) {
      throw new SafeFsError('unsafe-link', target, `${target} changed while it was being opened`);
    }
    return { handle, stats };
  } catch (error) {
    await quietly(() => handle.close());
    signal?.throwIfAborted();
    throw toSafeFsError(error, target, 'open');
  }
}

async function writeStagedFile(
  temp: string,
  bytes: Uint8Array,
  layer: Pick<AsyncFsLayer, 'open' | 'lstat' | 'unlink'>,
  options: AtomicReplaceAsyncOptions,
  exactMode: number | undefined,
  exactOwner: { uid: number; gid: number } | undefined
) {
  options.signal?.throwIfAborted();
  let handle: AsyncFileHandle;
  try {
    handle = await layer.open(
      temp,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o666
    );
  } catch (error) {
    if (errnoOf(error) === 'EEXIST' && (await lstatOrNull(temp, layer))?.isSymbolicLink()) {
      throw new SafeFsError(
        'unsafe-link',
        temp,
        `Refusing to write ${temp}: a symbolic link already sits at that name`
      );
    }
    throw toSafeFsError(error, temp, 'create');
  }
  try {
    let offset = 0;
    while (offset < bytes.length) {
      options.signal?.throwIfAborted();
      const { bytesWritten } = await handle.write(bytes.subarray(offset, offset + 64 * 1024));
      if (bytesWritten <= 0)
        throw new SafeFsError('io-error', temp, `Cannot write ${temp}: write made no progress`);
      offset += bytesWritten;
    }
    if (exactOwner !== undefined) {
      try {
        await handle.chown(exactOwner.uid, exactOwner.gid);
      } catch (error) {
        throw new SafeFsError('unsupported-target', temp, `Cannot give ${temp} its owner`, error);
      }
    }
    if (exactMode !== undefined) await handle.chmod(exactMode);
    await handle.sync();
    options.signal?.throwIfAborted();
    const identity = snapshotIdentity(await handle.stat());
    await handle.close();
    return identity;
  } catch (error) {
    await quietly(() => handle.close());
    await quietly(() => layer.unlink(temp));
    throw error;
  }
}

/**
 * Atomic replacement with bounded write chunks and cancellation before rename. The last target
 * check follows staging/fsync. As in atomicReplace, a portable path-check/rename race remains;
 * size/mtime are modification stamps, not a content hash or compare-and-swap guarantee.
 * Once rename succeeds, cleanup and directory sync cannot convert success into refusal.
 */
export async function atomicReplaceAsync(
  target: string,
  bytes: Uint8Array,
  options: AtomicReplaceAsyncOptions = {}
): Promise<AtomicReplaceResult> {
  const layer = options.fs ?? nodeAsyncFsLayer;
  options.signal?.throwIfAborted();
  const parent = await layer.realpath(path.dirname(target)).catch(error => {
    options.signal?.throwIfAborted();
    throw toSafeFsError(error, target, 'resolve parent');
  });
  const existing = await inspectTarget(target, layer);
  assertExpectedTarget(target, existing, options);
  const owner = options.preserveOwner && existing ? ownerToRestore(target, existing) : undefined;
  const random = options.randomName ?? (() => randomBytes(6).toString('hex'));
  const temp = path.join(path.dirname(target), `.${path.basename(target)}.${random()}.tmp`);
  let identity;
  try {
    identity = await writeStagedFile(
      temp,
      bytes,
      layer,
      options,
      options.preserveMode && existing ? existing.mode : undefined,
      owner
    );
  } catch (error) {
    options.signal?.throwIfAborted();
    // Match the sync writer's target-oriented errors while retaining a planted temp-link path.
    const safe = toSafeFsError(error, target, 'write');
    if (safe.code === 'unsupported-target')
      throw new SafeFsError(
        'unsupported-target',
        target,
        `Refusing to replace ${target}: its owner could not be preserved on the replacement`,
        safe.cause
      );
    if (safe.code !== 'unsafe-link' && safe.cause !== undefined)
      throw toSafeFsError(safe.cause, target, 'write');
    throw safe;
  }
  try {
    if ((await layer.realpath(path.dirname(target))) !== parent) {
      throw new SafeFsError(
        'identity-changed',
        target,
        `Refusing to replace ${target}: its parent directory moved`
      );
    }
    assertExpectedTarget(target, await inspectTarget(target, layer), options);
    options.signal?.throwIfAborted();
    options.beforeCommit?.();
    options.signal?.throwIfAborted();
    await layer.rename(temp, target);
  } catch (error) {
    await quietly(() => layer.unlink(temp));
    options.signal?.throwIfAborted();
    throw toSafeFsError(error, target, 'replace');
  }
  await quietly(async () => {
    const directory = await layer.open(path.dirname(target), constants.O_RDONLY);
    try {
      await directory.sync();
    } finally {
      await quietly(() => directory.close());
    }
  });
  return { identity, replaced: existing !== null };
}
