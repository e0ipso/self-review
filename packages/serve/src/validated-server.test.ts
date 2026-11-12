import { afterEach, expect, expectTypeOf, it, vi } from 'vitest';
import * as core from '@self-review/core';
import { resolveServeEngine } from './engine-contract';
import {
  createPublicationOperations,
  createReviewOperations,
  createValidatedPublicationOperations,
  type PublicationReviewOperations,
  type ReviewOperations,
} from './review-operations';
import { createValidatedReviewServer, listenLoopback } from './bound-server';
import { createReviewServer } from './server';
import { REQUEST_SHUTDOWN, type ManagedReviewServer } from './request-admission';
const servers: ManagedReviewServer[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) {
    const done = server[REQUEST_SHUTDOWN]();
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await done;
  }
});
const output = { path: '/review.xml', origin: 'explicit' as const };
const state = {
  timestamp: '2026-01-01T00:00:00Z',
  source: { type: 'directory', sourcePath: '/virtual' },
  files: [],
};
async function listen(server: ManagedReviewServer) {
  servers.push(server);
  return (await listenLoopback(server)).url;
}
const headers = { authorization: 'Bearer key', 'content-type': 'application/json' };
it('keeps original optional public roles and reflected factory return contracts', () => {
  expectTypeOf<
    ReturnType<typeof createPublicationOperations>
  >().toEqualTypeOf<PublicationReviewOperations>();
  expectTypeOf<ReviewOperations['requestValidation']>().toEqualTypeOf<
    PublicationReviewOperations['requestValidation']
  >();
  const operations = createValidatedPublicationOperations(core.createReviewSession(), output);
  expectTypeOf(operations.requestValidation).toEqualTypeOf<
    NonNullable<PublicationReviewOperations['requestValidation']>
  >();
});
it('uses the selected peer validator and its distinct errors, including live replacement', async () => {
  class PeerError extends Error {
    readonly code = 'invalid-state' as const;
    readonly details: readonly string[] = [];
    constructor(_code: ConstructorParameters<typeof core.ReviewXmlError>[0], message: string) {
      super(message);
    }
  }
  const validate = vi.fn(() => {
    throw new PeerError('invalid-state', 'selected peer refusal');
  });
  const engine = resolveServeEngine({
    ...core,
    ReviewXmlError: PeerError,
    validateReviewState: validate,
  });
  const operations = createValidatedPublicationOperations(
    core.createReviewSession(),
    output,
    engine
  );
  const publish = vi.spyOn(operations, 'publishReview');
  const url = await listen(
    createValidatedReviewServer({ operations, publication: operations, capability: 'key' })
  );
  const post = () =>
    fetch(url + 'api/review', { method: 'POST', headers, body: JSON.stringify(state) });
  const first = await post();
  expect(first.status).toBe(400);
  expect(await first.json()).toEqual({ error: 'selected peer refusal' });
  expect(validate).toHaveBeenCalledOnce();
  operations.requestValidation = {
    ...operations.requestValidation,
    parseReviewStateBody: () => ({ ok: false, error: 'replacement refusal' }),
  };
  const second = await post();
  expect(await second.json()).toEqual({ error: 'replacement refusal' });
  expect(publish).not.toHaveBeenCalled();
});
it('retains legacy omitted-validator construction and default validation', async () => {
  const operations = createReviewOperations(core.createReviewSession(), output);
  delete operations.requestValidation;
  const publish = vi.spyOn(operations, 'publishReview');
  const url = await listen(createReviewServer({ operations, capability: 'key' }));
  const response = await fetch(url + 'api/review', {
    method: 'POST',
    headers,
    body: JSON.stringify({ invalid: true }),
  });
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: 'unknown field: invalid' });
  expect(publish).not.toHaveBeenCalled();
});
it('does not fall back to installed validation if a modern host removes its binding', async () => {
  const operations = createValidatedPublicationOperations(core.createReviewSession(), output);
  const url = await listen(
    createValidatedReviewServer({
      operations,
      publication: operations,
      capability: 'key',
      reportDiagnostic: () => {},
    })
  );
  Reflect.deleteProperty(operations, 'requestValidation');
  const response = await fetch(url + 'api/review', {
    method: 'POST',
    headers,
    body: JSON.stringify(state),
  });
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: 'internal error' });
});
