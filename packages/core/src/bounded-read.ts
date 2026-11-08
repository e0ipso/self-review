// packages/core/src/bounded-read.ts
// Whole-file reads within a byte budget, decided on the open descriptor before anything is allocated.

import { closeSync, constants, fstatSync, openSync, read, readSync } from 'fs';
import type { Stats } from 'fs';
import { open } from 'fs/promises';
import { promisify } from 'util';

/** Filesystem errors (ENOENT, EACCES, ...) throw. */
export type BoundedReadResult =
  | { kind: 'ok'; content: Buffer }
  | { kind: 'too-large'; size: number }
  /** A directory, FIFO, socket or device: nothing was read. */
  | { kind: 'not-regular' };

/** O_NONBLOCK keeps a FIFO from stalling the open until a writer appears; Windows lacks it. */
export const READ_FLAGS = constants.O_RDONLY | (constants.O_NONBLOCK ?? 0);

export interface BoundedReadOptions {
  /** Covers the leaf only; ancestors are the caller's job (`openContainedFile`). */
  noFollow?: boolean;
}

const readAsync = promisify(read);

function openFlags(options: BoundedReadOptions): number {
  return options.noFollow ? READ_FLAGS | constants.O_NOFOLLOW : READ_FLAGS;
}

export async function readFileWithinBudget(
  path: string,
  maxBytes: number,
  options: BoundedReadOptions = {}
): Promise<BoundedReadResult> {
  const handle = await open(path, openFlags(options));
  try {
    const stats = await handle.stat();
    if (!stats.isFile()) return { kind: 'not-regular' };
    return await readDescriptorWithinBudget(handle.fd, stats, maxBytes);
  } finally {
    await handle.close();
  }
}

/** {@link readFileWithinBudget} on a regular file the caller opened and `fstat`ed. */
export async function readDescriptorWithinBudget(
  fd: number,
  stats: Stats,
  maxBytes: number
): Promise<Exclude<BoundedReadResult, { kind: 'not-regular' }>> {
  if (stats.size > maxBytes) return { kind: 'too-large', size: stats.size };

  let buffer: Buffer = Buffer.alloc(initialCapacity(stats.size, maxBytes));
  let filled = 0;
  for (;;) {
    const { bytesRead } = await readAsync(fd, buffer, filled, buffer.length - filled, null);
    if (bytesRead === 0) break;
    filled += bytesRead;
    if (filled === buffer.length) {
      // The file grew since fstat: keep going up to budget + 1.
      if (buffer.length > maxBytes) break;
      buffer = grow(buffer, maxBytes);
    }
  }
  if (filled > maxBytes) return { kind: 'too-large', size: Math.max(filled, stats.size) };
  return { kind: 'ok', content: buffer.subarray(0, filled) };
}

export function readFileWithinBudgetSync(
  path: string,
  maxBytes: number,
  options: BoundedReadOptions = {}
): BoundedReadResult {
  const fd = openSync(path, openFlags(options));
  try {
    const stats = fstatSync(fd);
    if (!stats.isFile()) return { kind: 'not-regular' };
    if (stats.size > maxBytes) return { kind: 'too-large', size: stats.size };

    let buffer: Buffer = Buffer.alloc(initialCapacity(stats.size, maxBytes));
    let filled = 0;
    for (;;) {
      filled += readInto(fd, buffer, filled, buffer.length - filled);
      if (filled < buffer.length || buffer.length > maxBytes) break;
      buffer = grow(buffer, maxBytes);
    }
    if (filled > maxBytes) return { kind: 'too-large', size: Math.max(filled, stats.size) };
    return { kind: 'ok', content: buffer.subarray(0, filled) };
  } finally {
    closeSync(fd);
  }
}

/** One byte past the fstat size, so growth since is noticed; never more than budget + 1. */
function initialCapacity(size: number, maxBytes: number): number {
  return Math.min(size, maxBytes) + 1;
}

function grow(buffer: Buffer, maxBytes: number): Buffer {
  const next = Buffer.alloc(Math.min(buffer.length * 2, maxBytes + 1));
  buffer.copy(next);
  return next;
}

/** Fill `buffer[offset, offset + length)`, stopping early only at end of file. */
export function readInto(fd: number, buffer: Buffer, offset: number, length: number): number {
  let filled = 0;
  while (filled < length) {
    const bytesRead = readSync(fd, buffer, offset + filled, length - filled, null);
    if (bytesRead === 0) break;
    filled += bytesRead;
  }
  return filled;
}
