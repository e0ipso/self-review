import { expect, it, vi } from 'vitest';
import { createReviewSession } from '@self-review/core';
import { createReviewServer, listenLoopback } from '../server';
import { createReviewOperations } from '../review-operations';
import { REQUEST_SHUTDOWN } from '../request-admission';
import { createFetchAdapter } from './adapter';
import { createServeRequester } from './requester';

it('passes all four optional read signals into fetch without sending pre-aborted work', async () => {
  const transport = vi.fn<typeof fetch>();
  const adapter = createFetchAdapter(
    'capability',
    createServeRequester('capability', { fetch: transport })
  );
  const abort = new AbortController();
  abort.abort();
  const calls = [
    () => adapter.reads!.loadFileContent!('a.ts', abort.signal),
    () => adapter.reads!.loadImage!('a.png', abort.signal),
    () => adapter.reads!.readAttachment!('.self-review-assets/a.png', abort.signal),
    () => adapter.reads!.expandContext!({ filePath: 'a.ts', contextLines: 5 }, abort.signal),
  ];
  for (const call of calls) await expect(call()).rejects.toMatchObject({ uncertain: false });
  expect(transport).not.toHaveBeenCalled();
  adapter.dispose();
});

it('cancels a read through the actual loopback server and releases admission for the next read', async () => {
  const capability = 'unit-test-read-capability';
  const session = createReviewSession();
  const operations = createReviewOperations(session, {
    path: '/unused/review.xml',
    origin: 'explicit',
  });
  let signal!: AbortSignal;
  let entered!: () => void;
  let cancelled!: () => void;
  const started = new Promise<void>(resolve => {
    entered = resolve;
  });
  const stopped = new Promise<void>(resolve => {
    cancelled = resolve;
  });
  operations.readAttachment = vi.fn((_reference, options) => {
    signal = options!.signal!;
    return new Promise<never>((_resolve, reject) => {
      signal.addEventListener(
        'abort',
        () => {
          cancelled();
          reject(signal.reason);
        },
        { once: true }
      );
      entered();
    });
  });
  const server = createReviewServer({ operations, capability, maxRequests: 1 });
  const address = await listenLoopback(server);
  const requester = createServeRequester(capability, {
    fetch: (input, init) => fetch(new URL(String(input), address.url), init),
  });
  const adapter = createFetchAdapter(capability, requester);
  try {
    const controller = new AbortController();
    const reading = adapter.reads!.readAttachment!('.self-review-assets/a.png', controller.signal);
    const rejected = expect(reading).rejects.toMatchObject({ uncertain: false });
    await started;
    expect(signal.aborted).toBe(false);
    controller.abort();
    await rejected;
    await stopped;
    expect(signal.aborted).toBe(true);
    operations.readAttachment = async () => ({ ok: true, data: Uint8Array.of(1, 2, 3).buffer });
    // The prior request's operation and its closed response both release their admission.
    await vi.waitFor(async () => {
      const next = await adapter.reads!.readAttachment!(
        '.self-review-assets/a.png',
        new AbortController().signal
      );
      expect(new Uint8Array(next!)).toEqual(Uint8Array.of(1, 2, 3));
    });
  } finally {
    adapter.dispose();
    await server[REQUEST_SHUTDOWN]();
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close(error => (error ? reject(error) : resolve()))
    );
  }
});
