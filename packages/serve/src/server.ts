// Eight JSON routes over one ReviewSession, each a thin wrapper over a function
// core already exports, plus static serving for the client bundle. node:http,
// no framework.
//
// Two properties are load-bearing: every route validates before core runs, and
// the listener both binds to loopback and refuses requests that name anything
// else. Binding alone is not enough — a web page can reach a loopback port, and
// DNS rebinding would make it same-origin. There is no authentication.

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

/** `client/` next to this module, which is `dist/client/` once built. */
export const CLIENT_DIR = fileURLToPath(new URL('./client/', import.meta.url));

/** Upper bound on a `POST /api/expand-context` body: a path and an integer. */
export const MAX_EXPAND_CONTEXT_BODY_BYTES = 64 * 1024;

/** Generous but finite: an unbounded read is a trivial denial of service. */
export const MAX_REVIEW_BODY_BYTES = 32 * 1024 * 1024;

export interface ReviewServerOptions {
  /** The session every route acts on; held for the process lifetime. */
  session: ReviewSession;
  /**
   * Root every request-supplied path is contained under. Must match what core
   * resolves against, or containment guarantees nothing.
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

/**
 * The page renders the diff under review, which is the least trusted input the
 * program handles. Rendered content is sanitized before it becomes elements;
 * this is the second line, for whatever gets past that.
 *
 * Inline styles are allowed because index.html carries a <style> block and
 * bundled libraries inject at runtime; blob: because attachments display
 * through createObjectURL.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'none'",
  "child-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

const SECURITY_HEADERS: http.OutgoingHttpHeaders = {
  'content-security-policy': CSP,
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
};

/** A browser may resolve the printed URL either way, or prefer IPv6. */
const LOOPBACK_HOSTNAMES: ReadonlySet<string> = new Set(['127.0.0.1', 'localhost', '[::1]']);

/** Lowercased, with an explicit `:80` dropped so it matches the bare host. */
function normalizeHost(value: string): string {
  const lowered = value.toLowerCase();
  return lowered.endsWith(':80') ? lowered.slice(0, -3) : lowered;
}

/**
 * A rebound request — an attacker's name re-resolved to 127.0.0.1 after the
 * page loads — still carries that name in `Host`, which is what distinguishes
 * it from a real one.
 *
 * The port is deliberately not compared against the bound port: an `ssh -L`
 * forward arrives carrying the forward's port, and refusing that would break
 * the use case this package exists for. It would buy nothing either, since a
 * rebound request fails on the hostname first.
 *
 * A duplicate `Host` is refused, not resolved: Node reads the first, and an
 * intermediary forwarding the last would be reading a different request.
 */
function hostIsLoopback(req: http.IncomingMessage): boolean {
  const host = req.headers.host;
  if (host === undefined) return false;

  let seen = 0;
  for (let i = 0; i < req.rawHeaders.length; i += 2) {
    if (req.rawHeaders[i].toLowerCase() === 'host') seen++;
  }
  if (seen !== 1) return false;

  // Split the optional port off, keeping an IPv6 literal's brackets.
  const match = /^(\[[^\]]*\]|[^:]*)(?::(\d+))?$/.exec(host);
  if (match === null) return false;
  return LOOPBACK_HOSTNAMES.has(match[1].toLowerCase());
}

/**
 * A missing `Origin` is allowed — navigations and curl send none. Rejected is
 * an `Origin` naming a different authority than `Host`, including the `null` a
 * sandboxed frame sends.
 *
 * Comparing against `Host` rather than a loopback allowlist is what survives a
 * port forward while still refusing another local page: a dev server on :3000
 * sends its own origin and this listener's host, and those differ.
 */
function originMatchesHost(req: http.IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (origin === undefined) return true;
  const host = req.headers.host;
  if (host === undefined) return false;
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:') return false;
  // `new URL` parses away userinfo, paths and leading-zero ports, any of which
  // would compare equal to this authority. A browser sends none of them.
  if (origin !== `${parsed.protocol}//${parsed.host}`) return false;
  return normalizeHost(parsed.host) === normalizeHost(host);
}

/**
 * Set by the browser, unforgeable by page script. A cross-site *GET* — an <img>
 * aimed at this port — carries no `Origin`, so without this it would be served
 * and only the absence of CORS headers would stop the page reading it.
 *
 * Non-browser clients send no such header and are unaffected.
 */
function fetchSiteIsSelf(req: http.IncomingMessage): boolean {
  const site = req.headers['sec-fetch-site'];
  if (site === undefined) return true;
  return site === 'same-origin' || site === 'none';
}

function sendJson(
  res: http.ServerResponse,
  status: number,
  value: unknown,
  headers: http.OutgoingHttpHeaders = {}
): void {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...SECURITY_HEADERS,
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
 * Contain the `path` parameter under the repository root. Returns it both as
 * sent (core interprets it relative to the repository) and resolved (for a
 * handler reading disk directly), or answers 400 and returns null.
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
 * The declared length is checked before a byte is read and the running total
 * during it, so a chunked body without a length is capped too.
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

// Each route validates, calls exactly one core function, and sends its result.

const routes: Record<string, RouteHandler> = {
  'GET /api/diff': async ({ res, session }) => {
    // The guide rides with the diff, so the client needs no push channel.
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
    // Core resolves against the repository itself, so it gets the raw value.
    sendJson(ctx.res, 200, await loadImage(ctx.session, contained.raw));
  },

  'GET /api/attachment': async ctx => {
    // A different namespace from diff paths, and a different root: review.xml
    // records these relative to the output file's directory. Rooting them at
    // the repository 404s every resumed image when -o points elsewhere.
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
      ...SECURITY_HEADERS,
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
    // Becomes a git pathspec; contain it, then pass it through as sent.
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
 * `/` is index.html; everything else is contained under the client directory.
 * Anything that is not a regular file under it is a 404.
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
    ...SECURITY_HEADERS,
  });
  res.end(data);
}

/**
 * Taking the session explicitly rather than reading module state mirrors the
 * core handlers and lets a test drive this without a repository. Not yet
 * listening: bind it with `listenLoopback`.
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

    // Before anything is routed: this listener answers only to itself.
    if (!hostIsLoopback(req) || !originMatchesHost(req) || !fetchSiteIsSelf(req)) {
      sendError(res, 403, 'forbidden');
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
 * The address is fixed here, not left to the caller: never `0.0.0.0`, never the
 * default. Port 0 asks the OS for an ephemeral one.
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
