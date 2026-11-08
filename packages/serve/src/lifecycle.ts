// A published review stops the process; nothing else does. `POST /api/review` (./server.ts) publishes before it answers, so a flushed 200 means the file is on disk.

import type * as http from 'node:http';

export interface CompletionOptions {
  server: http.Server;
  /** Injected so a test can observe the exit code. Defaults to `process.exit`. */
  exit?: (code: number) => void;
}

/**
 * Closes open connections too, or a browser's idle keep-alive socket holds the
 * port after the process is done with it.
 */
function shutdown(server: http.Server, exit: (code: number) => void, code: number): void {
  server.closeAllConnections();
  server.close();
  exit(code);
}

/**
 * The hook is the response, not the route: `finish` fires once the response is
 * flushed, so the browser has its answer before the socket goes away. Only a
 * 200 is a completion.
 */
export function completeReviewOnSubmit(options: CompletionOptions): void {
  const { server, exit = process.exit } = options;
  let completing = false;

  server.on('request', (req, res) => {
    if (req.method !== 'POST' || pathnameOf(req.url) !== '/api/review') {
      return;
    }
    res.on('finish', () => {
      if (res.statusCode !== 200 || completing) {
        return;
      }
      completing = true;
      console.error('[serve] Review complete; stopping.');
      shutdown(server, exit, 0);
    });
  });
}

function pathnameOf(url: string | undefined): string | null {
  try {
    return new URL(url ?? '/', 'http://localhost').pathname;
  } catch {
    return null;
  }
}
