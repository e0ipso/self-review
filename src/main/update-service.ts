import { isNewerRelease } from './release-version';
import type { EventEmitter } from 'node:events';
import type { VersionUpdateInfo } from '../shared/types';

const GITHUB_API_URL = 'https://api.github.com/repos/e0ipso/self-review/releases/latest';
const TIMEOUT_MS = 5000;
const MAX_RESPONSE_BYTES = 1024 * 1024;

type Events = Pick<EventEmitter, 'on' | 'removeListener'>;
export interface UpdateResponse extends Events {
  statusCode: number;
}
export interface UpdateRequest extends Events {
  setHeader(name: string, value: string): void;
  end(): void;
  abort(): void;
}
export type RequestUpdate = (options: { url: string; method: 'GET' }) => UpdateRequest;

export function compareVersions(current: string, latest: string): boolean {
  const c = current.split('.').map(Number);
  const l = latest.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((l[i] || 0) > (c[i] || 0)) return true;
    if ((l[i] || 0) < (c[i] || 0)) return false;
  }
  return false;
}

function releaseInfo(body: string, current: string): VersionUpdateInfo | null {
  const data: unknown = JSON.parse(body);
  if (!data || typeof data !== 'object' || !('tag_name' in data)) return null;
  const tag = data.tag_name;
  if (typeof tag !== 'string') return null;
  const latestVersion = tag.replace(/^v/, '');
  // Release interpretation is separate from the exported legacy numeric comparator.
  if (!isNewerRelease(current, latestVersion)) return null;
  const url = 'html_url' in data ? data.html_url : undefined;
  if (url !== undefined && url !== null && url !== '' && typeof url !== 'string') return null;
  return {
    latestVersion,
    releaseUrl: url || `https://github.com/e0ipso/self-review/releases/tag/${tag}`,
  };
}

/** One app lifetime owns its cache and optional startup request. No polling or persistence. */
export class UpdateService {
  private cache: VersionUpdateInfo | null = null;
  private cancel: (() => void) | undefined;
  private disposed = false;

  constructor(
    private readonly currentVersion: string,
    private readonly request: RequestUpdate
  ) {}

  getVersionUpdate = (): VersionUpdateInfo | null => this.cache;

  dispose(): void {
    this.disposed = true;
    this.cancel?.();
    this.cache = null;
  }

  async checkForUpdate({ signal }: { signal?: AbortSignal } = {}): Promise<void> {
    if (this.disposed || signal?.aborted) return;
    this.cancel?.();
    this.cache = null;
    // A broken or unavailable network edge must never fail startup.
    let request: UpdateRequest;
    try {
      request = this.request({ url: GITHUB_API_URL, method: 'GET' });
    } catch {
      return;
    }
    return new Promise<void>(resolve => {
      let settled = false;
      let response: UpdateResponse | undefined;
      let chunks: Buffer[] = [];
      let bytes = 0;
      const finish = (abort = false) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        signal?.removeEventListener('abort', cancel);
        if (this.cancel === cancel) this.cancel = undefined;
        try {
          if (abort) request.abort();
        } catch {
          // Cancellation is best effort; settlement and cleanup are unconditional.
        } finally {
          request.removeListener('response', onResponse);
          response?.removeListener('data', onData);
          response?.removeListener('end', onEnd);
          chunks = [];
          resolve();
        }
      };
      const cancel = () => finish(true);
      const onError = () => finish(true);
      // Only close ends both emitters' lifetime. Keep error handlers until then,
      // even after body completion or cancellation, to contain late stream errors.
      const onClose = () => {
        finish();
        request.removeListener('close', onClose);
        request.removeListener('error', onError);
        response?.removeListener('error', onError);
      };
      const onData = (chunk: Buffer) => {
        if (settled) return;
        bytes += chunk.length;
        if (bytes > MAX_RESPONSE_BYTES) return cancel();
        chunks.push(chunk);
      };
      const onEnd = () => {
        if (settled) return;
        try {
          this.cache = releaseInfo(
            Buffer.concat(chunks, bytes).toString('utf8'),
            this.currentVersion
          );
        } catch {
          // Optional metadata errors do not affect the review.
        }
        finish();
      };
      const onResponse = (incoming: UpdateResponse) => {
        if (settled || response) return;
        response = incoming;
        response.on('error', onError);
        if (response.statusCode !== 200) return cancel();
        response.on('data', onData);
        response.on('end', onEnd);
      };
      const timeout = setTimeout(cancel, TIMEOUT_MS);
      this.cancel = cancel;
      signal?.addEventListener('abort', cancel, { once: true });
      request.on('response', onResponse);
      request.on('error', onError);
      request.on('close', onClose);
      if (this.disposed || signal?.aborted) return cancel();
      try {
        request.setHeader('User-Agent', `self-review/${this.currentVersion}`);
        request.setHeader('Accept', 'application/vnd.github.v3+json');
        request.end();
      } catch {
        cancel();
      }
    });
  }
}
