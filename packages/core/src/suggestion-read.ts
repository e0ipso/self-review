// Descriptor reads shared by both Apply implementations. At most budget + 1 bytes are read.
import * as fs from 'node:fs';
import { SafeFsError } from './safe-fs-policy';

export function inputBudgetError(target: string, maxBytes: number): SafeFsError {
  return new SafeFsError(
    'too-large',
    target,
    `The destination exceeds the ${maxBytes} byte Apply input limit, so nothing was written.`
  );
}

export interface ReadChunk {
  buffer: Buffer;
  offset: number;
  length: number;
}

/** The drivers supply only the descriptor read; allocation and growth policy are identical. */
export function* boundedChunks(
  target: string,
  size: number,
  maxBytes: number
): Generator<ReadChunk, Buffer, number> {
  if (size > maxBytes) throw inputBudgetError(target, maxBytes);
  let buffer = Buffer.alloc(Math.min(size + 1, maxBytes + 1));
  let filled = 0;
  for (;;) {
    const length = Math.min(buffer.length - filled, 64 * 1024);
    const read = yield { buffer, offset: filled, length };
    if (!Number.isInteger(read) || read < 0 || read > length)
      throw new SafeFsError('io-error', target, 'Invalid descriptor read length.');
    if (read === 0) return buffer.subarray(0, filled);
    filled += read;
    if (filled > maxBytes) throw inputBudgetError(target, maxBytes);
    if (filled === buffer.length) {
      const next = Buffer.alloc(Math.min(Math.max(1, buffer.length * 2), maxBytes + 1));
      buffer.copy(next);
      buffer = next;
    }
  }
}

export function readSuggestionSync(
  fd: number,
  target: string,
  size: number,
  maxBytes: number,
  layer: {
    readSync?: (
      fd: number,
      buffer: Uint8Array,
      offset: number,
      length: number,
      position: number | null
    ) => number;
  }
): Buffer {
  const chunks = boundedChunks(target, size, maxBytes);
  let step = chunks.next();
  while (!step.done) {
    const { buffer, offset, length } = step.value;
    // Old FsLayer implementations did not declare readSync. Their numeric native descriptors
    // remain supported; virtual descriptor adapters can supply the additive bounded method.
    const read = layer.readSync
      ? layer.readSync(fd, buffer, offset, length, null)
      : fs.readSync(fd, buffer, offset, length, null);
    step = chunks.next(read);
  }
  return step.value;
}
