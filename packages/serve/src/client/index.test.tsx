// @vitest-environment jsdom

// The page against a real listener: the actual App, the actual adapter, the
// actual `@self-review/react` tree, and `createReviewServer` on an ephemeral
// port behind a `fetch` that resolves the page's relative URLs against it.
// What is asserted is recovery — a failed request never leaves the reviewer
// with a blank page or a review that cannot be submitted again.

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createReviewSession } from '@self-review/core';
import type { AppConfig, DiffFile, ReviewSession } from '@self-review/core';
import { installBrowserApiStubs } from '../../../react/src/test-helpers';
import { createReviewServer, listenLoopback } from '../server';
import { completeReviewOnSubmit } from '../lifecycle';
import { App } from './index';

installBrowserApiStubs();

// The real Layout mounts resizable panels, which observe their own size in a
// layout effect; jsdom has no ResizeObserver and the react package's stubs
// do not cover it, since its own suites mock Layout out.
class StubResizeObserver implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
(globalThis as { ResizeObserver: typeof ResizeObserver }).ResizeObserver = StubResizeObserver;

/** Generous: each case mounts the whole review tree over a real socket. */
const CASE_TIMEOUT_MS = 30_000;

const CONFIG: AppConfig = {
  theme: 'dark',
  diffView: 'unified',
  fontSize: 14,
  outputFormat: 'xml',
  outputFile: 'review.xml',
  ignore: [],
  categories: [],
  defaultDiffArgs: '',
  showUntracked: true,
  showUntrackedExplicit: false,
  wordWrap: true,
  maxFiles: 500,
  maxTotalLines: 50_000,
};

const INDEX_FILE: DiffFile = {
  oldPath: 'src/index.ts',
  newPath: 'src/index.ts',
  changeType: 'added',
  isBinary: false,
  hunks: [
    {
      header: '@@ -0,0 +1 @@',
      oldStart: 0,
      oldLines: 0,
      newStart: 1,
      newLines: 1,
      lines: [{ type: 'addition', content: 'export {};', oldLineNumber: null, newLineNumber: 1 }],
    },
  ],
};

let tmp: string;
let outputPath: string;
let session: ReviewSession;
let server: ReturnType<typeof createReviewServer>;
let base: string;
let exit: ReturnType<typeof vi.fn<(code: number) => void>>;
let errors: ReturnType<typeof vi.spyOn>;

const realFetch: typeof fetch = globalThis.fetch;

/** Resolve the page's relative URLs against the listener. Tests narrow it. */
let route: (url: URL, init?: RequestInit) => Promise<Response>;

beforeEach(async () => {
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'serve-client-')));
  outputPath = path.join(tmp, 'review.xml');

  session = createReviewSession();
  session.diffData = {
    source: { type: 'git', gitDiffArgs: '--staged', repository: tmp },
    files: [INDEX_FILE],
  };
  session.config = CONFIG;
  session.outputPathInfo = { resolvedOutputPath: outputPath, outputPathWritable: true };
  // A resumed comment is work that exists only in the page once loaded, and
  // the way to have some without driving the comment editor in jsdom.
  session.resumeComments = [
    {
      id: 'c1',
      filePath: 'src/index.ts',
      lineRange: { side: 'new', start: 1, end: 1 },
      body: 'Needs a test.',
      category: 'task',
      suggestion: null,
    },
  ];

  server = createReviewServer({
    session,
    repositoryRoot: tmp,
    output: { path: outputPath, origin: 'explicit' },
    // Never served here: the page is mounted by React Testing Library.
    clientDir: tmp,
  });
  exit = vi.fn<(code: number) => void>();
  completeReviewOnSubmit({ server, exit });
  base = (await listenLoopback(server)).url;

  route = (url, init) => realFetch(url, init);
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) =>
    route(new URL(String(input), base), init)
  );
  // The server reports every refusal on stderr; that is its job, not noise
  // worth reading in a test run.
  errors = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  errors.mockRestore();
  vi.unstubAllGlobals();
  if (server.listening) {
    server.closeAllConnections();
    server.close();
  }
  fs.rmSync(tmp, { recursive: true, force: true });
});

/** Whether the page would currently prompt before the tab closes. */
function closeIsGuarded(): boolean {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

async function mountWithUnsavedWork() {
  const view = render(<App />);
  await view.findByTestId('finish-review-btn', {}, { timeout: 10_000 });
  // The resumed comment has landed once the close guard is up.
  await waitFor(() => expect(closeIsGuarded()).toBe(true), { timeout: 10_000 });
  return view;
}

describe('serve client', () => {
  it('shows the connection notice, not a crash, when the config request fails', async () => {
    route = () => Promise.reject(new TypeError('Failed to fetch'));

    const view = render(<App />);

    expect(await view.findByText('Could not reach the review server')).toBeTruthy();
    expect(view.getByText('Failed to fetch')).toBeTruthy();
  });

  it(
    'keeps the review and its close guard after a failed publication, and retries to success',
    async () => {
      // A directory where the file should go: the publisher refuses, the
      // reviewer removes it, and the same review is submitted again.
      fs.mkdirSync(outputPath);
      const view = await mountWithUnsavedWork();

      fireEvent.click(view.getByTestId('finish-review-btn'));

      const notice = await view.findByTestId('submit-error', {}, { timeout: 10_000 });
      expect(notice.textContent).toContain('output-is-directory');
      expect(notice.textContent).toContain('it is a directory');
      expect(notice.textContent).toMatch(/Finish Review again/);
      // Still a review with unsaved work: closing the tab would lose it.
      expect(closeIsGuarded()).toBe(true);
      expect(view.getByTestId('finish-review-btn')).toBeTruthy();
      expect(exit).not.toHaveBeenCalled();

      fs.rmdirSync(outputPath);
      fireEvent.click(view.getByTestId('finish-review-btn'));

      expect(await view.findByText('Review saved', {}, { timeout: 10_000 })).toBeTruthy();
      expect(fs.readFileSync(outputPath, 'utf-8')).toContain('Needs a test.');
      await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
      // Nothing left to lose.
      expect(closeIsGuarded()).toBe(false);
    },
    CASE_TIMEOUT_MS
  );

  it(
    "maps the server's 413 to the size message and lets the reviewer try again",
    async () => {
      let refusals = 0;
      route = (url, init) => {
        if (url.pathname === '/api/review' && refusals === 0) {
          refusals += 1;
          return Promise.resolve(
            new Response(JSON.stringify({ error: 'request body too large' }), {
              status: 413,
              headers: { 'content-type': 'application/json' },
            })
          );
        }
        return realFetch(url, init);
      };
      const view = await mountWithUnsavedWork();

      fireEvent.click(view.getByTestId('finish-review-btn'));

      const notice = await view.findByTestId('submit-error', {}, { timeout: 10_000 });
      expect(notice.textContent).toMatch(/32\.0 MB limit/);
      expect(notice.textContent).toMatch(/attachments/i);
      expect(closeIsGuarded()).toBe(true);

      fireEvent.click(view.getByTestId('finish-review-btn'));

      expect(await view.findByText('Review saved', {}, { timeout: 10_000 })).toBeTruthy();
      expect(fs.existsSync(outputPath)).toBe(true);
      await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    },
    CASE_TIMEOUT_MS
  );
});
