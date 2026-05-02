import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import type { DiffFile } from '@self-review/types';
import type { ReviewAdapter } from './adapter';

// jsdom does not implement these browser APIs that the inner providers touch
// during their passive effects. Without the polyfills, the render call surfaces
// IntersectionObserver / matchMedia errors even though we only care about the
// adapter captured at the outer ReviewAdapterProvider.
class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds: ReadonlyArray<number> = [];
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] { return []; }
}
(globalThis as { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver =
  MockIntersectionObserver as unknown as typeof IntersectionObserver;

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

let capturedAdapter: ReviewAdapter | null = null;

vi.mock('./context/ReviewAdapterContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./context/ReviewAdapterContext')>();
  return {
    ...actual,
    ReviewAdapterProvider: ({
      adapter,
      children,
    }: {
      adapter: ReviewAdapter;
      children: React.ReactNode;
    }) => {
      capturedAdapter = adapter;
      return <>{children}</>;
    },
  };
});

vi.mock('./components/DiffViewer/FileSection', () => ({
  default: () => null,
}));

import { SingleFileReview } from './SingleFileReview';

const file: DiffFile = {
  oldPath: 'src/foo.ts',
  newPath: 'src/foo.ts',
  changeType: 'modified',
  isBinary: false,
  hunks: [],
};

describe('SingleFileReview adapter merge', () => {
  beforeEach(() => {
    capturedAdapter = null;
  });

  it('invokes consumer-supplied expandContext via the merged adapter', async () => {
    const expandContext = vi.fn().mockResolvedValue({ hunks: [], totalLines: 0 });

    render(<SingleFileReview file={file} adapter={{ expandContext }} />);

    expect(capturedAdapter).not.toBeNull();
    await capturedAdapter!.expandContext!({ filePath: 'src/foo.ts', contextLines: 5 });

    expect(expandContext).toHaveBeenCalledWith({
      filePath: 'src/foo.ts',
      contextLines: 5,
    });
  });

  it('ignores consumer-supplied loadDiff in favor of the internal one', async () => {
    const consumerLoadDiff = vi.fn().mockResolvedValue({ files: [], source: undefined });

    render(<SingleFileReview file={file} adapter={{ loadDiff: consumerLoadDiff }} />);

    expect(capturedAdapter).not.toBeNull();
    const result = await capturedAdapter!.loadDiff();

    expect(consumerLoadDiff).not.toHaveBeenCalled();
    expect(result.files).toHaveLength(1);
    expect(result.files[0]).toBe(file);
  });

  it('exposes only loadDiff when no adapter prop is supplied', () => {
    render(<SingleFileReview file={file} />);

    expect(capturedAdapter).not.toBeNull();
    expect(typeof capturedAdapter!.loadDiff).toBe('function');
    expect(capturedAdapter!.expandContext).toBeUndefined();
    expect(capturedAdapter!.loadFileContent).toBeUndefined();
    expect(capturedAdapter!.loadImage).toBeUndefined();
    expect(capturedAdapter!.readAttachment).toBeUndefined();
    expect(capturedAdapter!.loadResumedComments).toBeUndefined();
    expect(capturedAdapter!.submitReview).toBeUndefined();
    expect(capturedAdapter!.changeOutputPath).toBeUndefined();
  });
});
