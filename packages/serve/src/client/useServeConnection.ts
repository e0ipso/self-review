import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppConfig, OutputPathInfo } from '@self-review/core';
import { createFetchAdapter, loadServeConfig, ServeRequestError } from './adapter';
import type { FetchReviewAdapter } from './adapter';
import { createServeRequester } from './requester';

interface Connection {
  adapter: FetchReviewAdapter;
  config: Partial<AppConfig>;
  outputPathInfo: OutputPathInfo | null;
}
interface ConnectionFailure {
  message: string;
  unauthorized: boolean;
}
interface Attempt {
  capability: string;
  revision: number;
  connected: boolean;
  unauthorized: boolean;
  retire: () => void;
}

/** Each initial connection attempt owns its transport. Retry only config reads, never writes.
 * The removed URL capability stays in memory through retries and StrictMode effect replay.
 */
export function useServeConnection(capability: string | null) {
  const [revision, setRevision] = useState(0);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [error, setError] = useState<ConnectionFailure | null>(null);
  const owner = useRef<Attempt | null>(null);
  const retry = useCallback(() => {
    const current = owner.current;
    if (!current || current.capability !== capability || current.connected || current.unauthorized)
      return;
    // Retire synchronously, before React starts the next effect, so an older result
    // cannot become the connection between the click and effect cleanup.
    current.retire();
    setRevision(previous => previous + 1);
  }, [capability]);

  useEffect(() => {
    if (capability === null) return;
    let active = true;
    const requester = createServeRequester(capability);
    const adapter = createFetchAdapter(capability, requester);
    const attempt: Attempt = {
      capability,
      revision,
      connected: false,
      unauthorized: false,
      retire: () => {
        active = false;
        adapter.dispose();
      },
    };
    owner.current = attempt;
    setConnection(null);
    setError(null);
    void loadServeConfig(capability, requester).then(
      loaded => {
        if (active && owner.current === attempt) {
          attempt.connected = true;
          setConnection({
            adapter,
            config: loaded?.config ?? {},
            outputPathInfo: loaded?.outputPathInfo ?? null,
          });
        }
      },
      error => {
        if (active && owner.current === attempt) {
          attempt.unauthorized = error instanceof ServeRequestError && error.status === 401;
          setError({
            message: error instanceof Error ? error.message : String(error),
            unauthorized: attempt.unauthorized,
          });
          attempt.retire();
        }
      }
    );
    return attempt.retire;
  }, [capability, revision]);
  const current =
    capability !== null &&
    owner.current?.capability === capability &&
    owner.current.revision === revision;
  return { connection: current ? connection : null, error: current ? error : null, retry };
}
