// Read capabilities contain no mutation, ownership or replacement operations.
import * as fs from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import type { Stats } from 'node:fs';
import { setImmediate as yieldToIo } from 'node:timers/promises';
import type { FsLayer } from './safe-fs';

/** Methods retain their receiver. read copies at most length bytes into the caller's buffer. */
export interface AsyncReadHandle {
  stat(): Promise<Stats>;
  read(
    buffer: Buffer,
    offset: number,
    length: number,
    position: number | null
  ): Promise<{ bytesRead: number }>;
  close(): Promise<void>;
}

export interface AsyncReadFsLayer<H extends AsyncReadHandle = AsyncReadHandle> {
  open(target: string, flags: number, mode?: number): Promise<H>;
  lstat(target: string): Promise<Stats>;
  realpath(target: string): Promise<string>;
}

/**
 * Explicit promise that read copies the requested chunk without allocating the whole file.
 * This is an adapter contract, not a way to interrupt an arbitrary implementation or syscall.
 */
export interface BoundedAsyncReadFsLayer<
  H extends AsyncReadHandle = AsyncReadHandle,
> extends AsyncReadFsLayer<H> {
  readonly readAllocation: 'bounded';
}

export const nodeReadFsLayer: BoundedAsyncReadFsLayer<FileHandle> = {
  readAllocation: 'bounded',
  open: (target, flags, mode) => fs.open(target, flags, mode),
  lstat: target => fs.lstat(target),
  realpath: target => fs.realpath(target),
};

/** Unlike FsLayer's legacy path, a bounded synchronous reader must implement descriptor reads. */
export type SyncReadFsLayer = Pick<
  FsLayer,
  'openSync' | 'fstatSync' | 'lstatSync' | 'realpathSync' | 'closeSync'
> &
  Required<Pick<FsLayer, 'readSync'>>;

/**
 * Bounded allocation over the supplied filesystem, including virtual descriptors. Each read yields
 * before its synchronous call. The call itself cannot be preempted; no native-fs fallback is used.
 */
export function boundedReadFsFromSync(
  layer: SyncReadFsLayer,
  signal?: AbortSignal
): BoundedAsyncReadFsLayer {
  return {
    readAllocation: 'bounded',
    async open(target, flags, mode) {
      const fd = layer.openSync(target, flags, mode);
      return {
        async stat() {
          return layer.fstatSync(fd);
        },
        async read(buffer, offset, length, position) {
          await yieldToIo();
          signal?.throwIfAborted();
          return { bytesRead: layer.readSync(fd, buffer, offset, length, position) };
        },
        async close() {
          layer.closeSync(fd);
        },
      };
    },
    async lstat(target) {
      return layer.lstatSync(target);
    },
    async realpath(target) {
      return layer.realpathSync(target);
    },
  };
}
