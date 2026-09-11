// Process lifetime is review lifetime. Completing writes the file and stops the
// process; nothing else does. A closed tab is not an event this program sees.

import * as fs from 'node:fs';
import type * as http from 'node:http';
import { serializeReview, takeReviewState } from '@self-review/core';
import type { ReviewSession, ReviewState } from '@self-review/core';

export interface CompletionOptions {
  /** The listener to stop once the review is written. */
  server: http.Server;
  /** The session `POST /api/review` submits into. */
  session: ReviewSession;
  /** Absolute output path, fixed at startup. */
  outputPath: string;
  /** Injected so a test can observe the exit code. Defaults to `process.exit`. */
  exit?: (code: number) => void;
}

/**
 * The same two steps the desktop takes on Finish Review. A document that fails
 * XSD validation throws, and nothing is written.
 */
export async function writeReviewOutput(state: ReviewState, outputPath: string): Promise<void> {
  const xml = await serializeReview(state, outputPath);
  fs.writeFileSync(outputPath, xml + '\n', 'utf-8');
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
 * flushed, so the browser has its answer before the socket goes away. A 4xx is
 * not a completion and is ignored.
 *
 * Because the write follows the response, a 200 means accepted, not written —
 * so an end-to-end test must assert the file, never the status code.
 */
export function completeReviewOnSubmit(options: CompletionOptions): void {
  const { server, session, outputPath, exit = process.exit } = options;
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
      void complete(server, session, outputPath, exit);
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

async function complete(
  server: http.Server,
  session: ReviewSession,
  outputPath: string,
  exit: (code: number) => void
): Promise<void> {
  // Taken, not read: consumed exactly once, and this is the only consumer.
  const state = takeReviewState(session);
  if (!state) {
    console.error('[serve] Review submission accepted but no state was recorded');
    shutdown(server, exit, 1);
    return;
  }

  try {
    await writeReviewOutput(state, outputPath);
  } catch (error) {
    console.error(
      `[serve] Error saving review: ${error instanceof Error ? error.message : String(error)}`
    );
    shutdown(server, exit, 1);
    return;
  }

  console.error(`[serve] Review written to ${outputPath}`);
  shutdown(server, exit, 0);
}
