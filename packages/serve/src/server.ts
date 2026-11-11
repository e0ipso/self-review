// Nine JSON routes over one ReviewSession, each a thin wrapper over a function
// core already exports, plus static serving for the client bundle. node:http,
// no framework.
//
// Three properties are load-bearing: every route validates before core runs; the listener both binds
// to loopback and refuses requests that name anything else (a web page can reach loopback, and DNS
// rebinding would make it same-origin); and every API route requires the session capability (see ./protocol.ts).
// `POST /api/review` publishes before it answers.

import * as http from 'node:http';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';
import { parseAttachmentReference } from '@self-review/core';
import type {
  ReviewOutputTarget as CoreReviewOutputTarget,
  ReviewSession,
} from '@self-review/core';
import { parseExpandContextBody, parseReviewStateBody, parseSuggestionApplyBody } from './validate';
import { MAX_REVIEW_BODY_BYTES, MAX_APPLY_BODY_BYTES } from './protocol';
import {
  allowRequest,
  readJsonBody,
  sendJson,
  sendError,
  SECURITY_HEADERS,
} from './http-transport';
import { serveStatic } from './static-assets';
import { createReviewOperations, type ReviewOperations } from './review-operations';
import { ReviewSubmission, publishFailureStatus } from './review-submission';
import {
  RequestAdmission,
  REQUEST_SHUTDOWN,
  type AdmissionOptions,
  type ManagedReviewServer,
  type RequestKind,
} from './request-admission';
import { REVIEW_PUBLISHED } from './lifecycle';

export { MAX_REVIEW_BODY_BYTES } from './protocol';

// Resolved on demand: import.meta.url is not a file URL in the browser-like test environment.
export function defaultClientDir(): string {
  return fileURLToPath(new URL('./client/', import.meta.url));
}

/** A path and an integer, rather than source text or attachments. */
export const MAX_EXPAND_CONTEXT_BODY_BYTES = 64 * 1024;
export type ReviewOutputTarget = CoreReviewOutputTarget;

interface ReviewTransportOptions extends AdmissionOptions {
  /** Bearer token required on every API request; never returned by the server. */
  capability: string;
  clientDir?: string;
}
/** Primary construction consumes bound operations; composition belongs to the CLI. */
export interface BoundReviewServerOptions extends ReviewTransportOptions {
  operations: ReviewOperations;
}
/** Existing session/output call forms remain supported. */
export interface ReviewServerOptions extends ReviewTransportOptions {
  session: ReviewSession;
  output: ReviewOutputTarget;
  operations?: ReviewOperations;
}

interface RouteContext {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  url: URL;
  operations: ReviewOperations;
  submission: ReviewSubmission;
  signal: AbortSignal;
  published: (response: http.ServerResponse) => void;
}

type RouteHandler = (ctx: RouteContext) => Promise<void>;

const REVIEWED_PATH_ERROR = 'path must name a file in the reviewed diff';

/** Core's authorization; answers 400 and returns false when `filePath` is not a reviewed path. */
function requireReviewedPath(ctx: RouteContext, filePath: string, what = 'path'): boolean {
  if (ctx.operations.authorizeReviewedPath(filePath).ok) return true;
  sendError(
    ctx.res,
    400,
    what === 'path' ? REVIEWED_PATH_ERROR : `${what} must name a file in the reviewed diff`
  );
  return false;
}

function requireReviewedQueryPath(ctx: RouteContext): string | null {
  const raw = ctx.url.searchParams.get('path');
  if (raw === null) {
    sendError(ctx.res, 400, REVIEWED_PATH_ERROR);
    return null;
  }
  return requireReviewedPath(ctx, raw) ? raw : null;
}

// Each route validates, calls exactly one core function, and sends its result.

const routes: Record<string, RouteHandler> = {
  'GET /api/diff': async ({ res, operations }) => {
    // The guide rides with the diff, so the client needs no push channel.
    sendJson(res, 200, operations.getDiffLoad());
  },

  'GET /api/config': async ({ res, operations }) => {
    sendJson(res, 200, operations.getConfigLoad());
  },

  'GET /api/resume': async ({ res, operations }) => {
    sendJson(res, 200, operations.getResumeLoad());
  },

  'GET /api/file': async ctx => {
    const filePath = requireReviewedQueryPath(ctx);
    if (filePath === null) return;
    // Diff paths are source-relative strings; core matches on them as sent.
    sendJson(ctx.res, 200, ctx.operations.getFileHunks(filePath));
  },

  'GET /api/image': async ctx => {
    const filePath = requireReviewedQueryPath(ctx);
    if (filePath === null) return;
    // Core reads the reviewed snapshot under the same identity it just authorized.
    sendJson(ctx.res, 200, await ctx.operations.loadImage(filePath, { signal: ctx.signal }));
  },

  'GET /api/attachment': async ctx => {
    // Not a diff path: a `.self-review-assets/<name>` reference core resolves itself; only its shape is checked here.
    const raw = ctx.url.searchParams.get('path');
    if (raw === null || parseAttachmentReference(raw) === null) {
      sendError(ctx.res, 400, 'path must name a file in the .self-review-assets directory');
      return;
    }
    const result = await ctx.operations.readAttachment(raw, { signal: ctx.signal });
    if (!result.ok) {
      const status =
        result.reason === 'not-authorized' ? 400 : result.reason === 'too-large' ? 413 : 404;
      sendError(ctx.res, status, status === 404 ? 'attachment not found' : result.message);
      return;
    }
    const { res } = ctx;
    res.writeHead(200, {
      'content-type': 'application/octet-stream',
      'cache-control': 'no-store',
      ...SECURITY_HEADERS,
    });
    res.end(Buffer.from(result.data));
  },

  'POST /api/expand-context': async ctx => {
    const { req, res, operations } = ctx;
    const body = await readJsonBody(req, MAX_EXPAND_CONTEXT_BODY_BYTES, ctx.signal);
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
    sendJson(res, 200, await operations.expandContext(parsed.value, { signal: ctx.signal }));
  },

  // The one route that rewrites a file in the reviewed tree. Core refuses unless the anchored lines still
  // match the suggestion's recorded original byte for byte, and resolves the destination itself.
  'POST /api/apply-suggestion': async ctx => {
    const { req, res, operations } = ctx;
    const body = await readJsonBody(req, MAX_APPLY_BODY_BYTES, ctx.signal);
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
    sendJson(
      res,
      200,
      await operations.applySuggestionForSession(parsed.value, { signal: ctx.signal })
    );
  },

  // One admitted publication owns completion. Invalid or refused attempts reopen admission.
  'POST /api/review': async ({ req, res, submission, published, signal }) => {
    if (!submission.begin()) {
      sendError(res, 409, 'review submission already in progress or complete');
      return;
    }
    try {
      const body = await readJsonBody(req, MAX_REVIEW_BODY_BYTES, signal);
      if (!body.ok) {
        sendError(res, body.status, body.error);
        return;
      }
      const parsed = parseReviewStateBody(body.value);
      if (!parsed.ok) {
        sendError(res, 400, parsed.error);
        return;
      }
      if (signal.aborted) throw signal.reason;
      const outcome = await submission.publish(parsed.value, { signal });
      if (outcome.ok) {
        published(res);
        sendJson(res, 200, outcome);
      } else {
        sendJson(res, publishFailureStatus(outcome.code), outcome);
      }
    } finally {
      submission.release();
    }
  },
};

const ROUTE_PATHS = new Set(Object.keys(routes).map(key => key.split(' ')[1]));

/**
 * Bound operations keep engine composition outside the transport. The legacy
 * session/output overload composes the same defaults for existing callers.
 * Not yet listening: bind it with `listenLoopback`.
 */
export function createReviewServer(options: BoundReviewServerOptions): ManagedReviewServer;
export function createReviewServer(options: ReviewServerOptions): ManagedReviewServer;
export function createReviewServer(
  options: BoundReviewServerOptions | ReviewServerOptions
): ManagedReviewServer {
  const { capability, clientDir = defaultClientDir() } = options;
  const operations =
    options.operations ??
    createReviewOperations(
      (options as ReviewServerOptions).session,
      (options as ReviewServerOptions).output
    );
  const submission = new ReviewSubmission(operations);
  const admission = new RequestAdmission({
    maxRequests: options.maxRequests,
    maxExpensiveReads: options.maxExpensiveReads,
    requestTimeoutMs: options.requestTimeoutMs,
  });
  const published = (response: http.ServerResponse) =>
    server.emit(REVIEW_PUBLISHED, response, () => admission.drain());

  const dispatch = async (req: http.IncomingMessage, res: http.ServerResponse) => {
    const method = req.method ?? 'GET';
    let url: URL;
    try {
      url = new URL(req.url ?? '/', 'http://localhost');
    } catch {
      sendError(res, 400, 'malformed request URL');
      return;
    }

    if (!allowRequest(req, res, url, capability)) return;
    if (submission.completed) {
      sendError(res, 503, 'review complete; server is stopping');
      return;
    }

    try {
      const handler = routes[`${method} ${url.pathname}`];
      if (handler) {
        const kind: RequestKind =
          url.pathname === '/api/review'
            ? 'publication'
            : url.pathname === '/api/apply-suggestion' || url.pathname === '/api/expand-context'
              ? 'mutation'
              : url.pathname === '/api/image' || url.pathname === '/api/attachment'
                ? 'expensive-read'
                : 'read';
        const rejection = admission.rejection(kind);
        if (rejection) {
          sendJson(res, rejection.status, { error: rejection.error }, { connection: 'close' });
          return;
        }
        admission.run(
          req,
          res,
          kind,
          async signal => {
            try {
              await handler({ req, res, url, operations, submission, published, signal });
            } catch (error) {
              if (!signal.aborted)
                console.error(`[serve] ${method} ${url.pathname} failed:`, error);
              if (!res.headersSent && !res.destroyed) sendError(res, 500, 'internal error');
              else if (!res.writableEnded) res.end();
            }
          },
          () => {
            if (!res.headersSent && !res.destroyed)
              sendJson(
                res,
                503,
                { error: 'request deadline exceeded; operation outcome may be unknown' },
                { connection: 'close' }
              );
            else if (!res.writableEnded) res.destroy();
          }
        );
      } else if (ROUTE_PATHS.has(url.pathname)) {
        sendError(res, 405, 'method not allowed');
      } else if (url.pathname.startsWith('/api/')) {
        sendError(res, 404, 'not found');
      } else if (method === 'GET') {
        const rejection = admission.rejection('read');
        if (rejection) {
          sendJson(res, rejection.status, { error: rejection.error }, { connection: 'close' });
          return;
        }
        admission.run(
          req,
          res,
          'read',
          async () => {
            try {
              await serveStatic(res, clientDir, url.pathname);
            } catch {
              if (!res.headersSent && !res.destroyed) sendError(res, 500, 'internal error');
              else res.destroy();
            }
          },
          () => res.destroy()
        );
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
  };

  const server = http.createServer((req, res) => {
    void dispatch(req, res);
  }) as ManagedReviewServer;
  server[REQUEST_SHUTDOWN] = () => admission.shutdown();
  server.headersTimeout = 15_000;
  server.requestTimeout = 60_000;
  return server;
}

/**
 * The address is fixed here, not left to the caller: never `0.0.0.0`, never the
 * default. Port 0 asks the OS for an ephemeral one.
 */
export function listenLoopback(
  server: http.Server,
  port = 0,
  options: { signal?: AbortSignal } = {}
): Promise<{ port: number; url: string }> {
  return new Promise((resolve, reject) => {
    const { signal } = options;
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const cleanup = () => {
      signal?.removeEventListener('abort', onAbort);
      server.off('error', onError);
      server.off('listening', onListening);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onAbort = () => {
      cleanup();
      server.close();
      reject(signal?.reason);
    };
    const onListening = () => {
      cleanup();
      if (signal?.aborted) {
        server.close();
        reject(signal.reason);
        return;
      }
      const address = server.address() as AddressInfo;
      resolve({ port: address.port, url: `http://127.0.0.1:${address.port}/` });
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen({ port, host: '127.0.0.1', signal });
  });
}
