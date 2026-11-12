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
