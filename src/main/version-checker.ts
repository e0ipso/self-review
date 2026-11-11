// src/main/version-checker.ts
// Checks GitHub for a newer release and caches the result for the renderer.

import { net } from 'electron';
import { VersionUpdateInfo } from '../shared/types';

const GITHUB_API_URL = 'https://api.github.com/repos/e0ipso/self-review/releases/latest';
const TIMEOUT_MS = 5000;
const MAX_RESPONSE_BYTES = 1024 * 1024;

let versionUpdateCache: VersionUpdateInfo | null = null;

export function getVersionUpdate(): VersionUpdateInfo | null {
  return versionUpdateCache;
}

export function compareVersions(current: string, latest: string): boolean {
  const c = current.split('.').map(Number);
  const l = latest.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((l[i] || 0) > (c[i] || 0)) return true;
    if ((l[i] || 0) < (c[i] || 0)) return false;
  }
  return false;
}

/** The startup owner may cancel this optional check; responses are bounded before accumulation. */
export async function checkForUpdate({ signal }: { signal?: AbortSignal } = {}): Promise<void> {
  if (signal?.aborted) return;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { version: currentVersion } = require('../../package.json');
  return new Promise<void>(resolve => {
    const request = net.request({ url: GITHUB_API_URL, method: 'GET' });
    let settled = false;
    let body = '';
    let bytes = 0;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener('abort', cancel);
      resolve();
    };
    const cancel = () => {
      finish();
      request.abort();
    };
    const timeout = setTimeout(cancel, TIMEOUT_MS);
    signal?.addEventListener('abort', cancel, { once: true });
    request.setHeader('User-Agent', `self-review/${currentVersion}`);
    request.setHeader('Accept', 'application/vnd.github.v3+json');
    request.on('response', response => {
      if (settled) return;
      if (response.statusCode !== 200) {
        cancel();
        return;
      }
      response.on('data', (chunk: Buffer) => {
        if (settled) return;
        bytes += chunk.length;
        if (bytes > MAX_RESPONSE_BYTES) {
          cancel();
          return;
        }
        body += chunk.toString();
      });
      response.on('end', () => {
        if (settled) return;
        try {
          const data = JSON.parse(body);
          const tagName = data.tag_name;
          if (typeof tagName === 'string') {
            const latestVersion = tagName.replace(/^v/, '');
            if (compareVersions(currentVersion, latestVersion)) {
              versionUpdateCache = {
                latestVersion,
                releaseUrl:
                  data.html_url || `https://github.com/e0ipso/self-review/releases/tag/${tagName}`,
              };
            }
          }
        } catch {
          /* Optional metadata errors do not affect the review. */
        }
        finish();
      });
      response.on('error', finish);
    });
    request.on('error', finish);
    request.end();
  });
}
