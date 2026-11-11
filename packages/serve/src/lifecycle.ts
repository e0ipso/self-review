// Completion is signalled by the publication owner, then waits for the response
// and already admitted operations. HTTP status codes alone do not prove publication.

import type * as http from 'node:http';

export const REVIEW_PUBLISHED = 'review-published';
const SHUTDOWN_GRACE_MS = 5_000;

type ScheduleDeadline = (expire: () => void) => () => void;

export interface CompletionOptions {
  server: http.Server;
  /** Injected so a test can observe the exit code. Defaults to process.exit. */
  exit?: (code: number) => void;
  /** Returns cancellation; production allows five seconds for admitted work to drain. */
  scheduleDeadline?: ScheduleDeadline;
}

const scheduleDeadline: ScheduleDeadline = expire => {
  const timer = setTimeout(expire, SHUTDOWN_GRACE_MS);
  return () => clearTimeout(timer);
};

/** The publication owner signals before sending its acknowledgement, even if the peer disconnected. */
export function completeReviewOnSubmit(options: CompletionOptions): void {
  const { server, exit = process.exit, scheduleDeadline: schedule = scheduleDeadline } = options;
  let completing = false;
  server.on(REVIEW_PUBLISHED, (response: http.ServerResponse, drain: () => Promise<void>) => {
    const stop = () => {
      if (completing) return;
      completing = true;
      console.error('[serve] Review complete; stopping.');
      // Stop accepting immediately. Idle keep-alives close as part of server.close;
      // active connections stay until their operations and responses finish.
      server.close();
      let exited = false;
      let cancelDeadline = () => {};
      const finish = () => {
        if (exited) return;
        exited = true;
        cancelDeadline();
        server.closeAllConnections();
        exit(0);
      };
      cancelDeadline = schedule(() => {
        console.error('[serve] Shutdown deadline reached; closing remaining connections.');
        finish();
      });
      void drain().then(finish, finish);
    };
    response.once('finish', stop);
    response.once('close', stop);
    if (response.writableFinished || response.destroyed) stop();
  });
}
