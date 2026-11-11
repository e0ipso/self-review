// Contained static bundle delivery.

import * as fs from 'node:fs';
import * as path from 'node:path';
import type * as http from 'node:http';
import { containPath } from './validate';
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

/**
 * `/` is index.html; everything else is contained under the client directory.
 * Anything that is not a regular file under it is a 404.
 */
export async function serveStatic(
  res: http.ServerResponse,
  clientDir: string,
  pathname: string
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

  let data: Buffer;
  try {
    const stat = await fs.promises.stat(resolved);
    if (!stat.isFile()) {
      sendError(res, 404, 'not found');
      return;
    }
    data = await fs.promises.readFile(resolved);
  } catch {
    sendError(res, 404, 'not found');
    return;
  }
  res.writeHead(200, {
    'content-type':
      CONTENT_TYPES[path.extname(resolved).toLowerCase()] ?? 'application/octet-stream',
    'content-length': data.length,
    ...SECURITY_HEADERS,
  });
  res.end(data);
}
