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
import type {
  ReviewOutputTarget as CoreReviewOutputTarget,
  ReviewSession,
} from '@self-review/core';
import { allowRequest, sendJson, sendError } from './http-transport';
import { serveStatic } from './static-assets';
import { createReviewOperations, type ReviewOperations } from './review-operations';
import { ReviewSubmission } from './review-submission';
import { createApiRoutes } from './api-routes';
export { MAX_EXPAND_CONTEXT_BODY_BYTES } from './api-routes';
import {
  RequestAdmission,
  REQUEST_SHUTDOWN,
  type AdmissionOptions,
  type ManagedReviewServer,
} from './request-admission';
import { REVIEW_PUBLISHED } from './lifecycle';

export { MAX_REVIEW_BODY_BYTES } from './protocol';

// Resolved on demand: import.meta.url is not a file URL in the browser-like test environment.
export function defaultClientDir(): string {
  return fileURLToPath(new URL('./client/', import.meta.url));
}

export type ReviewOutputTarget = CoreReviewOutputTarget;

interface ReviewTransportOptions extends AdmissionOptions {
  /** Bearer token required on every API request; never returned by the server. */
  capability: string;
  clientDir?: string;
  /** Accepted sockets, including idle peers and incomplete HTTP headers. */
  maxConnections?: number;
  /** Submission messages; defaults to stderr. Reporter failures do not change outcomes. */
  reportDiagnostic?: (message: string) => void;
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
  const maxConnections = options.maxConnections ?? 64;
  if (!Number.isSafeInteger(maxConnections) || maxConnections < 1) {
    throw new Error('Connection limit must be a positive safe integer.');
  }
  const submission = new ReviewSubmission(operations, options.reportDiagnostic);
  const admission = new RequestAdmission({
    maxRequests: options.maxRequests,
    maxExpensiveReads: options.maxExpensiveReads,
    requestTimeoutMs: options.requestTimeoutMs,
  });
  const published = (response: http.ServerResponse) =>
    server.emit(REVIEW_PUBLISHED, response, () => admission.drain());

  const routes = createApiRoutes(operations, submission, published);
  const routePaths = new Set(Object.keys(routes).map(key => key.split(' ')[1]));

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
      const route = routes[`${method} ${url.pathname}`];
      if (route) {
        const { kind, handle } = route;
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
              await handle({ req, res, url, signal });
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
      } else if (routePaths.has(url.pathname)) {
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
          async signal => {
            try {
              await serveStatic(res, clientDir, url.pathname, { signal });
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
  // node:net closes excess sockets before HTTP parses any request bytes.
  server.maxConnections = maxConnections;
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
