// Contract test for the browser adapter.
//
// `ReviewAdapter` has several implementations over different transports, so
// what is asserted here is the contract, not the implementation: for every
// method, the request it issues and the shape it resolves to. `fetch` is
// stubbed; the round trip against a running server is covered by the
// end-to-end project.

import { describe, it, expect, vi, afterEach } from 'vitest';
import type { ReviewState } from '@self-review/core';
import { createFetchAdapter, loadServeConfig, ServeRequestError } from './adapter';
import { parseReviewStateBody } from '../validate';
import { MAX_REVIEW_BODY_BYTES, REVIEW_TOO_LARGE_CODE } from '../protocol';

/** The session capability the page took from its launch URL. */
const CAPABILITY = 'test-capability-0123456789abcdefghijklmnopqrstuvwxyz';

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value ?? null), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function stubFetch(handler: Handler) {
  const spy = vi.fn(async (input: unknown, init?: RequestInit) => handler(String(input), init));
  vi.stubGlobal('fetch', spy);
  return spy;
}

/** Answers every route with a canned body; individual tests narrow it. */
function stubRoutes(bodies: Record<string, unknown>) {
  return stubFetch(url => {
    const route = url.split('?')[0];
    if (!(route in bodies)) return json({ error: 'not found' }, 404);
    return json(bodies[route]);
  });
}

const DIFF_PAYLOAD = {
  files: [
    {
      oldPath: 'src/a.ts',
      newPath: 'src/a.ts',
      changeType: 'modified',
      isBinary: false,
      hunks: [],
    },
  ],
  source: { type: 'git', gitDiffArgs: '--staged', repository: '/repo' },
};

const GUIDE_PAYLOAD = { overview: 'Start here.', groups: [] };

const REVIEW_STATE: ReviewState = {
  timestamp: '2026-09-09T00:00:00.000Z',
  source: { type: 'git', gitDiffArgs: '--staged', repository: '/repo' },
  files: [{ path: 'src/a.ts', changeType: 'modified', viewed: true, comments: [] }],
};

function headersOf(init: RequestInit | undefined): Record<string, string> {
  return (init?.headers ?? {}) as Record<string, string>;
}

/** The error a submission rejected with, typed as the adapter's own. */
async function rejectionOf(work: Promise<void> | void): Promise<ServeRequestError> {
  try {
    await work;
  } catch (error) {
    return error as ServeRequestError;
  }
  throw new Error('expected the submission to be refused');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createFetchAdapter', () => {
  // The server answers 401 to any API request without it, so this is the
  // one property every method has to share. The token goes in a header and
  // nowhere else: never a query parameter, which would land in history and
  // logs, and never storage, which would outlive the session.
  it('presents the capability as a bearer token on every request', async () => {
    const spy = stubFetch(url =>
      url.startsWith('/api/attachment')
        ? new Response(new Uint8Array([1]), { status: 200 })
        : json({ diff: DIFF_PAYLOAD, guide: null, ok: true, outputPath: '/r/review.xml' })
    );
    const adapter = createFetchAdapter(CAPABILITY);

    await adapter.loadDiff();
    await adapter.loadResumedReview!();
    await adapter.loadFileContent!('src/a.ts');
    await adapter.loadImage!('img.png');
    await adapter.readAttachment!('.self-review-assets/a.png');
    await adapter.expandContext!({ filePath: 'src/a.ts', contextLines: 3 });
    await adapter.applySuggestion!({
      filePath: 'src/a.ts',
      lineRange: { side: 'new', start: 1, end: 1 },
      suggestion: { originalCode: 'a', proposedCode: 'b' },
    });
    await adapter.submitReview!(REVIEW_STATE);
    await loadServeConfig(CAPABILITY);

    expect(spy).toHaveBeenCalledTimes(9);
    for (const [url, init] of spy.mock.calls) {
      expect(headersOf(init).authorization, String(url)).toBe(`Bearer ${CAPABILITY}`);
      expect(String(url)).not.toContain(CAPABILITY);
    }
    // The POST routes keep their content type beside the token.
    const posts = spy.mock.calls.filter(([, init]) => init?.method === 'POST');
    expect(posts).toHaveLength(3);
    for (const [, init] of posts) {
      expect(headersOf(init)['content-type']).toBe('application/json');
    }
  });

  it('loads the diff from GET /api/diff', async () => {
    const spy = stubRoutes({ '/api/diff': { diff: DIFF_PAYLOAD, guide: null } });
    const adapter = createFetchAdapter(CAPABILITY);

    await expect(adapter.loadDiff()).resolves.toEqual(DIFF_PAYLOAD);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toBe('/api/diff');
  });

  it('throws when the server has no diff to serve', async () => {
    stubRoutes({ '/api/diff': null });
    await expect(createFetchAdapter(CAPABILITY).loadDiff()).rejects.toThrow(/no diff/i);
  });

  it('satisfies onGuideLoad and onDiffLoad from the one GET /api/diff response', async () => {
    const spy = stubRoutes({ '/api/diff': { diff: DIFF_PAYLOAD, guide: GUIDE_PAYLOAD } });
    const adapter = createFetchAdapter(CAPABILITY);

    const guides: unknown[] = [];
    const diffs: unknown[] = [];
    // Mount order: ReviewProvider (child) calls loadDiff, then the parent
    // providers subscribe. All three must be served by a single request.
    const diffPromise = adapter.loadDiff();
    const unsubscribeDiff = adapter.onDiffLoad!(payload => diffs.push(payload));
    const unsubscribeGuide = adapter.onGuideLoad!(payload => guides.push(payload));
    await diffPromise;
    await Promise.resolve();
    await Promise.resolve();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(guides).toEqual([GUIDE_PAYLOAD]);
    expect(diffs).toEqual([DIFF_PAYLOAD]);
    expect(typeof unsubscribeDiff).toBe('function');
    expect(typeof unsubscribeGuide).toBe('function');
  });

  it('never invokes a guide callback when the session has no guide', async () => {
    stubRoutes({ '/api/diff': { diff: DIFF_PAYLOAD, guide: null } });
    const adapter = createFetchAdapter(CAPABILITY);
    const guides: unknown[] = [];

    await adapter.loadDiff();
    adapter.onGuideLoad!(payload => guides.push(payload));
    await Promise.resolve();
    await Promise.resolve();

    expect(guides).toEqual([]);
  });

  it('does not deliver to a callback that unsubscribed first', async () => {
    stubRoutes({ '/api/diff': { diff: DIFF_PAYLOAD, guide: GUIDE_PAYLOAD } });
    const adapter = createFetchAdapter(CAPABILITY);
    const guides: unknown[] = [];

    const unsubscribe = adapter.onGuideLoad!(payload => guides.push(payload));
    unsubscribe();
    await adapter.loadDiff();
    await Promise.resolve();
    await Promise.resolve();

    expect(guides).toEqual([]);
  });

  it('omits changeOutputPath entirely — the path is fixed at startup', () => {
    const adapter = createFetchAdapter(CAPABILITY);
    // Not "resolves to null": the file tree renders the control on the
    // property's presence, so a stub would leave a dead button.
    expect('changeOutputPath' in adapter).toBe(false);
    expect(adapter.changeOutputPath).toBeUndefined();
  });

  it('reads a resumed review from GET /api/resume', async () => {
    const resumed = { comments: [], viewedFiles: ['src/a.ts'] };
    const spy = stubRoutes({ '/api/resume': resumed });

    await expect(createFetchAdapter(CAPABILITY).loadResumedReview!()).resolves.toEqual(resumed);
    expect(spy.mock.calls[0][0]).toBe('/api/resume');
  });

  it('turns a null resume response into an empty resume payload', async () => {
    stubRoutes({ '/api/resume': null });
    await expect(createFetchAdapter(CAPABILITY).loadResumedReview!()).resolves.toEqual({
      comments: [],
      viewedFiles: [],
    });
  });

  it('loads one file’s hunks from GET /api/file with the path as a query parameter', async () => {
    const hunks = [
      { header: '@@ -1 +1 @@', oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: [] },
    ];
    const spy = stubRoutes({ '/api/file': hunks });

    await expect(createFetchAdapter(CAPABILITY).loadFileContent!('src/a b.ts')).resolves.toEqual(
      hunks
    );
    expect(spy.mock.calls[0][0]).toBe('/api/file?path=src%2Fa%20b.ts');
  });

  it('loads an image preview from GET /api/image', async () => {
    const result = { dataUri: 'data:image/png;base64,AAA' };
    const spy = stubRoutes({ '/api/image': result });

    await expect(createFetchAdapter(CAPABILITY).loadImage!('img.png')).resolves.toEqual(result);
    expect(spy.mock.calls[0][0]).toBe('/api/image?path=img.png');
  });

  it('reads attachment bytes from GET /api/attachment', async () => {
    const spy = stubFetch(() => new Response(new Uint8Array([1, 2, 3]), { status: 200 }));

    const buffer = await createFetchAdapter(CAPABILITY).readAttachment!(
      '.self-review-assets/a-0.png'
    );
    expect(new Uint8Array(buffer!)).toEqual(new Uint8Array([1, 2, 3]));
    expect(spy.mock.calls[0][0]).toBe('/api/attachment?path=.self-review-assets%2Fa-0.png');
  });

  it('resolves null when an attachment is missing rather than throwing', async () => {
    stubFetch(() => json({ error: 'attachment not found' }, 404));
    await expect(createFetchAdapter(CAPABILITY).readAttachment!('missing.png')).resolves.toBeNull();
  });

  it('posts an expand-context request as JSON', async () => {
    const response = { hunks: [], totalLines: 12 };
    const spy = stubRoutes({ '/api/expand-context': response });

    await expect(
      createFetchAdapter(CAPABILITY).expandContext!({ filePath: 'src/a.ts', contextLines: 99999 })
    ).resolves.toEqual(response);

    const [url, init] = spy.mock.calls[0];
    expect(url).toBe('/api/expand-context');
    expect(init?.method).toBe('POST');
    // The server answers 415 without this header.
    expect(headersOf(init)['content-type']).toBe('application/json');
    expect(JSON.parse(String(init?.body))).toEqual({
      filePath: 'src/a.ts',
      contextLines: 99999,
    });
  });

  it('passes a null expand-context response through', async () => {
    stubRoutes({ '/api/expand-context': null });
    await expect(
      createFetchAdapter(CAPABILITY).expandContext!({ filePath: 'src/a.ts', contextLines: 3 })
    ).resolves.toBeNull();
  });

  const ACK = { ok: true, outputPath: '/repo/review.xml' };

  it('posts the review state as JSON to /api/review', async () => {
    const spy = stubRoutes({ '/api/review': ACK });

    await createFetchAdapter(CAPABILITY).submitReview!(REVIEW_STATE);

    const [url, init] = spy.mock.calls[0];
    expect(url).toBe('/api/review');
    expect(init?.method).toBe('POST');
    expect(headersOf(init)['content-type']).toBe('application/json');
    expect(JSON.parse(String(init?.body))).toEqual(REVIEW_STATE);
  });

  it('sends only the three fields the server accepts', async () => {
    const spy = stubRoutes({ '/api/review': ACK });

    // Remote provenance is injected server-side; the server rejects an
    // unknown top-level field with 400, so the adapter must not forward it.
    await createFetchAdapter(CAPABILITY).submitReview!({
      ...REVIEW_STATE,
      remoteUrl: 'https://github.com/o/r/pull/1',
    });

    expect(Object.keys(JSON.parse(String(spy.mock.calls[0][1]?.body))).sort()).toEqual([
      'files',
      'source',
      'timestamp',
    ]);
  });

  it('rejects when the server refuses the review', async () => {
    stubFetch(() => json({ error: 'files must be an array' }, 400));
    const failure = await rejectionOf(createFetchAdapter(CAPABILITY).submitReview!(REVIEW_STATE));
    expect(failure).toBeInstanceOf(ServeRequestError);
    expect(failure.status).toBe(400);
    expect(failure.code).toBeNull();
    expect(failure.message).toMatch(/files must be an array/);
  });

  // The publisher's refusal, relayed: a 200 is a file on disk, so a failure
  // is the one thing the page has to explain well enough to be fixed.
  it("surfaces the publisher's code, message and details from a failed publication", async () => {
    stubFetch(() =>
      json(
        {
          ok: false,
          code: 'output-is-directory',
          message: 'Cannot write /repo/review.xml: it is a directory',
          details: ['one', 'two'],
        },
        500
      )
    );
    const failure = await rejectionOf(createFetchAdapter(CAPABILITY).submitReview!(REVIEW_STATE));
    expect(failure).toBeInstanceOf(ServeRequestError);
    expect(failure.status).toBe(500);
    expect(failure.code).toBe('output-is-directory');
    expect(failure.message).toContain('Cannot write /repo/review.xml: it is a directory');
    expect(failure.details).toEqual(['one', 'two']);
  });

  it('treats a 200 without an acknowledgement as a failure, never as a saved review', async () => {
    // The old route answered `null` after merely storing the state. A client
    // that accepted that would report a file the server never wrote.
    stubRoutes({ '/api/review': null });
    await expect(createFetchAdapter(CAPABILITY).submitReview!(REVIEW_STATE)).rejects.toThrow(
      /without acknowledging/i
    );
  });

  it('maps a 413 to the too-large code with an actionable message', async () => {
    stubFetch(() => json({ error: 'request body too large' }, 413));
    const failure = await rejectionOf(createFetchAdapter(CAPABILITY).submitReview!(REVIEW_STATE));
    expect(failure).toBeInstanceOf(ServeRequestError);
    expect(failure.status).toBe(413);
    expect(failure.code).toBe(REVIEW_TOO_LARGE_CODE);
    expect(failure.message).toMatch(/32\.0 MB/);
    expect(failure.message).toMatch(/attachment/i);
  });

  it('refuses to send a body over the limit, and says how big it was', async () => {
    const spy = stubRoutes({ '/api/review': ACK });
    // 25 MiB of image bytes is about 33.3 MiB once base64-encoded: over the
    // 32 MiB limit on the wire while well under it on disk, which is the
    // case a reviewer cannot see coming.
    const blob = new Uint8Array(25 * 1024 * 1024).buffer;
    const state: ReviewState = {
      ...REVIEW_STATE,
      files: [
        {
          path: 'src/a.ts',
          changeType: 'modified',
          viewed: false,
          comments: [
            {
              id: 'c1',
              filePath: 'src/a.ts',
              lineRange: null,
              body: 'look',
              category: 'bug',
              suggestion: null,
              attachments: [{ id: 'a1', fileName: 'big.png', mediaType: 'image/png', data: blob }],
            },
          ],
        },
      ],
    };

    const failure = await rejectionOf(createFetchAdapter(CAPABILITY).submitReview!(state));

    expect(spy).not.toHaveBeenCalled();
    expect(failure).toBeInstanceOf(ServeRequestError);
    expect(failure.status).toBeNull();
    expect(failure.code).toBe(REVIEW_TOO_LARGE_CODE);
    expect(failure.message).toMatch(/33\.\d MB/);
    expect(MAX_REVIEW_BODY_BYTES).toBe(32 * 1024 * 1024);
  });

  it('reads the config and its output path from GET /api/config', async () => {
    const payload = {
      config: { theme: 'dark' },
      outputPathInfo: { resolvedOutputPath: '/repo/review.xml', outputPathWritable: true },
    };
    const spy = stubRoutes({ '/api/config': payload });

    await expect(loadServeConfig(CAPABILITY)).resolves.toEqual(payload);
    expect(spy.mock.calls[0][0]).toBe('/api/config');
  });
});

describe('attachment blobs on the wire', () => {
  // `Attachment.data` is an ArrayBuffer and `JSON.stringify` renders one as
  // `{}` — so an unencoded submission writes an empty image file with a 200
  // and no error anywhere. These tests pin the encoding down from the client
  // side; ../validate.test.ts pins down the server side that undoes it.
  const BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  function buffer(): ArrayBuffer {
    return BYTES.slice().buffer;
  }

  function stateWithAttachments(): ReviewState {
    return {
      ...REVIEW_STATE,
      files: [
        {
          path: 'src/a.ts',
          changeType: 'modified',
          viewed: false,
          comments: [
            {
              id: 'c1',
              filePath: 'src/a.ts',
              lineRange: null,
              body: 'look',
              category: 'bug',
              suggestion: null,
              attachments: [
                { id: 'a1', fileName: 'shot.png', mediaType: 'image/png', data: buffer() },
                { id: 'a2', fileName: '.self-review-assets/c1-0.png', mediaType: 'image/png' },
              ],
              replies: [
                {
                  id: 'r1',
                  body: 'and this',
                  attachments: [
                    { id: 'a3', fileName: 'reply.png', mediaType: 'image/png', data: buffer() },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
  }

  async function submittedBody() {
    const spy = stubRoutes({ '/api/review': { ok: true, outputPath: '/repo/review.xml' } });
    await createFetchAdapter(CAPABILITY).submitReview!(stateWithAttachments());
    return JSON.parse(String(spy.mock.calls[0][1]?.body));
  }

  it('base64-encodes the blob into dataBase64 and drops the ArrayBuffer', async () => {
    const comment = (await submittedBody()).files[0].comments[0];
    expect(comment.attachments[0]).toEqual({
      id: 'a1',
      fileName: 'shot.png',
      mediaType: 'image/png',
      dataBase64: Buffer.from(BYTES).toString('base64'),
    });
    expect(comment.attachments[0]).not.toHaveProperty('data');
  });

  it('encodes reply attachments too', async () => {
    const comment = (await submittedBody()).files[0].comments[0];
    expect(comment.replies[0].attachments[0].dataBase64).toBe(
      Buffer.from(BYTES).toString('base64')
    );
  });

  it('leaves a resumed attachment — one with no blob — as it is', async () => {
    const comment = (await submittedBody()).files[0].comments[0];
    expect(comment.attachments[1]).toEqual({
      id: 'a2',
      fileName: '.self-review-assets/c1-0.png',
      mediaType: 'image/png',
    });
  });

  it('round-trips its own bytes through the server-side parser', async () => {
    // The encoder and the decoder live in different modules on different
    // sides of the socket; this is what keeps them from drifting apart.
    const result = parseReviewStateBody(await submittedBody());
    if (!result.ok) throw new Error(`server rejected the body: ${result.error}`);

    const comment = result.value.files[0].comments[0];
    expect(new Uint8Array(comment.attachments![0].data!)).toEqual(BYTES);
    expect(new Uint8Array(comment.replies![0].attachments![0].data!)).toEqual(BYTES);
    expect(comment.attachments![1].data).toBeUndefined();
  });
});
