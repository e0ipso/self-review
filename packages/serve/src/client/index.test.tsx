// @vitest-environment jsdom

// The real App and adapter against `createReviewServer` on an ephemeral port. Asserts recovery: a failed request
// never leaves a blank page or a review that cannot be resubmitted.

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, cleanup, fireEvent, waitFor } from '@testing-library/react';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createReviewSession } from '@self-review/core';
import type { AppConfig, DiffFile, ReviewSession } from '@self-review/core';
import { installBrowserApiStubs } from '../../../react/src/test-helpers';
import { createReviewServer, listenLoopback } from '../server';
import { completeReviewOnSubmit } from '../lifecycle';
import { App, takeCapabilityFromLocation } from './index';

installBrowserApiStubs();

// The real Layout's resizable panels need ResizeObserver, which jsdom lacks.
class StubResizeObserver implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
(globalThis as { ResizeObserver: typeof ResizeObserver }).ResizeObserver = StubResizeObserver;

const CASE_TIMEOUT_MS = 30_000;

const CAPABILITY = 'test-capability-0123456789abcdefghijklmnopqrstuvwxyz';

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
  // A resumed comment is unsaved work without driving the comment editor in jsdom.
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
    output: { path: outputPath, origin: 'explicit' },
    capability: CAPABILITY,
    clientDir: tmp,
  });
  exit = vi.fn<(code: number) => void>();
  completeReviewOnSubmit({ server, exit });
  base = (await listenLoopback(server)).url;

  route = (url, init) => realFetch(url, init);
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) =>
    route(new URL(String(input), base), init)
  );
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

function closeIsGuarded(): boolean {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

async function mountWithUnsavedWork() {
  const view = render(<App capability={CAPABILITY} />);
  await view.findByTestId('finish-review-btn', {}, { timeout: 10_000 });
  await waitFor(() => expect(closeIsGuarded()).toBe(true), { timeout: 10_000 });
  return view;
}

it('keeps the adapter alive through StrictMode effect replay', async () => {
  const view = render(
    <React.StrictMode>
      <App capability={CAPABILITY} />
    </React.StrictMode>
  );
  await view.findByTestId('finish-review-btn', {}, { timeout: 2_000 });
  await waitFor(() => expect(closeIsGuarded()).toBe(true));
  expect(view.getByText('Needs a test.')).toBeTruthy();
  fireEvent.click(view.getByTestId('finish-review-btn'));
  expect(await view.findByText('Review saved', {}, { timeout: 2_000 })).toBeTruthy();
});

describe('session capability', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('takes the key out of the fragment and erases it from the address bar', () => {
    window.history.replaceState(null, '', `/?x=1#cap=${CAPABILITY}`);

    expect(takeCapabilityFromLocation()).toBe(CAPABILITY);
    expect(window.location.hash).toBe('');
    expect(window.location.search).toBe('?x=1');
    expect(takeCapabilityFromLocation()).toBeNull();
  });

  it('returns null for a page opened without one', () => {
    window.history.replaceState(null, '', '/');
    expect(takeCapabilityFromLocation()).toBeNull();
    window.history.replaceState(null, '', '/#other=1');
    expect(takeCapabilityFromLocation()).toBeNull();
    expect(window.location.hash).toBe('');
  });

  it('shows the terminal-URL notice, and sends nothing, when the page has no key', async () => {
    const requests: string[] = [];
    route = url => {
      requests.push(url.pathname);
      return realFetch(url);
    };

    const view = render(<App capability={null} />);

    expect(await view.findByText('Open the URL printed in the terminal')).toBeTruthy();
    expect(view.getByTestId('capability-notice').textContent).toContain('#');
    expect(requests).toEqual([]);
  });

  it('shows the same notice, not a connection error, when the server refuses the key', async () => {
    const view = render(<App capability={`${CAPABILITY}-stale`} />);

    expect(await view.findByText('Open the URL printed in the terminal')).toBeTruthy();
    expect(view.queryByText('Could not reach the review server')).toBeNull();
  });
});

describe('serve client', () => {
  it('shows the connection notice, not a crash, when the config request fails', async () => {
    route = () => Promise.reject(new TypeError('Failed to fetch'));

    const view = render(<App capability={CAPABILITY} />);

    expect(await view.findByText('Could not reach the review server')).toBeTruthy();
    expect(view.getByText('Failed to fetch')).toBeTruthy();
  });

  it('keeps the close warning after deleting the final resumed comment', async () => {
    const view = await mountWithUnsavedWork();
    fireEvent.click(view.container.querySelector('[data-hint-action="delete-comment"]')!);
    await waitFor(() => expect(view.queryByText('Needs a test.')).toBeNull());
    expect(closeIsGuarded()).toBe(true);
  });

  it('protects viewed-only progress, including when the flag is cleared again', async () => {
    session.resumeComments = [];
    const view = render(<App capability={CAPABILITY} />);
    const toggle = await view.findByTestId('viewed-toggle-src/index.ts');
    expect(closeIsGuarded()).toBe(false);
    fireEvent.click(toggle);
    await waitFor(() => expect(closeIsGuarded()).toBe(true));
    fireEvent.click(toggle);
    expect(closeIsGuarded()).toBe(true);
  });

  it('blocks mutations and document shortcuts while submitting, then restores editing on refusal', async () => {
    let refuse!: (response: Response) => void;
    route = (url, init) =>
      url.pathname === '/api/review'
        ? new Promise(resolve => {
            refuse = resolve;
          })
        : realFetch(url, init);
    const view = await mountWithUnsavedWork();
    const remove = view.container.querySelector('[data-hint-action="delete-comment"]')!;
    fireEvent.click(view.getByTestId('finish-review-btn'));
    await waitFor(() => expect(refuse).toBeTypeOf('function'));
    expect(view.getByTestId('review-interaction').hasAttribute('inert')).toBe(true);
    fireEvent.click(remove);
    expect(view.getByText('Needs a test.')).toBeTruthy();
    const shortcut = vi.fn();
    document.addEventListener('keydown', shortcut);
    fireEvent.keyDown(document, { key: 'f' });
    document.removeEventListener('keydown', shortcut);
    expect(shortcut).not.toHaveBeenCalled();
    expect(closeIsGuarded()).toBe(true);

    refuse(
      new Response(
        JSON.stringify({ ok: false, code: 'refused', message: 'try again', details: [] }),
        { status: 422 }
      )
    );
    await view.findByTestId('submit-error');
    expect(view.getByTestId('review-interaction').hasAttribute('inert')).toBe(false);
    fireEvent.click(remove);
    await waitFor(() => expect(view.queryByText('Needs a test.')).toBeNull());
    expect(closeIsGuarded()).toBe(true);
  });

  it(
    'keeps the review and its close guard after a failed publication, and retries to success',
    async () => {
      // A directory at the output path makes the publisher refuse; removing it and resubmitting succeeds.
      fs.mkdirSync(outputPath);
      const view = await mountWithUnsavedWork();

      fireEvent.click(view.getByTestId('finish-review-btn'));

      const notice = await view.findByTestId('submit-error', {}, { timeout: 10_000 });
      expect(notice.textContent).toContain('output-is-directory');
      expect(notice.textContent).toContain('it is a directory');
      expect(notice.textContent).toMatch(/Finish Review again/);
      expect(closeIsGuarded()).toBe(true);
      expect(view.getByTestId('finish-review-btn')).toBeTruthy();
      expect(exit).not.toHaveBeenCalled();

      fs.rmdirSync(outputPath);
      fireEvent.click(view.getByTestId('finish-review-btn'));

      expect(await view.findByText('Review saved', {}, { timeout: 10_000 })).toBeTruthy();
      expect(fs.readFileSync(outputPath, 'utf-8')).toContain('Needs a test.');
      await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
      expect(closeIsGuarded()).toBe(false);
      const shortcut = vi.fn();
      document.addEventListener('keydown', shortcut);
      fireEvent.keyDown(document, { key: 'j' });
      document.removeEventListener('keydown', shortcut);
      expect(shortcut).toHaveBeenCalledTimes(1);
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

it('keeps an unknown save guarded until the reviewer explicitly confirms a retry is safe', async () => {
  const view = await mountWithUnsavedWork();
  let submissions = 0;
  route = async (url, init) => {
    if (url.pathname === '/api/review') {
      submissions++;
      throw new TypeError('connection closed after sending');
    }
    return realFetch(url, init);
  };
  fireEvent.click(view.getByTestId('finish-review-btn'));
  const notice = await view.findByTestId('submit-error');
  expect(notice.textContent).toContain('save outcome is unknown');
  expect(notice.textContent).toContain('Check the terminal and the output file');
  expect(view.queryByTestId('finish-review-btn')).toBeNull();
  expect(view.getByText('Needs a test.')).toBeTruthy();
  expect(view.getByTestId('review-interaction').hasAttribute('inert')).toBe(true);
  expect(closeIsGuarded()).toBe(true);
  expect(submissions).toBe(1);
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  try {
    fireEvent.click(view.getByRole('button', { name: 'Allow retry after checking output' }));
    expect(view.queryByTestId('finish-review-btn')).toBeNull();
    expect(submissions).toBe(1);
    confirm.mockReturnValue(true);
    fireEvent.click(view.getByRole('button', { name: 'Allow retry after checking output' }));
    expect(view.getByTestId('finish-review-btn')).toBeTruthy();
    expect(view.getByText('Needs a test.')).toBeTruthy();
    expect(closeIsGuarded()).toBe(true);
    expect(submissions).toBe(1);
    route = (url, init) => {
      if (url.pathname === '/api/review') submissions++;
      return realFetch(url, init);
    };
    fireEvent.click(view.getByTestId('finish-review-btn'));
    expect(await view.findByText('Review saved', {}, { timeout: 10_000 })).toBeTruthy();
    expect(submissions).toBe(2);
    expect(fs.existsSync(outputPath)).toBe(true);
  } finally {
    confirm.mockRestore();
  }
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => {
    resolve = yes;
  });
  return { promise, resolve };
}

it.each(['populated', 'empty', 'null'] as const)(
  'refuses early publication until a slow %s resume is acknowledged',
  async kind => {
    const resume = deferred<Response>();
    let resumeRequested = false;
    let submissions = 0;
    let submitted: unknown;
    route = (url, init) => {
      if (url.pathname === '/api/resume') {
        resumeRequested = true;
        return resume.promise;
      }
      if (url.pathname === '/api/review') {
        submissions++;
        submitted = JSON.parse(String(init?.body));
      }
      return realFetch(url, init);
    };
    const view = render(<App capability={CAPABILITY} />);
    const finish = await view.findByTestId('finish-review-btn');
    await waitFor(() => expect(resumeRequested).toBe(true));
    fireEvent.click(finish);
    expect(submissions).toBe(0);
    expect(view.getByTestId('submit-error').textContent).toContain('loading');
    expect(fs.existsSync(outputPath)).toBe(false);
    fireEvent.click(view.getByTestId('viewed-toggle-src/index.ts'));
    const response =
      kind === 'null'
        ? null
        : { comments: kind === 'populated' ? session.resumeComments : [], viewedFiles: [] };
    await act(async () =>
      resume.resolve(
        new Response(JSON.stringify(response), { headers: { 'content-type': 'application/json' } })
      )
    );
    fireEvent.click(finish);
    expect(await view.findByText('Review saved', {}, { timeout: 10_000 })).toBeTruthy();
    expect(submissions).toBe(1);
    expect(submitted).toMatchObject({
      files: [{ viewed: true, comments: kind === 'populated' ? [{ body: 'Needs a test.' }] : [] }],
    });
    expect(fs.readFileSync(outputPath, 'utf8').includes('Needs a test.')).toBe(
      kind === 'populated'
    );
  }
);

it('keeps resume failure and its pending retry unsaveable, then publishes all recovered feedback', async () => {
  const retry = deferred<Response>();
  let attempts = 0;
  let submissions = 0;
  route = (url, init) => {
    if (url.pathname === '/api/resume') {
      attempts++;
      return attempts === 1
        ? Promise.resolve(
            new Response(JSON.stringify({ error: 'feedback offline' }), { status: 503 })
          )
        : retry.promise;
    }
    if (url.pathname === '/api/review') submissions++;
    return realFetch(url, init);
  };
  const view = render(<App capability={CAPABILITY} />);
  const finish = await view.findByTestId('finish-review-btn');
  await view.findByText(/Saved feedback could not be loaded/);
  fireEvent.click(finish);
  expect(submissions).toBe(0);
  fireEvent.click(view.getByRole('button', { name: 'Retry loading saved feedback' }));
  fireEvent.click(finish);
  expect(submissions).toBe(0);
  expect(attempts).toBe(2);
  await act(async () =>
    retry.resolve(
      new Response(JSON.stringify({ comments: session.resumeComments, viewedFiles: [] }))
    )
  );
  expect(await view.findByText('Needs a test.')).toBeTruthy();
  fireEvent.click(finish);
  expect(await view.findByText('Review saved', {}, { timeout: 10_000 })).toBeTruthy();
  expect(fs.readFileSync(outputPath, 'utf8')).toContain('Needs a test.');
  expect(submissions).toBe(1);
});

it(
  'protects draft-only tab close and refuses Finish before publication until the draft is cancelled',
  async () => {
    session.resumeComments = [];
    let submissions = 0;
    let resumeDone!: () => void;
    const resumed = new Promise<void>(resolve => {
      resumeDone = resolve;
    });
    route = (url, init) => {
      if (url.pathname === '/api/review') submissions++;
      return realFetch(url, init).then(async response => {
        if (url.pathname === '/api/resume') {
          await response.clone().arrayBuffer();
          resumeDone();
        }
        return response;
      });
    };
    const view = render(<App capability={CAPABILITY} />);
    await view.findByTestId('add-file-comment-src/index.ts', {}, { timeout: 10_000 });
    await act(async () => {
      await resumed;
    });
    expect(closeIsGuarded()).toBe(false);
    fireEvent.click(view.getByTestId('add-file-comment-src/index.ts'));
    fireEvent.change(view.getByTestId('comment-input').querySelector('textarea')!, {
      target: { value: 'Unsubmitted text' },
    });
    await waitFor(() => expect(closeIsGuarded()).toBe(true));
    fireEvent.click(view.getByTestId('finish-review-btn'));
    await waitFor(() =>
      expect(view.getByTestId('submit-error').textContent).toContain(
        'Finish or cancel unfinished drafts'
      )
    );
    expect(submissions).toBe(0);
    expect(fs.existsSync(outputPath)).toBe(false);
    expect(exit).not.toHaveBeenCalled();
    expect(view.getByDisplayValue('Unsubmitted text')).toBeTruthy();
    fireEvent.click(view.getByTestId('cancel-comment-btn'));
    fireEvent.click(view.getByTestId('finish-review-btn'));
    await view.findByText('Review saved');
    expect(fs.existsSync(outputPath)).toBe(true);
  },
  CASE_TIMEOUT_MS
);
