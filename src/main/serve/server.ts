// src/main/serve/server.ts
// The serve-mode HTTP listener.
//
// Built on `node:http` with no framework: the route surface is a handful of
// endpoints with no middleware requirements, and a switch on method and
// pathname is the whole router. Nothing here imports `electron` — the request
// handlers come from `../review-handlers`, the same module the Electron IPC
// layer adapts, so the two front ends run one implementation.
//
// This module owns transport only. Session state arrives fully populated in
// the `ReviewSession` the bootstrap resolved before the listener was told to
// accept anything.

import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import type { AddressInfo } from 'net';
import { serializeReview } from '../xml-serializer';
import { handleReviewSubmit, type ReviewSession } from '../review-handlers';
import type { ReviewState } from '../../shared/types';
import { contentTypeFor, resolveStaticFile } from './client-assets';

/** Refuse a review body larger than this rather than buffering it forever. */
const MAX_BODY_BYTES = 64 * 1024 * 1024;

/**
 * How long a shutdown waits for sockets to drain before destroying them.
 * The review response carries `Connection: close`, so in practice the browser's
 * socket is already gone; this only bounds a client that ignores that.
 */
const SHUTDOWN_GRACE_MS = 1000;

export interface ServeServerDeps {
  /** Startup-resolved session: diff, guide, config, output path info, resume data. */
  session: ReviewSession;
  /** Absolute path the review XML is written to when the reviewer finishes. */
  outputPath: string;
  /** Directory holding the built browser client. May not exist. */
  clientDir: string;
  /**
   * Called once the review response has been flushed to the client. The
   * bootstrap stops the server here, which ends the process: the review is the
   * session, and the session is over.
   */
  onReviewComplete: () => void;
  /**
   * Writes the review. Defaults to the same `@self-review/core` serializer the
   * desktop app calls, then a plain file write. A seam for tests only.
   */
  writeReview?: (state: ReviewState, outputPath: string) => Promise<void>;
}

/** The `GET /api/config` response body. */
export interface ServeConfigResponse {
  config: unknown;
  outputPathInfo: unknown;
  /**
   * Always true. Serve mode fixes the output path at launch: there is no
   * browser equivalent of the native save dialog, and the UI must offer no
   * control for changing it.
   */
  outputPathReadOnly: true;
}

async function defaultWriteReview(state: ReviewState, outputPath: string): Promise<void> {
  const xml = await serializeReview(state, outputPath);
  await fs.promises.writeFile(outputPath, xml + '\n', 'utf-8');
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

function sendText(res: http.ServerResponse, status: number, body: string): void {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

/** Read a request body with a hard size cap. */
function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

/**
 * Build the request listener.
 *
 * Exposed separately from {@link createServeServer} so the routing can be
 * exercised without a socket where that is simpler.
 */
export function createRequestHandler(
  deps: ServeServerDeps
): (req: http.IncomingMessage, res: http.ServerResponse) => void {
  const writeReview = deps.writeReview ?? defaultWriteReview;

  return (req, res) => {
    let pathname: string;
    try {
      pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    } catch {
      sendJson(res, 400, { error: 'Malformed request path' });
      return;
    }

    if (pathname.startsWith('/api/')) {
      void handleApi(req, res, pathname, deps, writeReview);
      return;
    }

    serveStatic(req, res, pathname, deps.clientDir);
  };
}

async function handleApi(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  deps: ServeServerDeps,
  writeReview: (state: ReviewState, outputPath: string) => Promise<void>
): Promise<void> {
  const method = req.method ?? 'GET';

  if (pathname === '/api/config') {
    if (method !== 'GET' && method !== 'HEAD') {
      sendJson(res, 405, { error: `${method} not allowed on /api/config` });
      return;
    }
    if (!deps.session.config) {
      // Unreachable via the bootstrap, which resolves configuration before it
      // listens. Reported rather than crashed if that order is ever broken.
      sendJson(res, 500, { error: 'Configuration was not resolved at startup' });
      return;
    }
    const body: ServeConfigResponse = {
      config: deps.session.config,
      outputPathInfo: deps.session.outputPathInfo,
      outputPathReadOnly: true,
    };
    sendJson(res, 200, body);
    return;
  }

  if (pathname === '/api/review') {
    if (method !== 'POST') {
      sendJson(res, 405, { error: `${method} not allowed on /api/review` });
      return;
    }
    await handleReviewPost(req, res, deps, writeReview);
    return;
  }

  sendJson(res, 404, { error: `No such endpoint: ${pathname}` });
}

/**
 * The end of the session.
 *
 * Order is load-bearing: write the XML, respond, and only then stop the
 * server. Closing first produces a failed request on a review that actually
 * succeeded. A failure to write is *not* the end of the session — the server
 * keeps listening so the reviewer can fix the cause and submit again, and
 * nothing else in serve mode ever writes to the output path.
 */
async function handleReviewPost(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  deps: ServeServerDeps,
  writeReview: (state: ReviewState, outputPath: string) => Promise<void>
): Promise<void> {
  let state: ReviewState;
  try {
    const raw = await readBody(req);
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as ReviewState).files)) {
      sendJson(res, 400, { error: 'Review body must be a review state object' });
      return;
    }
    state = parsed as ReviewState;
  } catch (error) {
    sendJson(res, 400, {
      error: `Could not read the review body: ${error instanceof Error ? error.message : String(error)}`,
    });
    return;
  }

  handleReviewSubmit(deps.session, state);

  try {
    await writeReview(state, deps.outputPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[serve] Failed to write the review: ${message}`);
    sendJson(res, 500, { error: `Failed to write the review: ${message}` });
    return;
  }

  console.error(`[serve] Review written to ${deps.outputPath}`);

  const payload = JSON.stringify({ ok: true, outputPath: deps.outputPath });
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    // Let the socket go on its own, so the shutdown below has nothing to wait
    // for and the browser sees a clean end rather than a reset connection.
    Connection: 'close',
  });
  res.end(payload, () => {
    deps.onReviewComplete();
  });
}

/**
 * Serve the built client. An unknown path falls back to the entry document so
 * client-side routes survive a reload; `/api/*` never reaches here, so a
 * mistyped endpoint is a 404 rather than a page.
 */
function serveStatic(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  clientDir: string
): void {
  const method = req.method ?? 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    sendText(res, 405, `${method} not allowed`);
    return;
  }

  const indexPath = path.join(clientDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    sendText(
      res,
      503,
      'The serve-mode browser client has not been built.\n' +
        `Expected an index.html in: ${clientDir}\n` +
        'The API is available; the UI is not.\n'
    );
    return;
  }

  const lookup = resolveStaticFile(clientDir, pathname);
  if (lookup.kind === 'escape') {
    sendText(res, 404, `Not found: ${pathname}`);
    return;
  }
  if (lookup.kind === 'missing' && /\.[a-z0-9]+$/i.test(pathname)) {
    // A request that names a file extension and matched nothing is a missing
    // asset, not a client route. Falling back to the document there would ship
    // HTML under a JavaScript content type.
    sendText(res, 404, `Not found: ${pathname}`);
    return;
  }

  const target = lookup.kind === 'file' ? lookup.path : indexPath;
  let body: Buffer;
  try {
    body = fs.readFileSync(target);
  } catch {
    sendText(res, 404, `Not found: ${pathname}`);
    return;
  }

  res.writeHead(200, {
    'Content-Type': contentTypeFor(target),
    'Content-Length': body.length,
    // The bundle is rebuilt per session and the session is short; never cache.
    'Cache-Control': 'no-store',
  });
  if (method === 'HEAD') {
    res.end();
    return;
  }
  res.end(body);
}

/** Create the listener. It is not listening until {@link listen} is called. */
export function createServeServer(deps: ServeServerDeps): http.Server {
  return http.createServer(createRequestHandler(deps));
}

/** Start listening, resolving with the bound address. */
export function listen(
  server: http.Server,
  host: string,
  port: number
): Promise<AddressInfo> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error): void => {
      server.removeListener('listening', onListening);
      reject(error);
    };
    const onListening = (): void => {
      server.removeListener('error', onError);
      resolve(server.address() as AddressInfo);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });
}

/**
 * Stop the server, bounded.
 *
 * `server.close()` alone waits for every keep-alive socket, which a browser
 * holds open indefinitely — so idle sockets are dropped immediately and the
 * rest are destroyed after a short grace period. Resolves once nothing is
 * listening.
 */
export function stopServer(server: http.Server): Promise<void> {
  return new Promise(resolve => {
    let settled = false;
    const done = (): void => {
      if (settled) return;
      settled = true;
      clearTimeout(force);
      resolve();
    };

    const force = setTimeout(() => {
      server.closeAllConnections();
      done();
    }, SHUTDOWN_GRACE_MS);
    force.unref();

    server.close(() => done());
    server.closeIdleConnections();
  });
}
