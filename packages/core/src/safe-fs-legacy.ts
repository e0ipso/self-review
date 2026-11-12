// Compatibility only: arbitrary synchronous adapters cannot promise bounded allocation or preemption.
import { setImmediate as yieldToIo } from 'node:timers/promises';
import type { FsLayer } from './safe-fs';
import type { AsyncFsLayer } from './safe-fs-async';

/**
 * Compatibility for supplied synchronous adapters, including virtual descriptors. Each chunk yields
 * to cancellation. Without readSync, the caller's readFileSync allocates the whole file once: that
 * call cannot be preempted or bounded during allocation, so callers check size before and after.
 */
export function asyncFsFromSync(layer: FsLayer, signal?: AbortSignal): AsyncFsLayer {
  if (layer.asyncFs) return layer.asyncFs;
  return {
    async open(target, flags, mode) {
      const fd = layer.openSync(target, flags, mode);
      let cached: Buffer | undefined;
      let cursor = 0;
      return {
        async stat() {
          return layer.fstatSync(fd);
        },
        async read(buffer, offset, length, position) {
          await yieldToIo();
          signal?.throwIfAborted();
          if (layer.readSync) {
            return { bytesRead: layer.readSync(fd, buffer, offset, length, position) };
          }
          cached ??= layer.readFileSync(fd);
          const start = position ?? cursor;
          const bytesRead = cached.copy(
            buffer,
            offset,
            start,
            Math.min(start + length, cached.length)
          );
          if (position === null) cursor += bytesRead;
          return { bytesRead };
        },
        async write(buffer) {
          await yieldToIo();
          signal?.throwIfAborted();
          return { bytesWritten: layer.writeSync(fd, buffer) };
        },
        async sync() {
          layer.fsyncSync(fd);
        },
        async chmod(mode) {
          layer.fchmodSync(fd, mode);
        },
        async chown(uid, gid) {
          layer.fchownSync(fd, uid, gid);
        },
        async close() {
          cached = undefined;
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
    async rename(from, to) {
      layer.renameSync(from, to);
    },
    async unlink(target) {
      layer.unlinkSync(target);
    },
  };
}
