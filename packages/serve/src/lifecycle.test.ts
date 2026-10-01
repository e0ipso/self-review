// The submission protocol end to end over a real listener: the route
// publishes before it answers, a failed publication leaves the server up for
// a retry, and the process exits only once a success has been acknowledged.

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
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
let exit: ReturnType<typeof vi.fn<(code: number) => void>>;

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

/** Give the response's `finish` event, and anything hooked on it, a turn. */
function settle(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 50));
}

beforeAll(() => {
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'serve-lifecycle-')));
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

beforeEach(async () => {
  // One directory per case: a case that leaves a directory at the output
  // path, or assets beside it, must not leak into the next.
  const caseDir = fs.mkdtempSync(path.join(tmp, 'case-'));
  outputPath = path.join(caseDir, 'review.xml');
  session = createReviewSession();
  session.diffData = {
    source: { type: 'git', gitDiffArgs: '', repository: tmp },
    files: [],
  };
  server = createReviewServer({
    session,
    repositoryRoot: tmp,
    output: { path: outputPath, origin: 'explicit' },
  });
  // The process exit is injected so the test can observe the code the real
  // program would exit with — and that it is never called on a failure.
  exit = vi.fn<(code: number) => void>();
  completeReviewOnSubmit({ server, exit });
  base = (await listenLoopback(server)).url;
});

afterEach(() => {
  if (server.listening) {
    server.closeAllConnections();
    server.close();
  }
});

describe('submission protocol', () => {
  it('publishes before answering: a 200 means the file is on disk', async () => {
    const res = await submit(reviewState());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, outputPath });
    // Asserted before anything else gets a turn: the acknowledgement is only
    // honest if the document already exists when the response was sent.
    const xml = fs.readFileSync(outputPath, 'utf-8');
    expect(xml).toContain('urn:self-review:v3');
    expect(xml).toContain('Needs a test.');
  });

  it('stops the listener and exits 0 once the acknowledgement has been flushed', async () => {
    expect((await submit(reviewState())).status).toBe(200);

    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    expect(exit).toHaveBeenCalledTimes(1);
    expect(server.listening).toBe(false);
  });

  it('answers a document the schema rejects with 422, writes nothing and stays up', async () => {
    // Structurally valid (the route accepts it) but not a valid document:
    // timestamp is an xs:dateTime, so the XSD rejects it.
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await submit(reviewState({ timestamp: 'yesterday' }));

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.ok).toBe(false);
      expect(body.code).toBe('validation-failed');
      expect(typeof body.message).toBe('string');
      expect(Array.isArray(body.details)).toBe(true);

      await settle();
      expect(fs.existsSync(outputPath)).toBe(false);
      expect(server.listening).toBe(true);
      expect(exit).not.toHaveBeenCalled();
    } finally {
      errors.mockRestore();
    }
  });

  it('reports a write failure, keeps serving, and lets a retry succeed once it is fixed', async () => {
    // A directory where the file should go: the publisher refuses, and the
    // reviewer can fix it without losing the review that is still in the tab.
    fs.mkdirSync(outputPath);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const refused = await submit(reviewState());
      expect(refused.status).toBe(500);
      const body = await refused.json();
      expect(body).toMatchObject({ ok: false, code: 'output-is-directory' });
      expect(body.message).toContain(outputPath);

      // Not a completion: nothing exited, every route still answers.
      await settle();
      expect(exit).not.toHaveBeenCalled();
      expect(server.listening).toBe(true);
      expect((await fetch(base + 'api/diff')).status).toBe(200);

      // The fix, then the same review again.
      fs.rmdirSync(outputPath);
      const retried = await submit(reviewState());
      expect(retried.status).toBe(200);
      expect(await retried.json()).toEqual({ ok: true, outputPath });
      expect(fs.readFileSync(outputPath, 'utf-8')).toContain('Needs a test.');

      await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
      expect(server.listening).toBe(false);
    } finally {
      errors.mockRestore();
    }
  });

  it('writes the attachment bytes the browser encoded, not an empty file', async () => {
    // The whole chain in one test: the client's own encoder, the HTTP body,
    // the route's decode, the publisher's asset write. `Attachment.data` is
    // an ArrayBuffer and `JSON.stringify` renders one as `{}`, so without the
    // base64 encoding this file would be written empty — with a 200, and no
    // error anywhere to notice it by.
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const state = reviewState();
    state.files[0].comments[0].attachments = [
      { id: 'a1', fileName: 'shot.png', mediaType: 'image/png', data: bytes.slice().buffer },
    ];

    expect((await submit(encodeReviewStateForWire(state))).status).toBe(200);

    // The publisher gives each new asset a unique name; the document is the
    // record of which one.
    const xml = fs.readFileSync(outputPath, 'utf-8');
    const relative = xml.match(/<attachment path="([^"]+)" media-type="image\/png" \/>/)?.[1];
    expect(relative).toMatch(/^\.self-review-assets\/c1-[0-9a-f]+\.png$/);
    const asset = path.join(path.dirname(outputPath), relative!);
    expect(fs.readFileSync(asset)).toEqual(Buffer.from(bytes));
  });

  it('does nothing for a rejected submission or any other request', async () => {
    expect((await submit({ nope: true })).status).toBe(400);
    expect((await fetch(base + 'api/diff')).status).toBe(200);

    // Nothing completed: still listening, nothing written. Losing the tab
    // that made these requests would be no different.
    await settle();
    expect(server.listening).toBe(true);
    expect(exit).not.toHaveBeenCalled();
    expect(fs.existsSync(outputPath)).toBe(false);
  });
});
