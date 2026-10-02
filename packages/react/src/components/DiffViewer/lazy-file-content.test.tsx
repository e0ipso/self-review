import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { DiffFile, DiffHunk, DiffLoadPayload, DiffSource } from '@self-review/types';
import type { ReviewAdapter } from '../../adapter';

import { installBrowserApiStubs } from '../../test-helpers';

installBrowserApiStubs();

class NoopResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = NoopResizeObserver;

import { ReviewPanel } from '../../ReviewPanel';

// Large-payload lazy loading through the whole review stack with a fake adapter.

const SOURCE: DiffSource = { type: 'git', gitDiffArgs: '', repository: '/repo' };

function unloaded(filePath: string): DiffFile {
  return {
    oldPath: filePath,
    newPath: filePath,
    changeType: 'modified',
    isBinary: false,
    hunks: [],
    contentLoaded: false,
  };
}

function hunksWith(content: string): DiffHunk[] {
  return [
    {
      header: '@@ -1,1 +1,1 @@',
      oldStart: 1,
      oldLines: 1,
      newStart: 1,
      newLines: 1,
      lines: [{ type: 'context', oldLineNumber: 1, newLineNumber: 1, content }],
    },
  ];
}

function largePayload(paths: string[], source: DiffSource = SOURCE): DiffLoadPayload {
  return { files: paths.map(unloaded), source, isLargePayload: true };
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Let pending promise callbacks and the effects they trigger run. */
async function settle() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 20));
  });
}

async function renderReview(adapter: ReviewAdapter, firstPath: string) {
  const view = render(<ReviewPanel adapter={adapter} />);
  await screen.findByTestId(`file-section-${firstPath}`);
  await settle();
  return view;
}

function openFile(filePath: string) {
  fireEvent.click(screen.getByTestId(`file-header-${filePath}`));
}

function section(filePath: string) {
  return screen.getByTestId(`file-section-${filePath}`);
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe('large-payload mode initial expansion', () => {
  it('starts a line-count-triggered large review collapsed and fetches nothing', async () => {
    // Three files are far below the file-count threshold: only the payload flag says large.
    const paths = ['a.txt', 'b.txt', 'c.txt'];
    const loadFileContent = vi.fn(async () => hunksWith('loaded line'));
    const adapter: ReviewAdapter = {
      loadDiff: async () => largePayload(paths),
      loadFileContent,
    };

    await renderReview(adapter, 'a.txt');

    expect(loadFileContent).not.toHaveBeenCalled();
    for (const path of paths) {
      expect(within(section(path)).queryByText('loaded line')).toBeNull();
    }

    openFile('b.txt');

    await waitFor(() => expect(loadFileContent).toHaveBeenCalledTimes(1));
    expect(loadFileContent).toHaveBeenCalledWith('b.txt');
    await waitFor(() =>
      expect(within(section('b.txt')).getAllByText('loaded line').length).toBeGreaterThan(0)
    );
    await settle();
    expect(loadFileContent).toHaveBeenCalledTimes(1);
  });
});

describe('a failed lazy load', () => {
  it('asks once, then waits for Retry before asking again', async () => {
    const loadFileContent = vi.fn(() => Promise.reject(new Error('connection refused')));
    const adapter: ReviewAdapter = {
      loadDiff: async () => largePayload(['lazy.txt']),
      loadFileContent,
    };

    await renderReview(adapter, 'lazy.txt');
    openFile('lazy.txt');

    await waitFor(() => expect(loadFileContent).toHaveBeenCalledTimes(1));
    const retry = await within(section('lazy.txt')).findByRole('button', { name: 'Retry' });
    const message = within(section('lazy.txt')).getByRole('alert').textContent ?? '';
    expect(message).toContain('connection refused');
    expect(message).toMatch(/retry/i);

    await settle();
    await settle();
    expect(loadFileContent).toHaveBeenCalledTimes(1);

    fireEvent.click(retry);

    await waitFor(() => expect(loadFileContent).toHaveBeenCalledTimes(2));
    await within(section('lazy.txt')).findByRole('button', { name: 'Retry' });
    await settle();
    expect(loadFileContent).toHaveBeenCalledTimes(2);
  });

  it('treats a host that answers with no content as a failure, not as loaded', async () => {
    const loadFileContent = vi.fn(async () => null);
    const adapter: ReviewAdapter = {
      loadDiff: async () => largePayload(['gone.txt']),
      loadFileContent,
    };

    await renderReview(adapter, 'gone.txt');
    openFile('gone.txt');

    await within(section('gone.txt')).findByRole('button', { name: 'Retry' });
    await settle();
    expect(loadFileContent).toHaveBeenCalledTimes(1);
  });
});

describe('a lazy load that outlives its request', () => {
  it('drops a result that arrives after the section unmounted', async () => {
    let push: ((payload: DiffLoadPayload) => void) | undefined;
    const first = deferred<DiffHunk[] | null>();
    const second = deferred<DiffHunk[] | null>();
    const loadFileContent = vi
      .fn<(filePath: string) => Promise<DiffHunk[] | null>>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const adapter: ReviewAdapter = {
      loadDiff: async () => largePayload(['keep.txt', 'lazy.txt']),
      loadFileContent,
      onDiffLoad: callback => {
        push = callback;
        return () => {
          push = undefined;
        };
      },
    };

    await renderReview(adapter, 'lazy.txt');
    openFile('lazy.txt');
    await waitFor(() => expect(loadFileContent).toHaveBeenCalledTimes(1));

    // Same session, file gone: its section unmounts with the request pending.
    act(() => push!(largePayload(['keep.txt'])));
    expect(screen.queryByTestId('file-section-lazy.txt')).toBeNull();

    // The file comes back. Its expansion is remembered for the session, so
    // the new section asks for itself straight away.
    act(() => push!(largePayload(['keep.txt', 'lazy.txt'])));
    await waitFor(() => expect(loadFileContent).toHaveBeenCalledTimes(2));

    await act(async () => second.resolve(hunksWith('fresh line')));
    await waitFor(() =>
      expect(within(section('lazy.txt')).getAllByText('fresh line').length).toBeGreaterThan(0)
    );

    await act(async () => first.resolve(hunksWith('stale line')));
    await settle();

    expect(within(section('lazy.txt')).queryByText('stale line')).toBeNull();
    expect(within(section('lazy.txt')).getAllByText('fresh line').length).toBeGreaterThan(0);
  });

  it('ignores the old session once the review is replaced, and loads the new one', async () => {
    let push: ((payload: DiffLoadPayload) => void) | undefined;
    const old = deferred<DiffHunk[] | null>();
    const replacement = deferred<DiffHunk[] | null>();
    const loadFileContent = vi
      .fn<(filePath: string) => Promise<DiffHunk[] | null>>()
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(replacement.promise);
    const adapter: ReviewAdapter = {
      loadDiff: async () => largePayload(['shared.txt']),
      loadFileContent,
      onDiffLoad: callback => {
        push = callback;
        return () => {
          push = undefined;
        };
      },
    };

    await renderReview(adapter, 'shared.txt');
    openFile('shared.txt');
    await waitFor(() => expect(loadFileContent).toHaveBeenCalledTimes(1));

    // A different source is a new session holding a file at the same path.
    act(() =>
      push!(largePayload(['shared.txt'], { type: 'git', gitDiffArgs: 'main', repository: '/b' }))
    );
    await settle();

    // The new session starts from its own payload mode: collapsed, nothing asked.
    expect(within(section('shared.txt')).queryByText('Loading file content...')).toBeNull();
    expect(loadFileContent).toHaveBeenCalledTimes(1);

    // Opened, it asks for itself without waiting on the old request.
    openFile('shared.txt');
    await waitFor(() => expect(loadFileContent).toHaveBeenCalledTimes(2));

    // The old session's failure arrives late and must not surface.
    await act(async () => old.reject(new Error('old session went away')));
    await settle();
    expect(within(section('shared.txt')).queryByRole('button', { name: 'Retry' })).toBeNull();

    await act(async () => replacement.resolve(hunksWith('new session line')));
    await waitFor(() =>
      expect(within(section('shared.txt')).getAllByText('new session line').length).toBeGreaterThan(
        0
      )
    );
    expect(loadFileContent).toHaveBeenCalledTimes(2);
  });
});
