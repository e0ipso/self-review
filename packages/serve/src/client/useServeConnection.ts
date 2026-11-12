import { useEffect, useState } from 'react';
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

/** An effect owns both the requester and adapter, including StrictMode setup/cleanup replay. */
export function useServeConnection(capability: string | null) {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [error, setError] = useState<ConnectionFailure | null>(null);
  useEffect(() => {
    if (capability === null) return;
    let active = true;
    const requester = createServeRequester(capability);
    const adapter = createFetchAdapter(capability, requester);
    setConnection(null);
    setError(null);
    void loadServeConfig(capability, requester).then(
      loaded => {
        if (active)
          setConnection({
            adapter,
            config: loaded?.config ?? {},
            outputPathInfo: loaded?.outputPathInfo ?? null,
          });
      },
      error => {
        if (active)
          setError({
            message: error instanceof Error ? error.message : String(error),
            unauthorized: error instanceof ServeRequestError && error.status === 401,
          });
      }
    );
    return () => {
      active = false;
      adapter.dispose();
    };
  }, [capability]);
  return { connection, error };
}
