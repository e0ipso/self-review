// Nine JSON routes over one ReviewSession, each a thin wrapper over a function
// core already exports, plus static serving for the client bundle. node:http,
// no framework.
//
// Three properties are load-bearing: every route validates before core runs;
// the listener both binds to loopback and refuses requests that name anything
// else, since binding alone is not enough — a web page can reach a loopback
// port, and DNS rebinding would make it same-origin; and every API route
// requires the session capability, since none of that tells the reviewer from
// another account on the same machine. The page gets the capability through
// the launch URL's fragment (see ./protocol.ts) and presents it as a bearer
// token; the page and its assets are served to anyone and carry no token.
//
// One route does more than wrap: `POST /api/review` publishes the document
// before it answers, so its 200 is a durable acknowledgement and its failure
// is something the reviewer can fix and retry without losing the review.

import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';
import {
  authorizeReviewedPath,
  getDiffLoad,
  getConfigLoad,
  getResumeLoad,
  getFileHunks,
  loadImage,
  readAttachment,
  resolveSourceBaseDir,
  expandContext,
  submitReviewState,
  applySuggestionForSession,
  publishReview,
  ReviewPublishError,
} from '@self-review/core';
import type {
  PublishReviewOptions,
  ReviewPublishErrorCode,
  ReviewSession,
  ReviewState,
} from '@self-review/core';
import {
  containPath,
  parseExpandContextBody,
  parseReviewStateBody,
  parseSuggestionApplyBody,
} from './validate';
import { capabilityMatches } from './capability';
import { CAPABILITY_SCHEME, MAX_REVIEW_BODY_BYTES } from './protocol';
import type { ReviewSubmitAck, ReviewSubmitFailure } from './protocol';

export { MAX_REVIEW_BODY_BYTES } from './protocol';

/**
 * `client/` next to this module, which is `dist/client/` once built.
 *
 * Resolved on demand rather than at import: `import.meta.url` is only a
 * `file:` URL when this module runs in Node proper, and the client's own
 * suite imports it under a browser-like environment with a fixture in hand.
 */
export function defaultClientDir(): string {
  return fileURLToPath(new URL('./client/', import.meta.url));
}

/** Upper bound on a `POST /api/expand-context` body: a path and an integer. */
export const MAX_EXPAND_CONTEXT_BODY_BYTES = 64 * 1024;

/**
 * Where a submitted review is published, fixed for the life of the process.
 *
 * The origin decides how far the publisher trusts the path: one the reviewer
 * named (`--output`) may point anywhere; one inherited from project
 * configuration or the default must stay inside `baseDir`, so a committed
 * `.self-review.yaml` cannot redirect the save.
 */
export type ReviewOutputTarget =
  | { path: string; origin: 'explicit' }
  | { path: string; origin: 'inherited'; baseDir: string };

export interface ReviewServerOptions {
  /**
   * The session every route acts on; held for the process lifetime. Every
   * request-supplied diff path is authorized against its source identity by
   * core — the same object core reads from — so there is no separate root
   * for the routes to get wrong (audit A6).
   */
  session: ReviewSession;
  /** Where `POST /api/review` publishes. No route changes it. */
  output: ReviewOutputTarget;
  /**
   * The session capability every `/api/` request must present as a bearer
   * token. Drawn once per process by `generateCapability()` and delivered
   * only through the launch URL's fragment; the server never sends it.
   */
  capability: string;
  /** Directory of the client bundle. Defaults to `defaultClientDir()`; tests inject a fixture. */
  clientDir?: string;
}

interface RouteContext {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  url: URL;
  session: ReviewSession;
  output: ReviewOutputTarget;
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
 * Whether the request presents the session capability. The scheme is
 * matched case-insensitively, as the header grammar says; the token is
 * compared in constant time. Only the header is consulted: a token in the
 * query string would land in history and logs, so it is never accepted there.
 */
function presentsCapability(req: http.IncomingMessage, capability: string): boolean {
  const header = req.headers.authorization;
  if (header === undefined) return false;
  const space = header.indexOf(' ');
  if (space === -1) return false;
  if (header.slice(0, space).toLowerCase() !== CAPABILITY_SCHEME.toLowerCase()) return false;
  return capabilityMatches(capability, header.slice(space + 1).trim());
}

/** 401, with nothing in the body a client did not already know. */
function sendUnauthorized(res: http.ServerResponse): void {
  sendJson(res, 401, { error: 'unauthorized' }, { 'www-authenticate': CAPABILITY_SCHEME });
}

const REVIEWED_PATH_ERROR = 'path must name a file in the reviewed diff';

/**
 * Whether `filePath` names a file this session reviewed, by core's own
 * authorization: the path must be relative, stay inside the source root and
 * be one the committed diff contained. Core then resolves exactly the path
 * it authorized, so the check and the read cannot disagree. Answers 400 and
 * returns false otherwise.
 */
function requireReviewedPath(ctx: RouteContext, filePath: string, what = 'path'): boolean {
  if (authorizeReviewedPath(ctx.session, filePath).ok) return true;
  sendError(
    ctx.res,
    400,
    what === 'path' ? REVIEWED_PATH_ERROR : `${what} must name a file in the reviewed diff`
  );
  return false;
}

/** The `path` query parameter, authorized as a reviewed path, or null after a 400. */
function requireReviewedQueryPath(ctx: RouteContext): string | null {
  const raw = ctx.url.searchParams.get('path');
  if (raw === null) {
    sendError(ctx.res, 400, REVIEWED_PATH_ERROR);
    return null;
  }
  return requireReviewedPath(ctx, raw) ? raw : null;
}

type BodyResult = { ok: true; value: unknown } | { ok: false; status: number; error: string };

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
    const filePath = requireReviewedQueryPath(ctx);
    if (filePath === null) return;
    // Diff paths are source-relative strings; core matches on them as sent.
    sendJson(ctx.res, 200, getFileHunks(ctx.session, filePath));
  },

  'GET /api/image': async ctx => {
    const filePath = requireReviewedQueryPath(ctx);
    if (filePath === null) return;
    // Core reads the reviewed snapshot under the same identity it just authorized.
    sendJson(ctx.res, 200, await loadImage(ctx.session, filePath));
  },

  'GET /api/attachment': async ctx => {
    // A different namespace from diff paths, and a different root: review.xml
    // records these relative to the output file's directory. Rooting them at
    // the repository 404s every resumed image when -o points elsewhere.
    const assetRoot = ctx.session.outputPathInfo
      ? path.dirname(ctx.session.outputPathInfo.resolvedOutputPath)
      : resolveSourceBaseDir(ctx.session);
    const raw = ctx.url.searchParams.get('path');
    const resolved = raw && assetRoot ? containPath(assetRoot, raw) : null;
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

  'POST /api/expand-context': async ctx => {
    const { req, res, session } = ctx;
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
    // Becomes a git pathspec; authorized as a reviewed path, then passed through as sent.
    if (!requireReviewedPath(ctx, parsed.value.filePath, 'filePath')) return;
    sendJson(res, 200, await expandContext(session, parsed.value));
  },

  // The one route that rewrites a file in the reviewed tree. Core refuses
  // unless the anchored lines still match the suggestion's recorded original
  // byte for byte, and resolves the destination itself; the path is
  // authorized here too, so a request cannot even name a file the review
  // never contained.
  'POST /api/apply-suggestion': async ctx => {
    const { req, res, session } = ctx;
    const body = await readJsonBody(req, MAX_EXPAND_CONTEXT_BODY_BYTES);
    if (!body.ok) {
      sendError(res, body.status, body.error);
      return;
    }
    const parsed = parseSuggestionApplyBody(body.value);
    if (!parsed.ok) {
      sendError(res, 400, parsed.error);
      return;
    }
    if (!requireReviewedPath(ctx, parsed.value.filePath, 'filePath')) return;
    sendJson(res, 200, applySuggestionForSession(session, parsed.value));
  },

  // The completion. The document is published before the response is
  // written, so a 200 is a file on disk and a failure is a server that is
  // still up, holding nothing: the review lives in the tab, and the same
  // submission can be sent again once the reported problem is fixed.
  'POST /api/review': async ({ req, res, session, output }) => {
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
    const outcome = await publishSubmittedReview(parsed.value, output);
    if (outcome.ok) {
      sendJson(res, 200, outcome);
    } else {
      sendJson(res, publishFailureStatus(outcome.code), outcome);
    }
  },
};

/**
 * Publish one submitted review. Every failure the publisher reports is
 * returned, never thrown: the route answers with it and keeps serving.
 */
async function publishSubmittedReview(
  state: ReviewState,
  output: ReviewOutputTarget
): Promise<ReviewSubmitAck | ReviewSubmitFailure> {
  const options: PublishReviewOptions =
    output.origin === 'explicit'
      ? { outputOrigin: 'explicit' }
      : { outputOrigin: 'inherited', baseDir: output.baseDir };
  try {
    const { outputPath } = await publishReview(state, output.path, options);
    console.error(`[serve] Review written to ${outputPath}`);
    return { ok: true, outputPath };
  } catch (error) {
    if (!(error instanceof ReviewPublishError)) throw error;
    console.error(`[serve] Review not saved (${error.code}): ${error.message}`);
    for (const detail of error.details) {
      console.error(`[serve]   ${detail}`);
    }
    console.error(
      '[serve] The review is still open in the browser. Fix the problem and press Finish Review again.'
    );
    return { ok: false, code: error.code, message: error.message, details: [...error.details] };
  }
}

/** The document is the client's to fix; the filesystem is the host's. */
const DOCUMENT_ERROR_CODES: ReadonlySet<ReviewPublishErrorCode> = new Set([
  'validation-failed',
  'xml-illegal-character',
]);

function publishFailureStatus(code: ReviewPublishErrorCode): number {
  return DOCUMENT_ERROR_CODES.has(code) ? 422 : 500;
}

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
    'content-type':
      CONTENT_TYPES[path.extname(resolved).toLowerCase()] ?? 'application/octet-stream',
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
  const { session, output, capability, clientDir = defaultClientDir() } = options;

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

    // Then, for the API, only to the reviewer. The page and its assets are
    // served to anyone — they carry no token and reveal nothing — but every
    // route under /api/ is refused before it is even looked up, so a client
    // without the capability learns neither the data nor the route table.
    if (url.pathname.startsWith('/api/') && !presentsCapability(req, capability)) {
      sendUnauthorized(res);
      return;
    }

    try {
      const handler = routes[`${method} ${url.pathname}`];
      if (handler) {
        await handler({ req, res, url, session, output });
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
