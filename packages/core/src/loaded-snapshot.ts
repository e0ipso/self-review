// Load-owned read evidence, separate from the caller's mutable logical source identity.
import type { Stats } from 'node:fs';
import path from 'node:path';
import type { DiffFile, ReviewSourceIdentity } from './types';
import type { AsyncReadHandle, BoundedAsyncReadFsLayer } from './safe-fs-read';
import { nodeReadFsLayer } from './safe-fs-read';
import { SafeFsError } from './safe-fs-policy';
import { checkLoadingCancelled } from './local-loading-lifetime';

// Stable across the separately bundled root and operations entry points. Non-enumerable evidence
// never travels in IPC/XML or changes the old payload/identity reference contracts.
const SNAPSHOT = Symbol.for('@self-review/core/loaded-snapshot');
const CAPTURE = Symbol.for('@self-review/core/source-capture');
export const RELOAD_REVIEW =
  'The reviewed source changed or could not be captured. Reload the review before reading more content.';

export function sourceStamp(stats: Stats): string {
  return [stats.dev, stats.ino, stats.mode, stats.size, stats.mtimeMs, stats.ctimeMs].join(':');
}

export interface PhysicalCapture {
  readonly target: string;
  readonly stamp: string;
  readonly readFs: BoundedAsyncReadFsLayer;
}

export interface IndexCapture {
  readonly target: string;
  readonly stamp: string | null;
  readonly readFs: BoundedAsyncReadFsLayer;
}

export interface LoadedReviewSnapshot {
  readonly identityStamp: string;
  readonly physical: ReadonlyMap<string, PhysicalCapture>;
  readonly index: ReadonlyMap<string, string>;
  /** Supplied execution effects stay with the load, including virtual git runners. */
  readonly gitOptions?: import('./git').GitExecutionOptions;
  readonly blobRunner?: import('./command-runner').BufferedCommandRunner;
  readonly indexCapture?: IndexCapture;
}

type CapturedIdentity = ReviewSourceIdentity & { [SNAPSHOT]?: LoadedReviewSnapshot };
type CapturedFile = DiffFile & { [CAPTURE]?: PhysicalCapture };

export function identityStamp(identity: ReviewSourceIdentity): string {
  return JSON.stringify([identity, [...(identity.fileSources ?? [])]]);
}

export function loadedSnapshot(identity: ReviewSourceIdentity): LoadedReviewSnapshot | undefined {
  return (identity as CapturedIdentity)[SNAPSHOT];
}

export function recordLoadedSnapshot(
  identity: ReviewSourceIdentity,
  physical: ReadonlyMap<string, PhysicalCapture>,
  index: ReadonlyMap<string, string> = new Map(),
  gitOptions?: import('./git').GitExecutionOptions,
  blobRunner?: import('./command-runner').BufferedCommandRunner,
  indexCapture?: IndexCapture
): void {
  Object.defineProperty(identity, SNAPSHOT, {
    value: {
      identityStamp: identityStamp(identity),
      physical,
      index,
      gitOptions,
      blobRunner,
      indexCapture,
    },
    configurable: true,
  });
}

export function recordSourceCapture(file: DiffFile, capture: PhysicalCapture | undefined): void {
  if (capture) Object.defineProperty(file, CAPTURE, { value: capture });
}

export function sourceCapture(file: DiffFile): PhysicalCapture | undefined {
  return (file as CapturedFile)[CAPTURE];
}

export function admitSyntheticSnapshot(
  identity: ReviewSourceIdentity,
  files: readonly DiffFile[]
): void {
  const physical = new Map<string, PhysicalCapture>();
  for (const file of files) {
    const capture = sourceCapture(file);
    if (capture) physical.set(file.newPath || file.oldPath, capture);
  }
  recordLoadedSnapshot(identity, physical);
}

/**
 * Observes the descriptor actually read by synthetic projection, including binary sniff reads.
 * Size/mtime/ctime/device/inode checks detect ordinary source changes, not hostile timestamp or
 * filesystem forgery. No extra source bytes are read or retained, and no writes are performed.
 */
export function captureSourceReads(
  layer: BoundedAsyncReadFsLayer = nodeReadFsLayer,
  signal?: AbortSignal,
  onDrift: 'throw' | 'record' = 'throw'
): {
  readFs: BoundedAsyncReadFsLayer;
  captures: Map<string, PhysicalCapture>;
  drifted: Set<string>;
} {
  const captures = new Map<string, PhysicalCapture>();
  const drifted = new Set<string>();
  const readFs: BoundedAsyncReadFsLayer = {
    readAllocation: 'bounded',
    realpath: target => layer.realpath(target),
    lstat: target => layer.lstat(target),
    async open(target, flags, mode) {
      const handle = await layer.open(target, flags, mode);
      let stamp: string;
      let physical: string;
      try {
        checkLoadingCancelled(signal);
        stamp = sourceStamp(await handle.stat());
        physical = await layer.realpath(target);
        checkLoadingCancelled(signal);
      } catch (error) {
        await handle.close();
        throw error;
      }
      const wrapped: AsyncReadHandle = {
        stat: () => handle.stat(),
        read: (buffer, offset, length, position) => handle.read(buffer, offset, length, position),
        async close() {
          try {
            checkLoadingCancelled(signal);
            const after = await handle.stat();
            const named = await layer.lstat(physical);
            checkLoadingCancelled(signal);
            if (
              sourceStamp(after) !== stamp ||
              sourceStamp(named) !== stamp ||
              (await layer.realpath(target)) !== physical
            ) {
              throw new SafeFsError('identity-changed', target, RELOAD_REVIEW);
            }
            captures.set(path.resolve(target), { target: physical, stamp, readFs: layer });
          } catch (error) {
            checkLoadingCancelled(signal);
            drifted.add(path.resolve(target));
            if (onDrift === 'throw')
              throw new SafeFsError('identity-changed', target, RELOAD_REVIEW, error);
          } finally {
            await handle.close();
          }
        },
      };
      return wrapped;
    },
  };
  return { readFs, captures, drifted };
}
