// src/serve-client/config-adapter.ts
// The serve-mode `ConfigAdapter`: `GET /api/config` in the shape the React
// package's configuration seam declares.
//
// Configuration is a separate interface from `ReviewAdapter` — see
// `packages/react/src/adapter.ts` — and no component consumes a `ConfigAdapter`
// today, so the browser client calls this itself before it mounts. That is
// exactly what the Electron renderer does with `requestConfig()` in
// `src/renderer/App.tsx`: resolve the configuration first, mount the providers
// second. Typing the export against `ConfigAdapter` keeps the two in step if a
// component ever grows the prop.

import type { ConfigAdapter } from '../../packages/react/src/adapter';
import type { AppConfig, OutputPathInfo } from '../shared/types';

/** The `GET /api/config` body, mirroring `ServeConfigResponse` on the server. */
interface ConfigResponse {
  config: AppConfig;
  outputPathInfo?: OutputPathInfo;
  /** Always true in serve mode; the client offers no control that would change it. */
  outputPathReadOnly?: boolean;
}

/** What the client needs before it can mount the panel. */
export interface ServeConfig {
  config: AppConfig;
  outputPathInfo?: OutputPathInfo;
}

/**
 * Fetch the session's configuration.
 *
 * Throws on a refusal rather than falling back to defaults: the categories, the
 * theme and the resolved output path all come from here, and a UI silently
 * mounted on library defaults would misreport where the review is going to be
 * written.
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
