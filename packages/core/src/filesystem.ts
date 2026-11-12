// Supported advanced adapter contracts. The root API remains compatible with existing imports.
export {
  SafeFsError,
  nodeFsLayer,
  assertNoSymlinkAncestors,
  openContainedFile,
  readContainedFile,
  writeExclusiveNoFollow,
  atomicReplace,
  inspectReplaceTarget,
  snapshotIdentity,
  sameFile,
  classifyFsError,
} from './safe-fs';
export type {
  SafeFsErrorCode,
  FsLayer,
  FileIdentity,
  WriteExclusiveOptions,
  AtomicReplaceOptions,
  AtomicReplaceResult,
} from './safe-fs';
export {
  nodeAsyncFsLayer,
  openContainedFileAsync,
  readContainedFileAsync,
  readContainedFileBounded,
  atomicReplaceAsync,
  writeExclusiveNoFollowAsync,
} from './safe-fs-async';
export type { AsyncFsLayer, AsyncFileHandle, AtomicReplaceAsyncOptions } from './safe-fs-async';
export { nodeReadFsLayer, boundedReadFsFromSync } from './safe-fs-read';
export type {
  AsyncReadHandle,
  AsyncReadFsLayer,
  BoundedAsyncReadFsLayer,
  SyncReadFsLayer,
} from './safe-fs-read';
export { asyncFsFromSync } from './safe-fs-legacy';

export type { SourceReadFsLayer, ScanFsLayer, ScanEntry, ScanDirectoryHandle } from './scan-fs';
export { nodeScanFsLayer } from './node-scan-fs';
