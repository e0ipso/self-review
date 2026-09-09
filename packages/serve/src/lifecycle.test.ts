import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createReviewSession } from '@self-review/core';
import type { ReviewSession, ReviewState } from '@self-review/core';
import { createReviewServer, listenLoopback } from './server';
import { completeReviewOnSubmit } from './lifecycle';

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
