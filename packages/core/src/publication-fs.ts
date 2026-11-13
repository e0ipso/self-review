// Publication's filesystem roles. Supplied providers own every path and descriptor operation.
import { mkdir } from 'node:fs/promises';
import type { FsLayer } from './safe-fs';
import { nodeFsLayer } from './safe-fs';
import { asyncFsFromSync, nodeAsyncFsLayer } from './safe-fs-async';
import type { AsyncFsLayer } from './safe-fs-async';

/** Read-only synchronous policy probes, also used by the advisory inspectOutputPath API. */
export type PublicationInspection = Pick<FsLayer, 'lstatSync' | 'realpathSync' | 'accessSync'>;

/**
 * Explicit publication effects for native wrappers and virtual filesystems. All roles must refer
 * to the same filesystem. Handle reads copy at most the requested length; writes may be partial.
 * Inspection stays synchronous for inspectOutputPath; file I/O and directory creation are awaited.
 * No absent method is filled from the host filesystem. Methods retain their receiver.
 */
export interface PublicationFileSystem {
  inspection: PublicationInspection;
  files: AsyncFsLayer;
  mkdir(target: string, mode: number): Promise<void>;
  currentUid(): number | undefined;
}

export const nodePublicationFileSystem: PublicationFileSystem = {
  inspection: nodeFsLayer,
  files: nodeAsyncFsLayer,
  mkdir: async (target, mode) => {
    await mkdir(target, { mode });
  },
  currentUid: () => process.getuid?.(),
};

/**
 * The sole legacy boundary. Old adapters and handles need no new members. Without readSync their
 * readFileSync may allocate the entire file and cannot be interrupted during that syscall; the
 * reader retains pre/post size checks. An explicit role takes precedence over legacy fs.
 */
export function resolvePublicationFileSystem(options: {
  publicationFs?: PublicationFileSystem;
  fs?: FsLayer;
  signal?: AbortSignal;
}): PublicationFileSystem {
  if (options.publicationFs) return options.publicationFs;
  const legacy = options.fs;
  // Preserve explicit native callers' existing asynchronous I/O. Keep this exception
  // at the legacy boundary; inferring it for wrappers could bypass a virtual provider.
  if (!legacy || legacy === nodeFsLayer) return nodePublicationFileSystem;
  return {
    inspection: legacy,
    files: asyncFsFromSync(legacy, options.signal),
    async mkdir(target, mode) {
      legacy.mkdirSync(target, mode);
    },
    currentUid: () => process.getuid?.(),
  };
}
