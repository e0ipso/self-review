// packages/core/src/bounded-read.ts
// Read a whole file only when it fits a byte budget, deciding from the open
// descriptor before anything is allocated.
//
// The file is opened once and every decision is made on that descriptor:
// `fstat` says whether it is a regular file and how large it is, and the
// read itself never asks for more than budget + 1 bytes, so a file that grew
// after the `fstat` is still caught. Opening non-blocking keeps a FIFO from
// stalling startup until some writer appears; it changes nothing for a
// regular file.

import { closeSync, constants, fstatSync, openSync, readSync } from 'fs';
import { open } from 'fs/promises';

/** What a bounded read found. Filesystem errors (ENOENT, EACCES, ...) throw. */
export type BoundedReadResult =
  | { kind: 'ok'; content: Buffer }
  /** Larger than the budget; `size` is what `fstat` (or the read) observed. */
  | { kind: 'too-large'; size: number }
  /** A directory, FIFO, socket or device: nothing was read. */
  | { kind: 'not-regular' };

/** Read-only, and never blocking on a FIFO. O_NONBLOCK is absent on Windows. */
const OPEN_FLAGS = constants.O_RDONLY | (constants.O_NONBLOCK ?? 0);

export interface BoundedReadOptions {
  /**
   * Open with `O_NOFOLLOW`, so a symlink at `path` fails with ELOOP instead
   * of being followed. Only the leaf is covered; a caller that must not
   * follow a link anywhere on the way checks the ancestors itself
   * (`assertNoSymlinkAncestors`).
   */
  noFollow?: boolean;
}

function openFlags(options: BoundedReadOptions): number {
  return options.noFollow ? OPEN_FLAGS | constants.O_NOFOLLOW : OPEN_FLAGS;
}

/**
 * Read `path` in full when it is a regular file of at most `maxBytes`.
 *
 * @throws the underlying filesystem error when the file cannot be opened.
 */
export async function readFileWithinBudget(
  path: string,
  maxBytes: number,
  options: BoundedReadOptions = {}
): Promise<BoundedReadResult> {
  const handle = await open(path, openFlags(options));
  try {
    const stats = await handle.stat();
    if (!stats.isFile()) return { kind: 'not-regular' };
    if (stats.size > maxBytes) return { kind: 'too-large', size: stats.size };

    let buffer: Buffer = Buffer.alloc(initialCapacity(stats.size, maxBytes));
    let filled = 0;
    for (;;) {
      const { bytesRead } = await handle.read(buffer, filled, buffer.length - filled, null);
      if (bytesRead === 0) break;
      filled += bytesRead;
      if (filled === buffer.length) {
        // Full: the file grew since fstat. Keep going up to budget + 1.
        if (buffer.length > maxBytes) break;
        buffer = grow(buffer, maxBytes);
      }
    }
    if (filled > maxBytes) return { kind: 'too-large', size: Math.max(filled, stats.size) };
    return { kind: 'ok', content: buffer.subarray(0, filled) };
  } finally {
    await handle.close();
  }
}

/** Synchronous {@link readFileWithinBudget}, for callers that are synchronous. */
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
      // Full: the file grew since fstat. Keep going up to budget + 1.
      buffer = grow(buffer, maxBytes);
    }
    if (filled > maxBytes) return { kind: 'too-large', size: Math.max(filled, stats.size) };
    return { kind: 'ok', content: buffer.subarray(0, filled) };
  } finally {
    closeSync(fd);
  }
}

/**
 * Room for the size `fstat` reported plus one byte, so growth after the
 * `fstat` is noticed; never more than budget + 1.
 */
function initialCapacity(size: number, maxBytes: number): number {
  return Math.min(size, maxBytes) + 1;
}

/** Double the buffer, capped at budget + 1, keeping what was read. */
function grow(buffer: Buffer, maxBytes: number): Buffer {
  const next = Buffer.alloc(Math.min(buffer.length * 2, maxBytes + 1));
  buffer.copy(next);
  return next;
}

/**
 * Fill `buffer[offset, offset + length)` from the descriptor's current
 * position, stopping early only at end of file. Returns the bytes read.
 */
export function readInto(fd: number, buffer: Buffer, offset: number, length: number): number {
  let filled = 0;
  while (filled < length) {
    const bytesRead = readSync(fd, buffer, offset + filled, length - filled, null);
    if (bytesRead === 0) break;
    filled += bytesRead;
  }
  return filled;
}
