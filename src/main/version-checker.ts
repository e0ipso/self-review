// Compatibility entry point for existing callers. Main owns its own UpdateService instead.
import { requestUpdate } from './electron-update-request';
import { UpdateService } from './update-service';
export { compareVersions } from './update-service';

let legacy: UpdateService | undefined;

export function getVersionUpdate(): import('../shared/types').VersionUpdateInfo | null {
  return legacy?.getVersionUpdate() ?? null;
}

export async function checkForUpdate(options: { signal?: AbortSignal } = {}): Promise<void> {
  if (options.signal?.aborted) return;
  if (!legacy) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { version } = require('../../package.json');
    legacy = new UpdateService(version, requestUpdate);
  }
  await legacy.checkForUpdate(options);
}
