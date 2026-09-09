// Process lifetime is review lifetime.
//
// Completing the review writes the output file and stops the process. Nothing
// else does: a closed tab is not an event this program observes, nothing is
// auto-saved, and there is no session to resume from a second tab. That is the
// desktop application's behaviour — quitting discards — expressed over HTTP.

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
 * Serialize a submitted review and write it, the same two steps the desktop
 * takes on "Finish Review" (main.ts:439). `serializeReview` validates against
 * the XSD and writes any attachments beside the output file; a document that
 * does not validate throws and nothing is written.
 */
export async function writeReviewOutput(
  state: ReviewState,
  outputPath: string
): Promise<void> {
  const xml = await serializeReview(state, outputPath);
  fs.writeFileSync(outputPath, xml + '\n', 'utf-8');
}

/**
 * Stop serving and end the process. The listener is closed and every open
 * connection with it, so the port is free before the process goes; without
 * that a browser's idle keep-alive socket would hold it.
 */
function shutdown(server: http.Server, exit: (code: number) => void, code: number): void {
  server.closeAllConnections();
  server.close();
  exit(code);
}

/**
 * Write the review and stop the process when one is submitted successfully.
 *
 * The hook is the response, not the route: an extra `request` listener sees
 * every request the server handles, and `finish` fires once the response has
 * been flushed — so the browser has its answer before the socket goes away.
 * A rejected submission (a 4xx from the route's validation) is not a
 * completion and is ignored, as is every other request.
 *
 * Because the write happens after the response, a 200 means the submission
 * was accepted, not that the file is on disk. The plan says the same thing
 * from the other side: an end-to-end test must assert the written file, never
 * the status code.
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
  // Taken, not read: the state is consumed exactly once, and this is the
  // only consumer.
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
