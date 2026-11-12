import { afterEach, expect, it, vi } from 'vitest';
import * as core from '@self-review/core';
import {
  createBoundReviewServer,
  listenLoopback,
  type ReviewTransportOptions,
} from './bound-server';
import { createPublicationOperations } from './review-operations';
import { REQUEST_SHUTDOWN, type ManagedReviewServer } from './request-admission';

const servers: ManagedReviewServer[] = [];
const releases: (() => void)[] = [];
const headers = { authorization: 'Bearer private-key', 'content-type': 'application/json' };
const state = {
  timestamp: '2026-01-01T00:00:00Z',
  source: { type: 'directory' as const, sourcePath: '/review' },
  files: [],
};
const apply = {
  filePath: 'a.txt',
  lineRange: { side: 'new', start: 1, end: 1 },
  suggestion: { originalCode: 'before', proposedCode: 'private-proposal' },
};
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  releases.push(resolve);
  return { promise, resolve };
}
afterEach(async () => {
  for (const release of releases.splice(0)) release();
  for (const server of servers.splice(0)) {
    const drain = server[REQUEST_SHUTDOWN]();
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await drain;
  }
});
async function setup(options: Partial<ReviewTransportOptions> = {}) {
  const session = core.createReviewSession();
  core.commitDiffData(
    session,
    {
      source: state.source,
      files: [
        { oldPath: 'a.txt', newPath: 'a.txt', changeType: 'modified', hunks: [], isBinary: false },
      ],
    },
    core.resolveLocalSourceIdentity(state.source)
  );
  const operations = createPublicationOperations(session, {
    path: '/review.xml',
    origin: 'explicit',
  });
  const report = vi.fn();
  const server = createBoundReviewServer({
    operations,
    publication: operations,
    capability: 'private-key',
    reportDiagnostic: report,
    ...options,
  });
  servers.push(server);
  const { url } = await listenLoopback(server);
  return { server, operations, url, report };
}

it.each([
  ['GET', 'diff', undefined],
  ['GET', 'config', undefined],
  ['GET', 'resume', undefined],
  ['GET', 'file?path=a.txt', undefined],
  ['GET', 'image?path=a.txt', undefined],
  ['GET', 'attachment?path=.self-review-assets/a.png', undefined],
  ['POST', 'expand-context', { filePath: 'a.txt', contextLines: 3 }],
  ['POST', 'apply-suggestion', apply],
  ['POST', 'review', state],
] as const)(
  'advertises only %s for %s after authorization, retaining accepted behavior',
  async (method, path, body) => {
    const { operations, url } = await setup();
    operations.loadImage = vi.fn(async () => ({ dataUri: 'data:image/png;base64,AA==' }));
    operations.readAttachment = vi.fn(async () => ({
      ok: true as const,
      data: new ArrayBuffer(0),
    }));
    operations.expandContext = vi.fn(async () => null);
    operations.applySuggestionForSession = vi.fn(async () => ({
      status: 'applied' as const,
      filePath: 'a.txt',
      replacedLines: 1,
    }));
    operations.publishReview = vi.fn(async () => ({ outputPath: '/review.xml' }));
    const route = url + 'api/' + path;
    for (const wrongMethod of ['PUT', 'HEAD', 'OPTIONS', method === 'GET' ? 'POST' : 'GET']) {
      const unauthorized = await fetch(route, { method: wrongMethod });
      expect(unauthorized.status).toBe(401);
      expect(unauthorized.headers.get('allow')).toBeNull();
      const forbidden = await fetch(route, {
        method: wrongMethod,
        headers: { ...headers, origin: 'http://foreign.test' },
      });
      expect(forbidden.status).toBe(403);
      expect(forbidden.headers.get('allow')).toBeNull();
      const refused = await fetch(route, { method: wrongMethod, headers });
      expect(refused.status).toBe(405);
      expect(refused.headers.get('allow')).toBe(method);
      expect(refused.headers.get('cache-control')).toBe('no-store');
      expect(refused.headers.get('content-type')).toBe('application/json; charset=utf-8');
      expect(refused.headers.get('x-content-type-options')).toBe('nosniff');
      expect(refused.headers.get('referrer-policy')).toBe('no-referrer');
      if (wrongMethod !== 'HEAD')
        expect(await refused.json()).toEqual({ error: 'method not allowed' });
    }
    const accepted = await fetch(route, { method, headers, body: body && JSON.stringify(body) });
    expect(accepted.status).toBe(200);
    expect(accepted.headers.get('allow')).toBeNull();
  }
);

it.each(['capture', 'throw', 'reject'] as const)(
  'reports one bounded deadline for an expensive read through a %s reporter and retains its slot',
  async behavior => {
    const report = vi.fn<(message: string) => void>(() => {
      if (behavior === 'throw') throw new Error('report failure');
      if (behavior === 'reject') return Promise.reject(new Error('report failure'));
    });
    const { url, operations } = await setup({
      reportDiagnostic: report,
      requestTimeoutMs: 40,
      maxRequests: 1,
    });
    const pending = deferred();
    let signal: AbortSignal | undefined;
    operations.loadImage = vi.fn(async (_path, options) => {
      signal = options?.signal;
      await pending.promise;
      throw new Error('late abort detail');
    });
    const response = await fetch(url + 'api/image?path=a.txt&private-query=secret', { headers });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: 'request deadline exceeded; operation outcome may be unknown',
    });
    expect(signal?.aborted).toBe(true);
    expect(report).toHaveBeenCalledExactlyOnceWith(
      expect.stringMatching(
        /^\[serve\] Request deadline exceeded: kind=expensive-read elapsedMs=\d+$/
      )
    );
    const elapsed = Number(report.mock.calls[0][0]?.split('elapsedMs=')[1]);
    expect(elapsed).toBeGreaterThanOrEqual(0);
    expect((await fetch(url + 'api/config', { headers })).status).toBe(503);
    pending.resolve();
    await vi.waitFor(async () =>
      expect((await fetch(url + 'api/config', { headers })).status).toBe(200)
    );
    expect(report).toHaveBeenCalledOnce();
  }
);

it.each(['mutation', 'publication'] as const)(
  'reports the %s deadline once without exposing submitted data or releasing ownership',
  async kind => {
    const { url, operations, report } = await setup({ requestTimeoutMs: 40 });
    const pending = deferred();
    const work = async () => {
      await pending.promise;
      throw new Error('cancelled');
    };
    if (kind === 'mutation') operations.applySuggestionForSession = vi.fn(work);
    else operations.publishReview = vi.fn(work);
    const response = await fetch(
      url + 'api/' + (kind === 'mutation' ? 'apply-suggestion' : 'review'),
      {
        method: 'POST',
        headers,
        body: JSON.stringify(kind === 'mutation' ? apply : state),
      }
    );
    expect(response.status).toBe(503);
    expect(report).toHaveBeenCalledExactlyOnceWith(
      expect.stringMatching(
        new RegExp(`^\\[serve\\] Request deadline exceeded: kind=${kind} elapsedMs=\\d+$`)
      )
    );
    expect(
      (
        await fetch(url + 'api/apply-suggestion', {
          method: 'POST',
          headers,
          body: JSON.stringify(apply),
        })
      ).status
    ).toBe(409);
    pending.resolve();
  }
);

it.each(['disconnect', 'shutdown'] as const)(
  'keeps %s cancellation silent after the original deadline would pass',
  async mode => {
    const { url, operations, report, server } = await setup({ requestTimeoutMs: 100 });
    const started = deferred();
    const pending = deferred();
    let signal: AbortSignal | undefined;
    operations.loadImage = vi.fn(async (_path, options) => {
      signal = options?.signal;
      started.resolve();
      await pending.promise;
      throw new Error('cancelled');
    });
    const controller = new AbortController();
    const request = fetch(url + 'api/image?path=a.txt', {
      headers,
      signal: controller.signal,
    }).catch(() => null);
    await started.promise;
    let drained: Promise<void> | undefined;
    if (mode === 'disconnect') controller.abort();
    else drained = server[REQUEST_SHUTDOWN]();
    await vi.waitFor(() => expect(signal?.aborted).toBe(true));
    await new Promise(resolve => setTimeout(resolve, 130));
    expect(report).not.toHaveBeenCalled();
    pending.resolve();
    await request;
    await drained;
    expect(report).not.toHaveBeenCalled();
  }
);
