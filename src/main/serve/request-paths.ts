// src/main/serve/request-paths.ts
// Turning a request pathname into a filesystem path, safely.
//
// Three of the serve-mode routes carry a filesystem path in the URL. Over IPC
// the equivalent argument comes from our own renderer; over HTTP it comes from
// whatever is on the other end of the socket, so the two questions this module
// answers — "what did they ask for" and "is it inside somewhere we serve" —
// have no counterpart on the desktop side and belong to the transport rather
// than to the shared handlers.

import * as path from 'path';

/**
 * The remainder of a pathname after a route prefix.
 *
 * The listener has already percent-decoded the whole pathname once, so the
 * remainder is a decoded path and must **not** be decoded again: a second pass
 * would turn a literal `%2e%2e` in a filename into `..` and hand a traversal
 * to {@link containWithin} that the client never wrote. Leading slashes are
 * stripped so the result is always relative — `/api/image//etc/passwd` asks for
 * `etc/passwd` under the review root, not for the absolute path.
 *
 * Returns an empty string when the prefix is all there was.
 */
export function routeParam(pathname: string, prefix: string): string {
  return pathname.slice(prefix.length).replace(/^\/+/, '');
}

/**
 * Resolve `requested` under `root`, or null when it escapes.
 *
 * `path.resolve` collapses `..` before the comparison, so the check is on the
 * resolved path rather than on the text of the request. The root itself is
 * accepted; everything else must sit strictly beneath it.
 */
export function containWithin(root: string, requested: string): string | null {
  const base = path.resolve(root);
  const resolved = path.resolve(base, requested.replace(/^\/+/, ''));
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    return null;
  }
  return resolved;
}
