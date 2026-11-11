// Native descriptor reads shared by both Apply implementations use at most budget + 1 bytes.
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
    readFileSync(fd: number): Buffer;
    readSync?: (
      fd: number,
      buffer: Uint8Array,
      offset: number,
      length: number,
      position: number | null
    ) => number;
  }
): Buffer {
  // Compatibility for FsLayer adapters authored before readSync existed. Keep until a major
  // version can require chunk reads. The supplied reader owns its allocation; check both its
  // advertised and returned sizes. Native/default adapters always take the bounded path below.
  if (!layer.readSync) {
    if (size > maxBytes) throw inputBudgetError(target, maxBytes);
    const bytes = layer.readFileSync(fd);
    if (bytes.length > maxBytes) throw inputBudgetError(target, maxBytes);
    return bytes;
  }
  const chunks = boundedChunks(target, size, maxBytes);
  let step = chunks.next();
  while (!step.done) {
    const { buffer, offset, length } = step.value;
    const read = layer.readSync(fd, buffer, offset, length, null);
    step = chunks.next(read);
  }
  return step.value;
}
