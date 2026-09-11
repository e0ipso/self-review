import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createReviewSession } from '@self-review/core';
import type { ReviewSession, ReviewState } from '@self-review/core';
import { createReviewServer, listenLoopback } from './server';
import { completeReviewOnSubmit } from './lifecycle';
import { encodeReviewStateForWire } from './client/adapter';

let tmp: string;
let session: ReviewSession;
let server: ReturnType<typeof createReviewServer>;
let base: string;
let outputPath: string;
let exited: Promise<number>;

function reviewState(overrides: Partial<ReviewState> = {}): ReviewState {
  return {
    timestamp: '2026-01-01T00:00:00.000Z',
    source: { type: 'git', gitDiffArgs: '', repository: tmp },
    files: [
      {
        path: 'src/index.ts',
        changeType: 'modified',
        viewed: true,
        comments: [
          {
            id: 'c1',
            filePath: 'src/index.ts',
            lineRange: { side: 'new', start: 1, end: 1 },
            body: 'Needs a test.',
            category: 'task',
            suggestion: null,
          },
        ],
      },
    ],
    ...overrides,
  };
}

function submit(state: unknown): Promise<Response> {
  return fetch(base + 'api/review', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(state),
  });
}

beforeAll(() => {
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'serve-lifecycle-')));
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

beforeEach(async () => {
  outputPath = path.join(tmp, `review-${Math.random().toString(36).slice(2)}.xml`);
  session = createReviewSession();
  session.diffData = {
    source: { type: 'git', gitDiffArgs: '', repository: tmp },
    files: [],
  };
  server = createReviewServer({ session, repositoryRoot: tmp });
  // The process exit is injected so the test can observe the code the real
  // program would exit with.
  let settle: (code: number) => void;
  exited = new Promise<number>(resolve => {
    settle = resolve;
  });
  completeReviewOnSubmit({ server, session, outputPath, exit: code => settle(code) });
  base = (await listenLoopback(server)).url;
});

afterEach(() => {
  if (server.listening) {
    server.closeAllConnections();
    server.close();
  }
});

describe('completeReviewOnSubmit', () => {
  it('writes the output file, stops the listener and exits 0 when a review is submitted', async () => {
    expect((await submit(reviewState())).status).toBe(200);

    expect(await exited).toBe(0);
    expect(server.listening).toBe(false);
    const xml = fs.readFileSync(outputPath, 'utf-8');
    expect(xml).toContain('urn:self-review:v3');
    expect(xml).toContain('Needs a test.');
  });

  it('exits 1 without an output file when the review cannot be serialized', async () => {
    // Structurally valid (the route accepts it) but not a valid document:
    // timestamp is an xs:dateTime, so the XSD rejects it.
    expect((await submit(reviewState({ timestamp: 'yesterday' }))).status).toBe(200);

    expect(await exited).toBe(1);
    expect(fs.existsSync(outputPath)).toBe(false);
  });

  it('writes the attachment bytes the browser encoded, not an empty file', async () => {
    // The whole chain in one test: the client's own encoder, the HTTP body,
    // the route's decode, the serializer's asset write. `Attachment.data` is
    // an ArrayBuffer and `JSON.stringify` renders one as `{}`, so without the
    // base64 encoding this file would be written empty — with a 200, and no
    // error anywhere to notice it by.
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const state = reviewState();
    state.files[0].comments[0].attachments = [
      { id: 'a1', fileName: 'shot.png', mediaType: 'image/png', data: bytes.slice().buffer },
    ];

    expect((await submit(encodeReviewStateForWire(state))).status).toBe(200);
    expect(await exited).toBe(0);

    const asset = path.join(path.dirname(outputPath), '.self-review-assets', 'c1-0.png');
    expect(fs.readFileSync(asset)).toEqual(Buffer.from(bytes));
    expect(fs.readFileSync(outputPath, 'utf-8')).toContain(
      '<attachment path=".self-review-assets/c1-0.png" media-type="image/png" />'
    );
  });

  it('does nothing for a rejected submission or any other request', async () => {
    expect((await submit({ nope: true })).status).toBe(400);
    expect((await fetch(base + 'api/diff')).status).toBe(200);

    // Nothing completed: still listening, nothing written. Losing the tab
    // that made these requests would be no different.
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(server.listening).toBe(true);
    expect(fs.existsSync(outputPath)).toBe(false);
  });
});
