// Source reading is separate from diff projection. Both drivers consume the same bounded read plan.
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readlinkSync,
  realpathSync,
} from 'fs';
import { open } from 'fs/promises';
import { dirname, join, relative } from 'path';
import { assertNoSymlinkAncestors, openContainedFile } from './safe-fs';
import { openContainedFileAsync, type AsyncFileHandle } from './safe-fs-async';
import { readInto, readIntoAsync } from './bounded-read';
import { BINARY_SNIFF_BYTES, resolveSourceBudgets } from './input-budgets';
import { checkLoadingCancelled, loadingCheckpoint } from './local-loading-lifetime';

/** A bounded look at one path. A symlink carries only its target text, as git stores it. */
export type SyntheticSource =
  | { kind: 'skip'; bytesRead: 0 }
  | { kind: 'unreadable'; code: string; bytesRead: number }
  | { kind: 'symlink'; content: Buffer; bytesRead: number }
  | { kind: 'binary'; bytesRead: number }
  | { kind: 'text'; content: Buffer; bytesRead: number }
  | { kind: 'too-large'; size: number; bytesRead: number }
  | { kind: 'over-total'; size: number; bytesRead: number };

export interface SyntheticSourceOptions {
  followSymlinks?: boolean;
  maxFileBytes?: number;
  remainingBytes?: number;
  sourceRoot?: string;
}

function sourceOptions(options: SyntheticSourceOptions) {
  const budgets = resolveSourceBudgets();
  return {
    ...options,
    maxFileBytes: options.maxFileBytes ?? budgets.maxFileBytes,
    remainingBytes: options.remainingBytes ?? budgets.maxTotalBytes,
  };
}

function readLinkSource(
  fullPath: string,
  root: string,
  rel: string,
  options: ReturnType<typeof sourceOptions>
): SyntheticSource | null {
  if (!options.followSymlinks) {
    let linkSize: number | undefined;
    try {
      assertNoSymlinkAncestors(root, rel);
      const stats = lstatSync(fullPath);
      if (stats.isSymbolicLink()) linkSize = stats.size;
    } catch (error) {
      return failure(error);
    }
    if (linkSize !== undefined) {
      if (linkSize > options.maxFileBytes)
        return { kind: 'too-large', size: linkSize, bytesRead: 0 };
      if (linkSize > options.remainingBytes)
        return { kind: 'over-total', size: linkSize, bytesRead: 0 };
      // Git stores a link as its target path; never read what it points at.
      try {
        const content = readlinkSync(fullPath, { encoding: 'buffer' });
        assertNoSymlinkAncestors(root, rel);
        if (realpathSync(dirname(fullPath)) !== join(realpathSync(root), dirname(rel))) {
          return { kind: 'unreadable', code: 'unsafe-link', bytesRead: 0 };
        }
        if (content.length > options.maxFileBytes)
          return { kind: 'too-large', size: content.length, bytesRead: content.length };
        if (content.length > options.remainingBytes)
          return { kind: 'over-total', size: content.length, bytesRead: content.length };
        return { kind: 'symlink', content, bytesRead: content.length };
      } catch (error) {
        return failure(error);
      }
    }
  }

  return null;
}

interface ReadRequest {
  buffer: Buffer;
  offset: number;
  length: number;
}

/** Nothing past the sniff prefix is read unless measured text fits both budgets. */
function* sourceReads(
  size: number,
  maxFileBytes: number,
  remainingBytes: number
): Generator<ReadRequest, SyntheticSource, number> {
  let bytesRead = 0;
  const sniffLength = Math.min(size, BINARY_SNIFF_BYTES);
  if (sniffLength > remainingBytes) return { kind: 'over-total', size, bytesRead };
  const sniff = Buffer.alloc(sniffLength);
  bytesRead = yield { buffer: sniff, offset: 0, length: sniffLength };
  if (sniff.subarray(0, bytesRead).includes(0)) return { kind: 'binary', bytesRead };
  if (size > maxFileBytes) return { kind: 'too-large', size, bytesRead };
  if (size > remainingBytes) return { kind: 'over-total', size, bytesRead };
  // Preserve the measured snapshot if the file grows within budget. Never read past its size.
  const content = Buffer.alloc(size);
  sniff.copy(content, 0, 0, bytesRead);
  bytesRead += yield { buffer: content, offset: bytesRead, length: size - bytesRead };
  return { kind: 'text', content: content.subarray(0, bytesRead), bytesRead };
}

function checkGrowth(
  source: SyntheticSource,
  size: number,
  options: ReturnType<typeof sourceOptions>
): SyntheticSource {
  if (source.kind !== 'text') return source;
  if (size > options.maxFileBytes) return { kind: 'too-large', size, bytesRead: source.bytesRead };
  if (size > options.remainingBytes)
    return { kind: 'over-total', size, bytesRead: source.bytesRead };
  return source;
}

/** Synchronous compatibility reader. Explicitly named files may follow their leaf symlink. */
export function readSyntheticSource(
  fullPath: string,
  input: SyntheticSourceOptions = {}
): SyntheticSource {
  const options = sourceOptions(input);
  const root = options.sourceRoot ?? dirname(fullPath);
  const rel = relative(root, fullPath);
  const link = readLinkSource(fullPath, root, rel, options);
  if (link) return link;
  let fd: number;
  try {
    fd = options.followSymlinks
      ? openSync(fullPath, constants.O_RDONLY | constants.O_NONBLOCK)
      : openContainedFile(root, rel).fd;
  } catch (error) {
    return failure(error);
  }
  let bytesRead = 0;
  try {
    const stats = fstatSync(fd);
    if (!stats.isFile()) return { kind: 'skip', bytesRead: 0 };
    const reads = sourceReads(stats.size, options.maxFileBytes, options.remainingBytes);
    let step = reads.next();
    while (!step.done) {
      const { buffer, offset, length } = step.value;
      const count = readInto(fd, buffer, offset, length);
      bytesRead += count;
      step = reads.next(count);
    }
    return step.value.kind === 'text'
      ? checkGrowth(step.value, fstatSync(fd).size, options)
      : step.value;
  } catch (error) {
    return failure(error, bytesRead);
  } finally {
    closeSync(fd);
  }
}

/**
 * Owns its handle until close, including cancellation during a native open/read. Native calls
 * cannot be preempted; after they settle, cancellation wins and no partial content is returned.
 */
export async function readSyntheticSourceAsync(
  fullPath: string,
  input: SyntheticSourceOptions & { signal?: AbortSignal } = {}
): Promise<SyntheticSource> {
  const { signal } = input;
  await loadingCheckpoint(signal);
  const options = sourceOptions(input);
  const root = options.sourceRoot ?? dirname(fullPath);
  const rel = relative(root, fullPath);
  const link = readLinkSource(fullPath, root, rel, options);
  if (link) {
    checkLoadingCancelled(signal);
    return link;
  }
  let handle: AsyncFileHandle | undefined;
  let bytesRead = 0;
  try {
    handle = options.followSymlinks
      ? await open(fullPath, constants.O_RDONLY | constants.O_NONBLOCK)
      : (await openContainedFileAsync(root, rel, undefined, signal)).handle;
    checkLoadingCancelled(signal);
    const stats = await handle.stat();
    checkLoadingCancelled(signal);
    if (!stats.isFile()) return { kind: 'skip', bytesRead: 0 };
    const reader = {
      read: async (buffer: Buffer, offset: number, length: number, position: number | null) => {
        const result = await handle!.read(buffer, offset, length, position);
        // Include successful partial reads if a subsequent read fails.
        bytesRead += result.bytesRead;
        return result;
      },
    };
    const reads = sourceReads(stats.size, options.maxFileBytes, options.remainingBytes);
    let step = reads.next();
    while (!step.done) {
      const { buffer, offset, length } = step.value;
      const count = await readIntoAsync(reader, buffer, offset, length, signal);
      step = reads.next(count);
    }
    if (step.value.kind !== 'text') return step.value;
    const after = await handle.stat();
    checkLoadingCancelled(signal);
    return checkGrowth(step.value, after.size, options);
  } catch (error) {
    checkLoadingCancelled(signal);
    return failure(error, bytesRead);
  } finally {
    try {
      if (handle) await handle.close();
    } finally {
      checkLoadingCancelled(signal);
    }
  }
}
function failure(error: unknown, bytesRead = 0): SyntheticSource {
  const wrapped = error as { cause?: NodeJS.ErrnoException; code?: string } | undefined;
  const code = wrapped?.cause?.code ?? wrapped?.code ?? 'unknown error';
  // Gone or no longer a directory between listing and reading, or a link swapped in (O_NOFOLLOW).
  if (
    ['ENOENT', 'ENOTDIR', 'ELOOP', 'not-found', 'not-regular', 'output-is-directory'].includes(code)
  ) {
    return { kind: 'skip', bytesRead: 0 };
  }
  return { kind: 'unreadable', code, bytesRead };
}
