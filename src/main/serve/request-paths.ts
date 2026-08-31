// src/main/serve/request-paths.ts
// Turning a request pathname into a filesystem path, safely. Three serve-mode
// routes carry a path in the URL; unlike the IPC equivalents it arrives from
// whatever is on the other end of the socket.

import * as path from 'path';

/**
 * The remainder of a pathname after a route prefix.
 *
 * The listener already decoded the pathname once, so this must not decode
 * again: a second pass would turn a literal `%2e%2e` in a filename into `..`.
 * Leading slashes are stripped so the result is always relative.
 */
export function routeParam(pathname: string, prefix: string): string {
  return pathname.slice(prefix.length).replace(/^\/+/, '');
}

/**
 * Resolve `requested` under `root`, or null when it escapes. The root itself
 * is accepted; everything else must sit strictly beneath it.
 */
export function containWithin(root: string, requested: string): string | null {
  const base = path.resolve(root);
  const resolved = path.resolve(base, requested.replace(/^\/+/, ''));
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    return null;
  }
  return resolved;
}
