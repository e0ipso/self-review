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
import { allowRequest, sendJson, sendError } from './http-transport';
import { serveStatic } from './static-assets';
import type { ReviewTransportOperations } from './review-operations';
import { nonThrowingReporter } from './diagnostic-reporter';
import { ReviewSubmission } from './review-submission';
import { createBoundApiRoutes } from './bound-api-routes';
import { bindRouteValidation } from './route-composition';
export { MAX_EXPAND_CONTEXT_BODY_BYTES } from './api-routes';
import {
  RequestAdmission,
  REQUEST_SHUTDOWN,
  type AdmissionOptions,
  type ManagedReviewServer,
  type RequestKind,
} from './request-admission';
import { JsonResponseLimitError } from './json-response';
import { REVIEW_PUBLISHED } from './lifecycle';

export { MAX_REVIEW_BODY_BYTES } from './protocol';

// Resolved on demand: import.meta.url is not a file URL in the browser-like test environment.
export function defaultClientDir(): string {
  return fileURLToPath(new URL('./client/', import.meta.url));
}

export interface ReviewTransportOptions extends AdmissionOptions {
  /** Bearer token required on every API request; never returned by the server. */
  capability: string;
  clientDir?: string;
  /** Accepted sockets, including idle peers and incomplete HTTP headers. */
  maxConnections?: number;
  /** Transport and submission messages; defaults to stderr. Reporter failures do not change outcomes. */
  reportDiagnostic?: (message: string) => void;
}
/** Transport accepts already bound reads and an explicit publication role. */
export interface PublicationReviewServerOptions extends ReviewTransportOptions {
  operations: ReviewTransportOperations;
  publication: import('./review-submission').PublicationOperations;
}

/** No session, output path or engine construction belongs to this transport. */
export function createBoundReviewServer(
  options: PublicationReviewServerOptions
): ManagedReviewServer {
  const { capability, clientDir = defaultClientDir(), operations } = options;
  const report = nonThrowingReporter(options.reportDiagnostic);
  const maxConnections = options.maxConnections ?? 64;
  if (!Number.isSafeInteger(maxConnections) || maxConnections < 1) {
    throw new Error('Connection limit must be a positive safe integer.');
  }
  const submission = new ReviewSubmission(
    { publication: options.publication },
    options.reportDiagnostic
  );
  const admission = new RequestAdmission({
    maxRequests: options.maxRequests,
    maxExpensiveReads: options.maxExpensiveReads,
    requestTimeoutMs: options.requestTimeoutMs,
  });
  const published = (response: http.ServerResponse) =>
    server.emit(REVIEW_PUBLISHED, response, () => admission.drain());

  const routes = createBoundApiRoutes(
    operations,
    submission,
    published,
    bindRouteValidation(operations)
  );
  const routeMethods = new Map<string, string[]>();
  for (const key of Object.keys(routes)) {
    const [method, path] = key.split(' ');
    const methods = routeMethods.get(path) ?? [];
    methods.push(method);
    routeMethods.set(path, methods);
  }
  const reportDeadline = (kind: RequestKind, elapsedMs: number) =>
    report(`[serve] Request deadline exceeded: kind=${kind} elapsedMs=${elapsedMs}`);

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
          sendJson(
            res,
            rejection.status,
            { error: rejection.error, ...(rejection.code ? { code: rejection.code } : {}) },
            { connection: 'close' }
          );
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
              if (!signal.aborted) report(`[serve] ${method} ${url.pathname} failed:`, error);
              if (!res.headersSent && !res.destroyed)
                sendError(
                  res,
                  error instanceof JsonResponseLimitError ? 413 : 500,
                  error instanceof JsonResponseLimitError ? error.message : 'internal error'
                );
              else if (!res.writableEnded) res.destroy();
            }
          },
          (elapsedMs = 0) => {
            reportDeadline(kind, elapsedMs);
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
      } else if (routeMethods.has(url.pathname)) {
        sendJson(
          res,
          405,
          { error: 'method not allowed' },
          { allow: routeMethods.get(url.pathname)!.join(', ') }
        );
      } else if (url.pathname.startsWith('/api/')) {
        sendError(res, 404, 'not found');
      } else if (method === 'GET') {
        const rejection = admission.rejection('read');
        if (rejection) {
          sendJson(
            res,
            rejection.status,
            { error: rejection.error, ...(rejection.code ? { code: rejection.code } : {}) },
            { connection: 'close' }
          );
          return;
        }
        admission.run(
          req,
          res,
          'read',
          async signal => {
            try {
              await serveStatic(res, clientDir, url.pathname, { signal });
            } catch (error) {
              if (!signal.aborted) report(`[serve] ${method} ${url.pathname} failed:`, error);
              if (!res.headersSent && !res.destroyed) sendError(res, 500, 'internal error');
              else res.destroy();
            }
          },
          (elapsedMs = 0) => {
            reportDeadline('read', elapsedMs);
            res.destroy();
          }
        );
      } else {
        sendError(res, 404, 'not found');
      }
    } catch (error) {
      report(`[serve] ${method} ${url.pathname} failed:`, error);
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
