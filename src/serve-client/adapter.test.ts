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
import type { GuideLoadPayload, ReviewState } from '../shared/types';
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

  // Which refusals throw and which degrade to a renderable "nothing" is a
  // per-method policy decision, not a uniform one, and getting it backwards
  // fails silently in both directions: a swallowed submit reports a review
  // that was never written, and a thrown file load leaves a spinner running.
  it('throws where success must not be assumed, and answers null where it may', async () => {
    const refusal = (): Response =>
      json({ error: 'the server said no' }, { ok: false, status: 500 });
    mockFetch([refusal(), refusal(), refusal(), refusal()]);

    const state = { timestamp: '', source: { type: 'git' }, files: [] } as unknown as ReviewState;
    await expect(httpAdapter.submitReview!(state)).rejects.toThrow(
      'Failed to save the review: the server said no'
    );
    expect(calls[0][0]).toBe('/api/review');
    expect(calls[0][1]?.method).toBe('POST');

    await expect(httpAdapter.loadDiff()).rejects.toThrow(
      'Failed to load the diff: the server said no'
    );

    expect(
      await httpAdapter.expandContext!({ filePath: 'src/app.ts', contextLines: 20 })
    ).toBeNull();
    expect(await httpAdapter.loadFileContent!('src/app.ts')).toBeNull();
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
