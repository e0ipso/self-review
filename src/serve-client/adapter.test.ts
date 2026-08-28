// Contract tests for the serve-mode HTTP adapter.
//
// These cover what the `ReviewAdapter` interface asks of an implementation
// that is easy to get wrong and would not fail loudly: the binary attachment
// read, the guide subscription's unsubscribe, and the deliberate decision that
// a refused image path is rendered rather than thrown. Everything else in the
// module is one `fetch` and one `res.json()`.
//
// The guide cases use `createHttpAdapter()` rather than the module-scope
// `httpAdapter`, because a subscriber registry is per-adapter state and tests
// that shared it would pass or fail on their ordering.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { GuideLoadPayload } from '../shared/types';
import { createHttpAdapter, httpAdapter } from './adapter';

type FetchArgs = [input: string, init?: RequestInit];

/** Requests the adapter made, in order. */
let calls: FetchArgs[] = [];

function respond(response: Partial<Response>): Response {
  return response as Response;
}

function json(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  return respond({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: () => Promise.resolve(body),
  });
}

/** Serve `responses` in call order; an unexpected extra request is an error. */
function mockFetch(responses: Response[]): void {
  const queue = [...responses];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string, init?: RequestInit) => {
      calls.push([input, init]);
      const next = queue.shift();
      if (!next) return Promise.reject(new Error(`Unexpected fetch: ${input}`));
      return Promise.resolve(next);
    })
  );
}

const GUIDE: GuideLoadPayload = { overview: 'read this first', groups: [] };

function diffBody(guide: GuideLoadPayload | null) {
  return { files: [], source: { type: 'git' }, guide };
}

beforeEach(() => {
  calls = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('httpAdapter', () => {
  it('omits changeOutputPath entirely', () => {
    expect('changeOutputPath' in httpAdapter).toBe(false);
    expect(httpAdapter.changeOutputPath).toBeUndefined();
  });

  it('reads an attachment as bytes, and answers null when the route refuses', async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer;
    mockFetch([
      respond({ ok: true, status: 200, arrayBuffer: () => Promise.resolve(bytes) }),
      json({ error: 'Path escapes the review roots' }, { ok: false, status: 400 }),
    ]);

    const found = await httpAdapter.readAttachment!('.self-review-assets/shot.png');
    expect(found).toBeInstanceOf(ArrayBuffer);
    expect(new Uint8Array(found as ArrayBuffer)).toEqual(new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
    expect(calls[0][0]).toBe('/api/attachment/.self-review-assets%2Fshot.png');

    expect(await httpAdapter.readAttachment!('../outside.png')).toBeNull();
  });

  it('returns a refused image path as an ImageLoadResult rather than throwing', async () => {
    mockFetch([json({ error: 'Path escapes the review root' }, { ok: false, status: 400 })]);
    await expect(httpAdapter.loadImage!('../../etc/passwd')).resolves.toEqual({
      error: 'Path escapes the review root',
    });
  });

  it('delivers the guide from the diff response and stops after unsubscribe', async () => {
    const adapter = createHttpAdapter();
    const seen: GuideLoadPayload[] = [];
    const unsubscribe = adapter.onGuideLoad!(payload => seen.push(payload));
    expect(typeof unsubscribe).toBe('function');

    mockFetch([json(diffBody(GUIDE))]);
    const payload = await adapter.loadDiff();
    expect(seen).toEqual([GUIDE]);
    // The guide rides in the diff body but is not part of the diff payload.
    expect('guide' in payload).toBe(false);

    unsubscribe();
    vi.unstubAllGlobals();
    mockFetch([json(diffBody(GUIDE))]);
    await adapter.loadDiff();
    expect(seen).toHaveLength(1);
  });

  it('replays the loaded guide to a subscriber that arrives after the diff', async () => {
    const adapter = createHttpAdapter();
    mockFetch([json(diffBody(GUIDE))]);
    await adapter.loadDiff();

    const seen: GuideLoadPayload[] = [];
    adapter.onGuideLoad!(payload => seen.push(payload))();
    expect(seen).toEqual([GUIDE]);
  });

  it('does not notify subscribers when the session carries no guide', async () => {
    const adapter = createHttpAdapter();
    const seen: GuideLoadPayload[] = [];
    const unsubscribe = adapter.onGuideLoad!(payload => seen.push(payload));
    mockFetch([json(diffBody(null))]);
    await adapter.loadDiff();
    expect(seen).toEqual([]);
    unsubscribe();
  });
});
