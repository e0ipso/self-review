// src/shared/path-utils.ts
// Shared path utilities used by both main and renderer processes.

/**
 * Extract the basename from any file path (POSIX or Windows).
 * Used for fallback path matching when resuming reviews across
 * different session modes.
 */
export function normalizeResumePath(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}
