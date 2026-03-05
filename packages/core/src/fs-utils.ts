// src/main/fs-utils.ts
// Filesystem utility functions for the main process.

import { accessSync, constants as fsConstants } from 'fs';
import { dirname } from 'path';

/**
 * Check if a file's parent directory is writable.
 * Returns true if the directory exists and the process has write permission,
 * false otherwise (including non-existent directories).
 */
export function checkWritability(filePath: string): boolean {
  try {
    const dir = dirname(filePath);
    accessSync(dir, fsConstants.W_OK);
    return true;
  } catch {
    return false;
  }
}
