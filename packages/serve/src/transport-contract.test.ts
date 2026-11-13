import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import * as core from '@self-review/core';
import { createPublicationOperations, createReviewOperations } from './review-operations';
import { createBoundReviewServer, createReviewServer, listenLoopback } from './server';
import { REQUEST_SHUTDOWN, type ManagedReviewServer } from './request-admission';
import { SERVER_BUSY_CODE, SERVER_BUSY_ERROR } from './protocol';

const servers: ManagedReviewServer[] = [];
const roots: string[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) {
    const drained = server[REQUEST_SHUTDOWN]();
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await drained;
  }
  roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true }));
});
function setup() {
  const root = mkdtempSync(join(tmpdir(), 'serve-transport-contract-'));
  roots.push(root);
  const output = { path: join(root, 'review.xml'), origin: 'explicit' as const };
  const session = core.createReviewSession();
  const source = { type: 'directory' as const, sourcePath: root };
  core.commitDiffData(session, { source, files: [] }, core.resolveLocalSourceIdentity(source));
  const state = { timestamp: '2026-01-01T00:00:00Z', source, files: [] };
  return { session, output, state };
}
const headers = { authorization: 'Bearer key', 'content-type': 'application/json' };
async function listen(server: ManagedReviewServer) {
  servers.push(server);
  return (await listenLoopback(server)).url;
}

it('publishes through the actual first-party role without cached-state mutation, retaining refusal and repair', async () => {
  const { session, output, state } = setup();
  const operations = createPublicationOperations(session, output);
  const report = vi.fn();
  const url = await listen(
    createBoundReviewServer({
      operations,
      publication: operations,
      capability: 'key',
      reportDiagnostic: report,
    })
  );
  const send = (value: unknown) =>
    fetch(url + 'api/review', { method: 'POST', headers, body: JSON.stringify(value) });
  const wrong = await send({ ...state, source: { ...state.source, sourcePath: '/foreign' } });
  expect(wrong.status).toBe(422);
  expect(session.reviewState).toBeNull();
  const published = await send(state);
  expect(published.status).toBe(200);
  expect(await published.json()).toEqual({ ok: true, outputPath: output.path });
  expect(session.reviewState).toBeNull();
  expect(readFileSync(output.path, 'utf8')).toContain('<review');
  expect((await send(state)).status).toBe(503);
  expect(report).toHaveBeenCalledWith(`[serve] Review written to ${output.path}`);
});

it('preserves legacy constructor handoff side effects and order for a dependent publisher', async () => {
  const { session, output, state } = setup();
  const operations = createReviewOperations(session, output);
  const order: string[] = [];
  let cached: typeof state | undefined;
  operations.submitReviewState = value => {
    order.push('submit');
    cached = value as typeof state;
  };
  operations.publishReview = vi.fn(async value => {
    order.push('publish');
    expect(cached).toBe(value);
    return { outputPath: output.path };
  });
  const url = await listen(
    createReviewServer({
      session,
      output,
      operations,
      capability: 'key',
      reportDiagnostic: vi.fn(),
    })
  );
  const result = await fetch(url + 'api/review', {
    method: 'POST',
    headers,
    body: JSON.stringify(state),
  });
  expect(result.status).toBe(200);
  expect(order).toEqual(['submit', 'publish']);
  expect(operations.publishReview).toHaveBeenCalledOnce();
});

it.each(['capture', 'throw', 'reject'])(
  'routes transport diagnostics through a non-throwing %s reporter',
  async kind => {
    const { session, output } = setup();
    const operations = createReviewOperations(session, output);
    operations.getDiffLoad = () => {
      throw new Error('read failed with useful detail');
    };
    const report = vi.fn((message: string) => {
      expect(message).toContain('read failed with useful detail');
      if (kind === 'throw') throw new Error('report failed');
      if (kind === 'reject') return Promise.reject(new Error('async report failed'));
    });
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const url = await listen(
        createReviewServer({ operations, capability: 'key', reportDiagnostic: report })
      );
      const result = await fetch(url + 'api/diff', { headers });
      expect(result.status).toBe(500);
      expect(await result.json()).toEqual({ error: 'internal error' });
      expect(report).toHaveBeenCalledExactlyOnceWith(
        expect.stringMatching(
          /\[serve\] GET \/api\/diff failed: Error: read failed with useful detail/
        )
      );
      expect(report.mock.calls[0][0]).not.toContain('Bearer key');
      expect(stderr).not.toHaveBeenCalled();
      expect((await fetch(url + 'api/resume', { headers })).status).toBe(200);
    } finally {
      stderr.mockRestore();
    }
  }
);

it('returns the additive busy code before invoking a refused operation', async () => {
  const { session, output, state } = setup();
  const operations = createReviewOperations(session, output);
  let release!: () => void;
  let entered!: () => void;
  const started = new Promise<void>(resolve => {
    entered = resolve;
  });
  operations.readAttachment = () =>
    new Promise(resolve => {
      entered();
      release = () => resolve({ ok: true, data: new ArrayBuffer(0) });
    });
  const publish = vi.spyOn(operations, 'publishReview');
  const url = await listen(createReviewServer({ operations, capability: 'key', maxRequests: 1 }));
  const reading = fetch(url + 'api/attachment?path=.self-review-assets/a.png', { headers });
  await started;
  try {
    const result = await fetch(url + 'api/review', {
      method: 'POST',
      headers,
      body: JSON.stringify(state),
    });
    expect(result.status).toBe(503);
    expect(await result.json()).toEqual({ error: SERVER_BUSY_ERROR, code: SERVER_BUSY_CODE });
    expect(publish).not.toHaveBeenCalled();
  } finally {
    release();
    await (await reading).arrayBuffer();
  }
});

it('binds all request validators to the engine supplying the operations', async () => {
  const { resolveServeEngine } = await import('./engine-contract');
  const { session, output, state } = setup();
  class PeerXmlError extends Error {
    readonly code = 'invalid-state' as const;
    readonly details: readonly string[] = [];
    constructor(_code: ConstructorParameters<typeof core.ReviewXmlError>[0], message: string) {
      super(message);
    }
  }
  const validate = vi.fn(() => {
    throw new PeerXmlError('invalid-state', 'peer validation refusal');
  });
  const decode = vi.fn(() => ({ ok: false as const, error: 'peer apply refusal' }));
  const engine = resolveServeEngine({
    ...core,
    ReviewXmlError: PeerXmlError,
    validateReviewState: validate,
    decodeSuggestionApplyRequest: decode,
    MAX_CONTEXT_LINES: 2,
  });
  const operations = createPublicationOperations(session, output, engine);
  const publish = vi.spyOn(operations, 'publishReview');
  const url = await listen(
    createBoundReviewServer({ operations, publication: operations, capability: 'key' })
  );
  const post = (route: string, body: unknown) =>
    fetch(url + 'api/' + route, { method: 'POST', headers, body: JSON.stringify(body) });
  const review = await post('review', state);
  expect(review.status).toBe(400);
  expect(await review.json()).toEqual({ error: 'peer validation refusal' });
  expect(validate).toHaveBeenCalledOnce();
  expect(publish).not.toHaveBeenCalled();
  const apply = await post('apply-suggestion', {
    filePath: 'a.txt',
    lineRange: null,
    suggestion: { originalCode: '', proposedCode: '' },
  });
  expect(apply.status).toBe(400);
  expect(await apply.json()).toEqual({ error: 'peer apply refusal' });
  expect(decode).toHaveBeenCalledOnce();
  const expand = await post('expand-context', { filePath: 'a.txt', contextLines: 3 });
  expect(expand.status).toBe(400);
  expect(await expand.json()).toEqual({ error: 'contextLines must be an integer between 0 and 2' });
});

it('uses the supplied publication error constructor and keeps unknown failures uncertain', async () => {
  const { resolveServeEngine } = await import('./engine-contract');
  const { session, output, state } = setup();
  class PeerPublishError extends Error {
    readonly details: readonly string[] = [];
    constructor(
      readonly code: core.ReviewPublishError['code'],
      readonly path: string,
      message: string
    ) {
      super(message);
    }
  }
  const publishReview = vi.fn<typeof core.publishReview>(async () => {
    throw new PeerPublishError('permission-denied', output.path, 'peer publication refusal');
  });
  const engine = resolveServeEngine({
    ...core,
    ReviewPublishError: PeerPublishError,
    publishReview,
  });
  const operations = createPublicationOperations(session, output, engine);
  const report = vi.fn();
  const url = await listen(
    createBoundReviewServer({
      operations,
      publication: operations,
      capability: 'key',
      reportDiagnostic: report,
    })
  );
  const send = (body = state) =>
    fetch(url + 'api/review', { method: 'POST', headers, body: JSON.stringify(body) });
  const foreign = await send({ ...state, source: { ...state.source, sourcePath: '/foreign' } });
  expect(foreign.status).toBe(422);
  expect(publishReview).not.toHaveBeenCalled();
  const known = await send();
  expect(known.status).toBe(500);
  expect(await known.json()).toEqual({
    ok: false,
    code: 'permission-denied',
    message: 'peer publication refusal',
    details: [],
  });
  publishReview.mockRejectedValueOnce(new Error('unclassified failure'));
  const unknown = await send();
  expect(unknown.status).toBe(500);
  expect(await unknown.json()).toEqual({ error: 'internal error' });
  expect(publishReview).toHaveBeenCalledTimes(2);
});

it('uses selected legacy validation and peer error classes when optional validators are omitted', async () => {
  const { resolveServeEngine } = await import('./engine-contract');
  const { session, output, state } = setup();
  const constructed = vi.fn();
  class PeerXmlError extends core.ReviewXmlError {
    constructor(...args: ConstructorParameters<typeof core.ReviewXmlError>) {
      super(...args);
      constructed(...args);
    }
  }
  const engine = resolveServeEngine({
    ...core,
    ReviewXmlError: PeerXmlError,
    validateReviewState: undefined,
    decodeSuggestionApplyRequest: undefined,
    MAX_CONTEXT_LINES: undefined,
  });
  const operations = createPublicationOperations(session, output, engine);
  const publish = vi.spyOn(operations, 'publishReview');
  const url = await listen(
    createBoundReviewServer({ operations, publication: operations, capability: 'key' })
  );
  const response = await fetch(url + 'api/review', {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...state, source: { type: 'invalid' } }),
  });
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: expect.stringContaining('source') });
  expect(constructed).toHaveBeenCalledOnce();
  expect(publish).not.toHaveBeenCalled();
});

it('observes operation replacements after route construction with bound validation', async () => {
  const { session, output } = setup();
  const operations = createPublicationOperations(session, output);
  const url = await listen(
    createBoundReviewServer({ operations, publication: operations, capability: 'key' })
  );
  const getConfigLoad = vi.fn(() => null);
  operations.getConfigLoad = getConfigLoad;
  const response = await fetch(url + 'api/config', { headers });
  expect(response.status).toBe(200);
  expect(await response.json()).toBeNull();
  expect(getConfigLoad).toHaveBeenCalledOnce();
});
