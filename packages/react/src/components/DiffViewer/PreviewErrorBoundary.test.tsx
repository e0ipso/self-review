import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { DiffFile } from '@self-review/types';
import type { ReviewAdapter } from '../../adapter';

import { installBrowserApiStubs } from '../../test-helpers';

installBrowserApiStubs();

class NoopResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = NoopResizeObserver;

// The rendered Markdown preview stands in for any preview that throws while
// rendering (a parser bug, hostile input, a third-party renderer failing).
vi.mock('./RenderedMarkdownView', () => ({
  default: () => {
    throw new Error('preview exploded');
  },
}));

import PreviewErrorBoundary from './PreviewErrorBoundary';
import { ReviewPanel } from '../../ReviewPanel';
import Toolbar from '../Toolbar';

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // React and the boundary both report the caught error on stderr.
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

function Thrower({ fail }: { fail: boolean }) {
  if (fail) throw new Error('boom');
  return <div data-testid='healthy-child'>fine</div>;
}

describe('PreviewErrorBoundary', () => {
  it('renders its children when nothing throws', () => {
    render(
      <PreviewErrorBoundary filePath='a.ts' resetKeys={[]}>
        <Thrower fail={false} />
      </PreviewErrorBoundary>
    );

    expect(screen.getByTestId('healthy-child')).toBeTruthy();
  });

  it('contains a render error and names the file it came from', () => {
    render(
      <PreviewErrorBoundary filePath='src/"odd".ts' resetKeys={[]}>
        <Thrower fail={true} />
      </PreviewErrorBoundary>
    );

    const fallback = screen.getByRole('alert');
    expect(fallback.textContent).toContain('src/"odd".ts');
    expect(fallback.textContent).toContain('boom');
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining(JSON.stringify('src/"odd".ts')),
      expect.any(Error),
      expect.anything()
    );
  });

  it('resets when one of its reset keys changes', () => {
    const { rerender } = render(
      <PreviewErrorBoundary filePath='a.ts' resetKeys={['v1']}>
        <Thrower fail={true} />
      </PreviewErrorBoundary>
    );
    expect(screen.getByRole('alert')).toBeTruthy();

    // Same keys: the fallback stays even though the child would now succeed.
    rerender(
      <PreviewErrorBoundary filePath='a.ts' resetKeys={['v1']}>
        <Thrower fail={false} />
      </PreviewErrorBoundary>
    );
    expect(screen.getByRole('alert')).toBeTruthy();

    rerender(
      <PreviewErrorBoundary filePath='a.ts' resetKeys={['v2']}>
        <Thrower fail={false} />
      </PreviewErrorBoundary>
    );
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByTestId('healthy-child')).toBeTruthy();
  });
});

describe('a throwing file preview inside the review', () => {
  const BROKEN = 'docs/broken.md';
  const HEALTHY = 'src/healthy.ts';

  function addedMarkdown(filePath: string): DiffFile {
    return {
      oldPath: filePath,
      newPath: filePath,
      changeType: 'added',
      isBinary: false,
      hunks: [
        {
          header: '@@ -0,0 +1,1 @@',
          oldStart: 0,
          oldLines: 0,
          newStart: 1,
          newLines: 1,
          lines: [
            {
              type: 'addition',
              oldLineNumber: null,
              newLineNumber: 1,
              content: 'raw markdown line',
            },
          ],
        },
      ],
    };
  }

  function modified(filePath: string): DiffFile {
    return {
      oldPath: filePath,
      newPath: filePath,
      changeType: 'modified',
      isBinary: false,
      hunks: [
        {
          header: '@@ -1,1 +1,1 @@',
          oldStart: 1,
          oldLines: 1,
          newStart: 1,
          newLines: 1,
          lines: [
            { type: 'deletion', oldLineNumber: 1, newLineNumber: null, content: 'old body' },
            { type: 'addition', oldLineNumber: null, newLineNumber: 1, content: 'healthy body' },
          ],
        },
      ],
    };
  }

  const adapter: ReviewAdapter = {
    loadDiff: async () => ({
      files: [addedMarkdown(BROKEN), modified(HEALTHY)],
      source: { type: 'git', gitDiffArgs: '', repository: '/repo' },
    }),
  };

  const scrollIntoView = vi.fn();

  beforeEach(() => {
    scrollIntoView.mockClear();
    Element.prototype.scrollIntoView = scrollIntoView;
  });

  afterEach(() => {
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });

  async function renderReview(onFinishReview: () => void) {
    render(
      <ReviewPanel adapter={adapter}>
        <Toolbar onFinishReview={onFinishReview} />
      </ReviewPanel>
    );
    await screen.findByTestId(`file-section-${HEALTHY}`);
    // findBy* can resolve between the commit that mounts the sections and
    // the passive effect that seeds DiffViewer's expanded state; flush it so
    // a header click toggles settled state.
    await act(async () => {});
  }

  it('keeps the other file, the file tree and Finish Review usable', async () => {
    const onFinishReview = vi.fn();
    await renderReview(onFinishReview);

    const broken = screen.getByTestId(`file-section-${BROKEN}`);
    expect(within(broken).getByRole('alert').textContent).toContain(BROKEN);

    const healthy = screen.getByTestId(`file-section-${HEALTHY}`);
    expect(within(healthy).getAllByText('healthy body').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByTestId(`file-entry-${HEALTHY}`));
    expect(scrollIntoView.mock.contexts[0]).toBe(healthy);

    fireEvent.click(screen.getByTestId(`viewed-${BROKEN}`));
    expect(screen.getByTestId(`viewed-${BROKEN}`).textContent).toContain('Done reviewing');

    fireEvent.click(screen.getByTestId('finish-review-btn'));
    expect(onFinishReview).toHaveBeenCalledTimes(1);
  });

  it('recovers when the reviewer switches the failed file to the raw view', async () => {
    await renderReview(vi.fn());

    const broken = screen.getByTestId(`file-section-${BROKEN}`);
    expect(within(broken).getByRole('alert')).toBeTruthy();

    fireEvent.click(within(broken).getByLabelText('Raw view'));

    expect(within(broken).queryByRole('alert')).toBeNull();
    expect(within(broken).getAllByText('raw markdown line').length).toBeGreaterThan(0);
  });
});
