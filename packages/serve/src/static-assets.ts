// Contained static bundle delivery.

import * as fs from 'node:fs';
import * as path from 'node:path';
import type * as http from 'node:http';
import { once } from 'node:events';
import { containPath } from './contained-path';
import { SECURITY_HEADERS, sendError } from './http-transport';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

// Bundled scripts, styles and fonts fit comfortably within this per-file limit.
export const MAX_STATIC_ASSET_BYTES = 32 * 1024 * 1024;
export const STATIC_READ_CHUNK_BYTES = 64 * 1024;

/**
 * `/` is index.html; everything else is contained under the client directory.
 * Anything that is not a regular file under it is a 404.
 */
export async function serveStatic(
  res: http.ServerResponse,
  clientDir: string,
  pathname: string,
  options: { signal?: AbortSignal } = {}
): Promise<void> {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    sendError(res, 404, 'not found');
    return;
  }
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const resolved = containPath(clientDir, relative);
  if (resolved === null) {
    sendError(res, 404, 'not found');
    return;
  }

  const controller = new AbortController();
  const abort = () => controller.abort(new Error('Static delivery cancelled.'));
  options.signal?.addEventListener('abort', abort, { once: true });
  res.once('close', abort);
  if (options.signal?.aborted || res.destroyed) abort();
  const { signal } = controller;
  let file: fs.promises.FileHandle | undefined;
  try {
    signal.throwIfAborted();
    file = await fs.promises.open(
      resolved,
      fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK
    );
    signal.throwIfAborted();
    const stat = await file.stat();
    const named = await fs.promises.lstat(resolved);
    // Recheck containment and inode after opening. Never reopen the file for reading.
    if (
      !stat.isFile() ||
      stat.dev !== named.dev ||
      stat.ino !== named.ino ||
      named.isSymbolicLink() ||
      containPath(clientDir, relative) !== resolved ||
      (await fs.promises.realpath(resolved)) !== resolved
    ) {
      sendError(res, 404, 'not found');
      return;
    }
    signal.throwIfAborted();
    if (stat.size > MAX_STATIC_ASSET_BYTES) {
      sendError(res, 413, 'static asset exceeds 32 MiB limit');
      return;
    }

    let position = 0;
    // Read only the original range: growth cannot exceed Content-Length or the size policy.
    while (position < stat.size) {
      signal.throwIfAborted();
      const buffer = Buffer.allocUnsafe(Math.min(STATIC_READ_CHUNK_BYTES, stat.size - position));
      const { bytesRead } = await file.read({ buffer, position });
      signal.throwIfAborted();
      if (bytesRead === 0) throw new Error('Static asset shortened during delivery.');
      if (!res.headersSent) writeHeaders();
      position += bytesRead;
      if (!res.write(buffer.subarray(0, bytesRead))) await once(res, 'drain', { signal });
    }
    signal.throwIfAborted();
    if (!res.headersSent) writeHeaders();
    res.end();

    function writeHeaders() {
      res.writeHead(200, {
        'content-type':
          CONTENT_TYPES[path.extname(resolved!).toLowerCase()] ?? 'application/octet-stream',
        'content-length': stat.size,
        ...SECURITY_HEADERS,
      });
    }
  } catch {
    // A failed stream must never end as a successful, truncated response.
    if (signal.aborted || res.headersSent) res.destroy();
    else sendError(res, 404, 'not found');
  } finally {
    options.signal?.removeEventListener('abort', abort);
    res.off('close', abort);
    // Admission retains the work slot until this close has completed.
    await file?.close();
  }
}
