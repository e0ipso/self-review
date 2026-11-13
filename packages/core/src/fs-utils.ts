// src/main/fs-utils.ts
// Filesystem utility functions for the main process.

import { accessSync, constants as fsConstants } from 'fs';
import { dirname } from 'path';
import type { FsLayer } from './safe-fs';

/**
 * Check if a file's parent directory is writable.
 * Returns true if the directory exists and the process has write permission,
 * false otherwise (including non-existent directories).
 */
export function checkWritability(
  filePath: string,
  fs?: Pick<FsLayer, 'accessSync' | 'lstatSync'>
): boolean {
  try {
    const dir = dirname(filePath);
    if (fs === undefined) accessSync(dir, fsConstants.W_OK);
    else if (fs.accessSync) fs.accessSync(dir, fsConstants.W_OK);
    else {
      // Advisory only: legacy virtual adapters have no access syscall. Never probe the host disk.
      const stats = fs.lstatSync(dir);
      if (!stats.isDirectory()) return false;
      const uid = process.getuid?.();
      if (uid === 0) return true;
      const groups = process.getgroups?.() ?? [];
      const bits = uid === stats.uid ? 0o200 : groups.includes(stats.gid) ? 0o020 : 0o002;
      return (stats.mode & bits) !== 0;
    }
    return true;
  } catch {
    return false;
  }
}
