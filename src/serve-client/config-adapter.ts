// src/serve-client/config-adapter.ts
// The serve-mode `ConfigAdapter`: `GET /api/config`.
//
// No component consumes a `ConfigAdapter` today, so the client calls this
// itself before mounting — as the Electron renderer does with requestConfig().

import type { ConfigAdapter } from '../../packages/react/src/adapter';
import type { AppConfig, OutputPathInfo } from '../shared/types';

/** The `GET /api/config` body, mirroring `ServeConfigResponse` on the server. */
interface ConfigResponse {
  config: AppConfig;
  outputPathInfo?: OutputPathInfo;
}

/** What the client needs before it can mount the panel. */
export interface ServeConfig {
  config: AppConfig;
  outputPathInfo?: OutputPathInfo;
}

/**
 * Fetch the session's configuration. Throws rather than falling back to
 * defaults: a UI mounted on library defaults would misreport the output path.
 */
export async function loadServeConfig(): Promise<ServeConfig> {
  const res = await fetch('/api/config');
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string } | null;
      if (body && typeof body.error === 'string') detail = body.error;
    } catch {
      // A body that is not JSON tells us nothing the status has not already.
    }
    throw new Error(detail);
  }

  const body = (await res.json()) as ConfigResponse;
  return { config: body.config, outputPathInfo: body.outputPathInfo };
}

/** The adapter shape, for the seam that will eventually take one. */
export const configAdapter: ConfigAdapter = { loadConfig: loadServeConfig };
