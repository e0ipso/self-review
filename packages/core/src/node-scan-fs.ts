// Default Node wiring for source reads and directory scans.
import { opendir, stat, readlink } from 'fs/promises';
import { nodeReadFsLayer } from './safe-fs-read';
import type { ScanFsLayer } from './scan-fs';

export const nodeScanFsLayer: ScanFsLayer = {
  ...nodeReadFsLayer,
  stat: target => stat(target),
  opendir: target => opendir(target),
  readlink: target => readlink(target, { encoding: 'buffer' }),
};
