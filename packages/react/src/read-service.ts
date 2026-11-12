import type { ReviewAdapter } from './adapter';
import type { ReviewReads, ExpandContextRequest } from '@self-review/types';

type ReadHost<K extends keyof ReviewReads & keyof ReviewAdapter> = Pick<ReviewAdapter, K> & {
  reads?: Pick<ReviewReads, K>;
};

// Public helpers also accept old full-adapter object literals. Their implementations below
// use only the matching read members; loadDiff and mutation capabilities are never required.
type CompatibleReadHost<K extends keyof ReviewReads & keyof ReviewAdapter> =
  | ReadHost<K>
  | ReviewAdapter;

/** Checks both sides of legacy work too: an old host cannot abort, but its result is obsolete. */
async function read<T>(signal: AbortSignal, run: () => Promise<T> | undefined): Promise<T> {
  signal.throwIfAborted();
  const pending = run();
  if (!pending) throw new Error('This review host does not support this read.');
  const result = await pending;
  signal.throwIfAborted();
  return result;
}

export const canReadFileContent = (
  adapter: CompatibleReadHost<'loadFileContent'> | null | undefined
) => !!(adapter?.reads?.loadFileContent || adapter?.loadFileContent);

export const loadFileContent = (
  adapter: CompatibleReadHost<'loadFileContent'> | null | undefined,
  path: string,
  signal: AbortSignal
) =>
  read(
    signal,
    () => adapter?.reads?.loadFileContent?.(path, signal) ?? adapter?.loadFileContent?.(path)
  );

export const loadImage = (
  adapter: CompatibleReadHost<'loadImage'> | null | undefined,
  path: string,
  signal: AbortSignal
) => read(signal, () => adapter?.reads?.loadImage?.(path, signal) ?? adapter?.loadImage?.(path));

export const readAttachment = (
  adapter: CompatibleReadHost<'readAttachment'> | null | undefined,
  reference: string,
  signal: AbortSignal
) =>
  read(
    signal,
    () =>
      adapter?.reads?.readAttachment?.(reference, signal) ?? adapter?.readAttachment?.(reference)
  );

export const expandContext = (
  adapter: CompatibleReadHost<'expandContext'> | null | undefined,
  request: ExpandContextRequest,
  signal: AbortSignal
) =>
  read(
    signal,
    () => adapter?.reads?.expandContext?.(request, signal) ?? adapter?.expandContext?.(request)
  );
