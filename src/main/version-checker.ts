// src/main/version-checker.ts
// Checks GitHub for a newer release and caches the result for the renderer.

import { net } from 'electron';
import { VersionUpdateInfo } from '../shared/types';

const GITHUB_API_URL = 'https://api.github.com/repos/e0ipso/self-review/releases/latest';
const TIMEOUT_MS = 5000;

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

export async function checkForUpdate(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { version: currentVersion } = require('../../package.json');

  return new Promise<void>((resolve) => {
    const request = net.request({
      url: GITHUB_API_URL,
      method: 'GET',
    });

    request.setHeader('User-Agent', `self-review/${currentVersion}`);
    request.setHeader('Accept', 'application/vnd.github.v3+json');

    const timeout = setTimeout(() => {
      request.abort();
      resolve();
    }, TIMEOUT_MS);

    let body = '';

    request.on('response', (response) => {
      if (response.statusCode !== 200) {
        clearTimeout(timeout);
        resolve();
        return;
      }

      response.on('data', (chunk: Buffer) => {
        body += chunk.toString();
      });

      response.on('end', () => {
        clearTimeout(timeout);
        try {
          const data = JSON.parse(body);
          const tagName = data.tag_name;
          if (typeof tagName !== 'string') { resolve(); return; }
          const latestVersion = tagName.replace(/^v/, '');
          if (compareVersions(currentVersion, latestVersion)) {
            versionUpdateCache = {
              latestVersion,
              releaseUrl: data.html_url || `https://github.com/e0ipso/self-review/releases/tag/${tagName}`,
            };
          }
        } catch {
          // Silently ignore parse errors
        }
        resolve();
      });

      response.on('error', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    request.on('error', () => {
      clearTimeout(timeout);
      resolve();
    });

    request.end();
  });
}
