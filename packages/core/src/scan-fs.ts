// Read-only directory enumeration, extending the descriptor-read contract.
import type { Stats } from 'node:fs';
import type { BoundedAsyncReadFsLayer } from './safe-fs-read';

/** Synthetic sources can inspect link text without following its destination. */
export interface SourceReadFsLayer extends BoundedAsyncReadFsLayer {
  readlink(target: string): Promise<Buffer>;
}

export interface ScanEntry {
  readonly name: string;
  isDirectory(): boolean;
  isFile(): boolean;
}

/** Caller owns close even when iteration fails or stops early. */
export interface ScanDirectoryHandle extends AsyncIterable<ScanEntry> {
  close(): Promise<void>;
}

/** All paths, identities, directory entries and bytes belong to the same filesystem. */
export interface ScanFsLayer extends SourceReadFsLayer {
  stat(target: string): Promise<Stats>;
  opendir(target: string): Promise<ScanDirectoryHandle>;
}
