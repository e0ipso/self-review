// The HTTP server for serve mode.
//
// Eight JSON routes over one ReviewSession, each a thin wrapper over a function
// `@self-review/core` already exports, plus static serving for the client
// bundle. Built on `node:http` with no framework and no new runtime dependency.
//
// Two properties of this module are load-bearing and deliberate:
//
// 1. Every route validates its input (./validate) before any core function
//    runs. The core handlers were written for an in-process caller the
//    compiler had already checked; over HTTP the caller is whatever is on the
//    other end of the socket.
// 2. The listener binds to 127.0.0.1 only (`listenLoopback`). That is the
//    whole of the access-control story — there is no authentication.
//
// This module starts no subprocess. `core` already reaches git safely — argv
// form, never a shell string, with a `--` separator before any path (the fix
// for issue #145) — and nothing here adds a second path to it.

import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';
import {
  getDiffLoad,
  getConfigLoad,
  getResumeLoad,
  getFileHunks,
  loadImage,
  readAttachment,
  expandContext,
  submitReviewState,
} from '@self-review/core';
import type { ReviewSession } from '@self-review/core';
import { containPath, parseExpandContextBody, parseReviewStateBody } from './validate';

/**
 * The one directory the client bundle is served from: `client/` next to this
 * module, which is `dist/client/` once built. The client build emits there.
 * There is exactly one resolution because this program never runs inside a
 * packaged desktop application; a second branch here would mean it does.
 */
export const CLIENT_DIR = fileURLToPath(new URL('./client/', import.meta.url));

/** Upper bound on a `POST /api/expand-context` body: a path and an integer. */
export const MAX_EXPAND_CONTEXT_BODY_BYTES = 64 * 1024;

/**
 * Upper bound on a `POST /api/review` body. A review carries every comment
 * and suggestion the reviewer wrote; generous, but finite, because an
 * unbounded read on a long-lived process is a trivial denial of service.
 */
export const MAX_REVIEW_BODY_BYTES = 32 * 1024 * 1024;

export interface ReviewServerOptions {
  /** The session every route acts on; held for the process lifetime. */
  session: ReviewSession;
  /**
   * Root that every request-supplied path is contained under. Must be the
   * diff's repository (`session.diffData.source.repository`): `loadImage`
   * and `expandContext` resolve their path against that, so containment is
   * only a guarantee when both agree on the root.
   */
  repositoryRoot: string;
  /** Directory of the client bundle. Defaults to `CLIENT_DIR`; tests inject a fixture. */
  clientDir?: string;
}

interface RouteContext {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  url: URL;
  session: ReviewSession;
  repositoryRoot: string;
}

type RouteHandler = (ctx: RouteContext) => Promise<void>;

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

function sendJson(
  res: http.ServerResponse,
  status: number,
  value: unknown,
  headers: http.OutgoingHttpHeaders = {}
): void {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...headers,
  });
  // `JSON.stringify(undefined)` is undefined; a void core result becomes `null`.
  res.end(JSON.stringify(value ?? null));
}

function sendError(res: http.ServerResponse, status: number, error: string): void {
  // A body that blew the cap is not read further; close the connection rather
  // than let the rest of it be reinterpreted as a next request.
  sendJson(res, status, { error }, status === 413 ? { connection: 'close' } : {});
}

/**
 * Read the `path` query parameter — decoded exactly once by `searchParams` —
 * and contain it under the repository root. Returns both the value as sent
 * (which core interprets relative to the repository) and the resolved real
 * path (for a handler that reads the filesystem directly). When the parameter
 * is absent or escapes the root, answers 400 and returns null, so the caller
 * returns before any core function runs.
 */
function requireContainedPath(
  ctx: RouteContext
): { raw: string; resolved: string } | null {
  const raw = ctx.url.searchParams.get('path');
  const resolved = raw ? containPath(ctx.repositoryRoot, raw) : null;
  if (raw === null || resolved === null) {
    sendError(ctx.res, 400, 'path must be a file under the repository root');
    return null;
  }
  return { raw, resolved };
}

type BodyResult =
  | { ok: true; value: unknown }
  | { ok: false; status: number; error: string };

/**
 * Read and parse a JSON request body, refusing anything over `maxBytes`.
 * The declared length is checked before a byte is read, and the running
 * total during the read, so a chunked body without a length is capped too.
 */
function readJsonBody(req: http.IncomingMessage, maxBytes: number): Promise<BodyResult> {
  const contentType = req.headers['content-type'] ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    return Promise.resolve({
      ok: false,
      status: 415,
      error: 'content-type must be application/json',
    });
  }
  const declared = Number(req.headers['content-length']);
  if (Number.isFinite(declared) && declared > maxBytes) {
    return Promise.resolve({ ok: false, status: 413, error: 'request body too large' });
  }

  return new Promise(resolve => {
    const chunks: Buffer[] = [];
    let received = 0;
    req.on('data', (chunk: Buffer) => {
      received += chunk.length;
      if (received > maxBytes) {
        chunks.length = 0;
        req.removeAllListeners('data');
        req.removeAllListeners('end');
        resolve({ ok: false, status: 413, error: 'request body too large' });
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve({ ok: true, value: JSON.parse(Buffer.concat(chunks).toString('utf-8')) });
      } catch {
        resolve({ ok: false, status: 400, error: 'body must be valid JSON' });
      }
    });
    req.on('error', () => {
      resolve({ ok: false, status: 400, error: 'request body could not be read' });
    });
  });
}

// ---------------------------------------------------------------------------
// Routes. Each validates, then calls exactly one core function, then sends
// the JSON serialization of what core returned (`null` stays `null`).
// ---------------------------------------------------------------------------

const routes: Record<string, RouteHandler> = {
  'GET /api/diff': async ({ res, session }) => {
    // The guide rides with the diff: both were resolved at startup and sit on
    // the session, so the client satisfies `onDiffLoad` and `onGuideLoad`
    // from this one response with no server-initiated channel.
    sendJson(res, 200, getDiffLoad(session));
  },

  'GET /api/config': async ({ res, session }) => {
    sendJson(res, 200, getConfigLoad(session));
  },

  'GET /api/resume': async ({ res, session }) => {
    sendJson(res, 200, getResumeLoad(session));
  },

  'GET /api/file': async ctx => {
    const contained = requireContainedPath(ctx);
    if (contained === null) return;
    // Diff paths are repository-relative strings; core matches on them as sent.
    sendJson(ctx.res, 200, getFileHunks(ctx.session, contained.raw));
  },

  'GET /api/image': async ctx => {
    const contained = requireContainedPath(ctx);
    if (contained === null) return;
    // Core resolves the path against the diff's repository itself (and, in a
    // remote session, reads the blob at the reviewed commit), so it gets the
    // repository-relative value, not the resolved one.
    sendJson(ctx.res, 200, await loadImage(ctx.session, contained.raw));
  },

  'GET /api/attachment': async ctx => {
    // Attachments are a different namespace from diff paths and take a
    // different root. A path recorded in review.xml is
    // `.self-review-assets/<name>` relative to the *output file's* directory,
    // which is only the repository root when the output happens to sit there.
    // Containing these under the repository root 404s every resumed image as
    // soon as the review runs from a subdirectory or with -o elsewhere; the
    // desktop resolves the same path against its working directory and finds
    // it.
    const assetRoot = ctx.session.outputPathInfo
      ? path.dirname(ctx.session.outputPathInfo.resolvedOutputPath)
      : ctx.repositoryRoot;
    const raw = ctx.url.searchParams.get('path');
    const resolved = raw ? containPath(assetRoot, raw) : null;
    if (resolved === null) {
      sendError(ctx.res, 400, 'path must be a file under the output directory');
      return;
    }
    // Core reads this path from disk directly, so it gets the contained real path.
    const data = await readAttachment(resolved);
    if (data === null) {
      sendError(ctx.res, 404, 'attachment not found');
      return;
    }
    const { res } = ctx;
    res.writeHead(200, {
      'content-type': 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(Buffer.from(data));
  },

  'POST /api/expand-context': async ({ req, res, session, repositoryRoot }) => {
    const body = await readJsonBody(req, MAX_EXPAND_CONTEXT_BODY_BYTES);
    if (!body.ok) {
      sendError(res, body.status, body.error);
      return;
    }
    const parsed = parseExpandContextBody(body.value);
    if (!parsed.ok) {
      sendError(res, 400, parsed.error);
      return;
    }
    // `filePath` becomes a git pathspec relative to the repository; contain
    // it here, then pass it through as sent (core adds the `--` separator).
    if (containPath(repositoryRoot, parsed.value.filePath) === null) {
      sendError(res, 400, 'filePath must be a file under the repository root');
      return;
    }
    sendJson(res, 200, await expandContext(session, parsed.value));
  },

  'POST /api/review': async ({ req, res, session }) => {
    const body = await readJsonBody(req, MAX_REVIEW_BODY_BYTES);
    if (!body.ok) {
      sendError(res, body.status, body.error);
      return;
    }
    const parsed = parseReviewStateBody(body.value);
    if (!parsed.ok) {
      sendError(res, 400, parsed.error);
      return;
    }
    submitReviewState(session, parsed.value);
    sendJson(res, 200, null);
  },
};

const ROUTE_PATHS = new Set(Object.keys(routes).map(key => key.split(' ')[1]));

/**
 * Serve one file from the client directory. `/` is `index.html`; everything
 * else is the decoded pathname contained under the directory. Anything that
 * is not a regular file under it — missing, a directory, a traversal — is a
 * 404, and a client directory that does not exist yet is just an empty one.
 */
async function serveStatic(
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
    'content-type': CONTENT_TYPES[path.extname(resolved).toLowerCase()] ?? 'application/octet-stream',
    'content-length': data.length,
  });
  res.end(data);
}

/**
 * Build the server for one review session. Taking the session and the root
 * as arguments — rather than reading module state — is what lets a test drive
 * it without a real repository, and mirrors how the core handlers take their
 * session explicitly. The returned server is not yet listening: bind it with
 * `listenLoopback`.
 */
export function createReviewServer(options: ReviewServerOptions): http.Server {
  const { session, repositoryRoot, clientDir = CLIENT_DIR } = options;

  return http.createServer(async (req, res) => {
    const method = req.method ?? 'GET';
    let url: URL;
    try {
      url = new URL(req.url ?? '/', 'http://localhost');
    } catch {
      sendError(res, 400, 'malformed request URL');
      return;
    }

    try {
      const handler = routes[`${method} ${url.pathname}`];
      if (handler) {
        await handler({ req, res, url, session, repositoryRoot });
      } else if (ROUTE_PATHS.has(url.pathname)) {
        sendError(res, 405, 'method not allowed');
      } else if (url.pathname.startsWith('/api/')) {
        sendError(res, 404, 'not found');
      } else if (method === 'GET') {
        await serveStatic(res, clientDir, url.pathname);
      } else {
        sendError(res, 404, 'not found');
      }
    } catch (error) {
      console.error(`[serve] ${method} ${url.pathname} failed:`, error);
      if (!res.headersSent) {
        sendError(res, 500, 'internal error');
      } else {
        res.end();
      }
    }
  });
}

/**
 * Bind the server to the loopback interface. The address is fixed here, not
 * left to the caller: `127.0.0.1`, never `0.0.0.0` and never the default.
 * `port` 0 asks the OS for an ephemeral port; the bound one is returned.
 */
export function listenLoopback(
  server: http.Server,
  port = 0
): Promise<{ port: number; url: string }> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      const address = server.address() as AddressInfo;
      resolve({ port: address.port, url: `http://127.0.0.1:${address.port}/` });
    });
  });
}
