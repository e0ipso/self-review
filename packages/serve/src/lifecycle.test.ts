// The route publishes before it answers; a failed publication leaves the server up; exit follows only an acknowledged success.

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createReviewSession, commitDiffData, ReviewPublishError } from '@self-review/core';
import type { ReviewSession, ReviewState } from '@self-review/core';
import { createReviewServer, listenLoopback } from './server';
import { createReviewOperations } from './review-operations';
import { completeReviewOnSubmit } from './lifecycle';
import { encodeReviewStateForWire } from './client/adapter';

let tmp: string;
let session: ReviewSession;
let server: ReturnType<typeof createReviewServer>;
let base: string;
let outputPath: string;
let operations: ReturnType<typeof createReviewOperations>;
let expireDeadline: () => void;
let cancelDeadline: ReturnType<typeof vi.fn<() => void>>;
let exit: ReturnType<typeof vi.fn<(code: number) => void>>;

const CAPABILITY = 'test-capability-0123456789abcdefghijklmnopqrstuvwxyz';
const AUTH = { authorization: `Bearer ${CAPABILITY}` };

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
    headers: { 'content-type': 'application/json', ...AUTH },
    body: JSON.stringify(state),
  });
}

// Gives the response's `finish` event a turn.
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
  // One directory per case so a leftover directory or asset does not leak into the next.
  const caseDir = fs.mkdtempSync(path.join(tmp, 'case-'));
  outputPath = path.join(caseDir, 'review.xml');
  session = createReviewSession();
  session.diffData = {
    source: { type: 'git', gitDiffArgs: '', repository: tmp },
    files: [],
  };
  commitDiffData(
    session,
    {
      source: { type: 'git', gitDiffArgs: '', repository: tmp },
      files: [
        {
          oldPath: 'src/index.ts',
          newPath: 'src/index.ts',
          changeType: 'modified',
          isBinary: false,
          hunks: [],
        },
      ],
    },
    {
      mode: 'git',
      sourceRoot: tmp,
      invocationCwd: tmp,
      gitDiffArgv: [],
      pathPrefix: '',
      oldSide: { kind: 'index' },
      newSide: { kind: 'working-tree' },
    }
  );
  const output = { path: outputPath, origin: 'explicit' as const };
  operations = createReviewOperations(session, output);
  server = createReviewServer({ session, output, capability: CAPABILITY, operations });
  // The process exit is injected so the test can observe the code the real
  // program would exit with.
  exit = vi.fn<(code: number) => void>();
  cancelDeadline = vi.fn<() => void>();
  completeReviewOnSubmit({
    server,
    exit,
    scheduleDeadline: expire => {
      expireDeadline = expire;
      return cancelDeadline;
    },
  });
  base = (await listenLoopback(server)).url;
});

afterEach(() => {
  server.closeAllConnections();
  server.close();
});

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('submission protocol', () => {
  it('rejects overlapping submissions without starting a second publisher', async () => {
    const gate = deferred();
    const publish = operations.publishReview;
    const publisher = vi.spyOn(operations, 'publishReview').mockImplementationOnce(async state => {
      await gate.promise;
      return publish(state);
    });
    const first = submit(reviewState());
    await vi.waitFor(() => expect(publisher).toHaveBeenCalledTimes(1));
    const secondState = reviewState();
    secondState.files[0].comments[0].body = 'competing state';
    const second = await submit(secondState);
    gate.resolve();
    const firstResponse = await first;
    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({
      error: 'review submission already in progress or complete',
    });
    expect(session.reviewState?.files[0].comments[0].body).toBe('Needs a test.');
    expect(publisher).toHaveBeenCalledTimes(1);
    expect(firstResponse.status).toBe(200);
    expect(fs.readFileSync(outputPath, 'utf8')).not.toContain('competing state');
    await vi.waitFor(() => expect(exit).toHaveBeenCalledTimes(1));
  });

  it('reopens admission after an overlapping first publication fails', async () => {
    fs.writeFileSync(outputPath, 'previous document');
    const gate = deferred();
    const publisher = vi.spyOn(operations, 'publishReview').mockImplementationOnce(async () => {
      await gate.promise;
      throw new ReviewPublishError('permission-denied', outputPath, 'denied');
    });
    const first = submit(reviewState());
    await vi.waitFor(() => expect(publisher).toHaveBeenCalledTimes(1));
    const overlap = await submit(reviewState());
    gate.resolve();
    const refused = await first;
    expect(overlap.status).toBe(409);
    expect(refused.status).toBe(500);
    expect(fs.readFileSync(outputPath, 'utf8')).toBe('previous document');
    expect(exit).not.toHaveBeenCalled();
    expect((await submit(reviewState())).status).toBe(200);
    expect(publisher).toHaveBeenCalledTimes(2);
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
  });

  it('drains an admitted expansion after flushing the saved acknowledgement', async () => {
    const gate = deferred();
    const expansion = vi.spyOn(operations, 'expandContext').mockImplementationOnce(async () => {
      await gate.promise;
      return { hunks: [], totalLines: 42 };
    });
    const pending = fetch(base + 'api/expand-context', {
      method: 'POST',
      headers: { ...AUTH, 'content-type': 'application/json' },
      body: JSON.stringify({ filePath: 'src/index.ts', contextLines: 3 }),
    });
    await vi.waitFor(() => expect(expansion).toHaveBeenCalledTimes(1));
    const saved = await submit(reviewState());
    expect(await saved.json()).toEqual({ ok: true, outputPath });
    expect(fs.readFileSync(outputPath, 'utf8')).toContain('Needs a test.');
    expect(server.listening).toBe(false);
    expect(exit).not.toHaveBeenCalled();
    gate.resolve();
    const expanded = await pending;
    expect(await expanded.json()).toEqual({ hunks: [], totalLines: 42 });
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    expect(cancelDeadline).toHaveBeenCalledTimes(1);
  });

  it('bounds shutdown when an admitted operation never settles', async () => {
    const gate = deferred();
    const expansion = vi.spyOn(operations, 'expandContext').mockImplementationOnce(async () => {
      await gate.promise;
      return null;
    });
    const pending = fetch(base + 'api/expand-context', {
      method: 'POST',
      headers: { ...AUTH, 'content-type': 'application/json' },
      body: JSON.stringify({ filePath: 'src/index.ts', contextLines: 3 }),
    }).catch(error => error);
    await vi.waitFor(() => expect(expansion).toHaveBeenCalledTimes(1));
    try {
      expect((await submit(reviewState())).status).toBe(200);
      expect(exit).not.toHaveBeenCalled();
      expireDeadline();
      expect(exit).toHaveBeenCalledWith(0);
      expect(await pending).toBeInstanceOf(Error);
    } finally {
      gate.resolve();
    }
    await vi.waitFor(() => expect(cancelDeadline).toHaveBeenCalledTimes(1));
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it.each([
    { files: [null] },
    { files: [{ path: 'a', changeType: 'added', viewed: false, comments: null }] },
    { source: { type: 'invalid' } },
  ])('rejects malformed nested JSON before storage and permits retry: %j', async changes => {
    const invalid = await submit({ ...reviewState(), ...changes });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({
      error: expect.stringContaining('Invalid review state:'),
    });
    expect(session.reviewState).toBeNull();
    expect(fs.existsSync(outputPath)).toBe(false);
    expect(exit).not.toHaveBeenCalled();
    expect((await submit(reviewState())).status).toBe(200);
  });

  it('publishes before answering: a 200 means the file is on disk', async () => {
    const res = await submit(reviewState());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, outputPath });
    // The acknowledgement is honest only if the document already exists when the response was sent.
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
    fs.mkdirSync(outputPath);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const refused = await submit(reviewState());
      expect(refused.status).toBe(500);
      const body = await refused.json();
      expect(body).toMatchObject({ ok: false, code: 'output-is-directory' });
      expect(body.message).toContain(outputPath);

      await settle();
      expect(exit).not.toHaveBeenCalled();
      expect(server.listening).toBe(true);
      expect((await fetch(base + 'api/diff', { headers: AUTH })).status).toBe(200);

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

    const xml = fs.readFileSync(outputPath, 'utf-8');
    const relative = xml.match(/<attachment path="([^"]+)" media-type="image\/png" \/>/)?.[1];
    expect(relative).toMatch(/^\.self-review-assets\/c1-[0-9a-f]+\.png$/);
    const asset = path.join(path.dirname(outputPath), relative!);
    expect(fs.readFileSync(asset)).toEqual(Buffer.from(bytes));
  });

  it('does nothing for a rejected submission or any other request', async () => {
    expect((await submit({ nope: true })).status).toBe(400);
    expect((await fetch(base + 'api/diff', { headers: AUTH })).status).toBe(200);

    // Nothing completed: still listening, nothing written. Losing the tab
    // that made these requests would be no different.
    await settle();
    expect(server.listening).toBe(true);
    expect(exit).not.toHaveBeenCalled();
    expect(fs.existsSync(outputPath)).toBe(false);
  });
});
