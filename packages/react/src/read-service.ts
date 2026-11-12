import type { ReviewAdapter } from './adapter';
import type { ExpandContextRequest } from '@self-review/types';

/** Checks both sides of legacy work too: an old host cannot abort, but its result is obsolete. */
async function read<T>(signal: AbortSignal, run: () => Promise<T> | undefined): Promise<T> {
  signal.throwIfAborted();
  const pending = run();
  if (!pending) throw new Error('This review host does not support this read.');
  const result = await pending;
  signal.throwIfAborted();
  return result;
}

export const canReadFileContent = (adapter: ReviewAdapter | null | undefined) =>
  !!(adapter?.reads?.loadFileContent || adapter?.loadFileContent);

export const loadFileContent = (
  adapter: ReviewAdapter | null | undefined,
  path: string,
  signal: AbortSignal
) =>
  read(
    signal,
    () => adapter?.reads?.loadFileContent?.(path, signal) ?? adapter?.loadFileContent?.(path)
  );

export const loadImage = (
  adapter: ReviewAdapter | null | undefined,
  path: string,
  signal: AbortSignal
) => read(signal, () => adapter?.reads?.loadImage?.(path, signal) ?? adapter?.loadImage?.(path));

export const readAttachment = (
  adapter: ReviewAdapter | null | undefined,
  reference: string,
  signal: AbortSignal
) =>
  read(
    signal,
    () =>
      adapter?.reads?.readAttachment?.(reference, signal) ?? adapter?.readAttachment?.(reference)
  );

export const expandContext = (
  adapter: ReviewAdapter | null | undefined,
  request: ExpandContextRequest,
  signal: AbortSignal
) =>
  read(
    signal,
    () => adapter?.reads?.expandContext?.(request, signal) ?? adapter?.expandContext?.(request)
  );
