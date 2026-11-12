// Filesystem containment for static bundle delivery. Reviewed paths use core authorization.

import * as fs from 'node:fs';
import * as path from 'node:path';

/** Missing names and invalid path components are ordinary unavailable assets. */
export function isUnavailablePathError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | null)?.code;
  return code === 'ENOENT' || code === 'ENOTDIR' || code === 'ELOOP' || code === 'ENAMETOOLONG';
}

/** Realpath the deepest existing ancestor, so a deleted file still resolves. */
function realpathDeepestExisting(absolute: string): string | null {
  const missing: string[] = [];
  let current = absolute;
  for (;;) {
    try {
      const real = fs.realpathSync(current);
      return missing.length === 0 ? real : path.join(real, ...missing);
    } catch (error) {
      if (!isUnavailablePathError(error)) throw error;
      if ((error as NodeJS.ErrnoException).code === 'ELOOP') return null;
      const parent = path.dirname(current);
      if (parent === current) {
        return null;
      }
      missing.unshift(path.basename(current));
      current = parent;
    }
  }
}

/**
 * Resolve `candidate` under `root`, or null if it escapes. For the client bundle and attachments only;
 * reviewed diff paths go through core's `authorizeReviewedPath`.
 *
 * Never decode here: callers pass a value `searchParams` already decoded once,
 * and decoding again turns `%2E%2E%2F` inside a filename into a real traversal.
 */
export function containPath(root: string, candidate: string): string | null {
  let resolvedRoot: string;
  try {
    resolvedRoot = fs.realpathSync(root);
  } catch (error) {
    if (!isUnavailablePathError(error)) throw error;
    return null;
  }

  // Realpath both sides so a symlink inside the repository cannot escape it.
  const resolved = realpathDeepestExisting(path.resolve(resolvedRoot, candidate));
  if (resolved === null) {
    return null;
  }

  if (resolved === resolvedRoot) {
    return resolved;
  }
  // Root plus separator, not a bare prefix: `/repo-evil` is not under `/repo`.
  const rootWithSep = resolvedRoot.endsWith(path.sep) ? resolvedRoot : resolvedRoot + path.sep;
  return resolved.startsWith(rootWithSep) ? resolved : null;
}
