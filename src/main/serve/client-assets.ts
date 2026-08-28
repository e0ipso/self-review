// src/main/serve/client-assets.ts
// Locating and reading the built browser client that serve mode hands to the
// reviewer's browser.
//
// The bundle itself is built by the serve-mode client work; this module only
// answers "where is it, and what is the content type of this file". It imports
// nothing from `electron` — packaged builds are detected from `resourcesPath`
// rather than `app.isPackaged` — so the server stays unit-testable outside the
// desktop process.

import * as fs from 'fs';
import * as path from 'path';

/** Environment override for the client directory. Set by tests and dev runs. */
export const CLIENT_DIR_ENV = 'SELF_REVIEW_CLIENT_DIR';

/**
 * Directory name the client build writes into, under the repository root in a
 * source checkout and under `resources/` in a packaged build.
 */
export const CLIENT_DIR_NAME = 'serve-client';

export interface ClientAssetsLocation {
  /** The directory to serve from. The first candidate that exists, or the last one tried. */
  dir: string;
  /** False when no candidate exists — the bundle has not been built. */
  exists: boolean;
  /** Every location that was tried, in order, for the error message. */
  candidates: string[];
}

/**
 * Resolve where the built client lives, tolerating its absence.
 *
 * Candidates, in order:
 *  1. `$SELF_REVIEW_CLIENT_DIR` — explicit override.
 *  2. `<resources>/serve-client` — a packaged build, where the bundle ships as
 *     an extra resource alongside the icon (see `app-assets.ts` for the same
 *     shape).
 *  3. `<repo>/dist/serve-client` — a source checkout. `__dirname` is
 *     `<repo>/.webpack/main` for the bundled main process.
 *
 * A missing bundle is reported, never thrown: the server still starts and
 * answers the API, and says plainly that the client has not been built.
 */
export function resolveClientAssetsDir(): ClientAssetsLocation {
  const candidates: string[] = [];

  const override = process.env[CLIENT_DIR_ENV];
  if (override) {
    candidates.push(path.resolve(override));
  }
  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, CLIENT_DIR_NAME));
  }
  // `__dirname` is `<repo>/.webpack/main` for the bundled main process — the
  // same two-levels-up shape `app-assets.ts` uses to find `assets/`.
  candidates.push(path.resolve(__dirname, '..', '..', 'dist', CLIENT_DIR_NAME));

  for (const candidate of candidates) {
    if (isDirectory(candidate)) {
      return { dir: candidate, exists: true, candidates };
    }
  }

  return { dir: candidates[0], exists: false, candidates };
}

function isDirectory(candidate: string): boolean {
  try {
    return fs.statSync(candidate).isDirectory();
  } catch {
    return false;
  }
}

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
};

/** Content type for a built asset, defaulting to an opaque stream. */
export function contentTypeFor(filePath: string): string {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * Outcome of mapping a request pathname onto the client bundle. `escape` is
 * kept distinct from `missing` so a traversal attempt is refused outright
 * rather than quietly answered with the entry document.
 */
export type StaticLookup =
  | { kind: 'file'; path: string }
  | { kind: 'missing' }
  | { kind: 'escape' };

/**
 * Map a request pathname to a file inside `clientDir`, never outside it.
 * `..` segments and absolute paths resolve against the bundle root and are
 * rejected by the containment check, so nothing outside the bundle is read.
 */
export function resolveStaticFile(clientDir: string, pathname: string): StaticLookup {
  const root = path.resolve(clientDir);
  const relative = pathname.replace(/^\/+/, '');
  const resolved = path.resolve(root, relative);

  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    return { kind: 'escape' };
  }

  try {
    return fs.statSync(resolved).isFile() ? { kind: 'file', path: resolved } : { kind: 'missing' };
  } catch {
    return { kind: 'missing' };
  }
}
