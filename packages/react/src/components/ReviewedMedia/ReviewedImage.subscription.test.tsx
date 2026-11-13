import React, { useLayoutEffect } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { DiffLoadPayload, ImageLoadResult } from '@self-review/types';
import { ReviewProviders } from '../../ReviewProviders';
import { ReviewAdapterProvider } from '../../context/ReviewAdapterContext';
import { ReviewContext } from '../../context/review-context';
import { useReview, type ReviewContextValue } from '../../context/ReviewContext';
import { ReviewedImage } from './ReviewedImage';
import { installBrowserApiStubs } from '../../test-helpers';
installBrowserApiStubs();
afterEach(cleanup);
const files = [
  {
    oldPath: 'pic.png',
    newPath: 'pic.png',
    changeType: 'added' as const,
    isBinary: true,
    hunks: [],
  },
];
const source = { type: 'directory' as const, sourcePath: '/review' };
const png = 'data:image/png;base64,AA==';

it('does no modern media render/read work on unrelated feedback, including a broad parent', async () => {
  let review!: ReviewContextValue;
  let capabilityReads = 0;
  const loadImage = vi.fn(async () => ({ dataUri: png }));
  const adapter = {
    loadDiff: vi.fn(),
    get loadImage() {
      capabilityReads++;
      return loadImage;
    },
  };
  function Parent() {
    review = useReview();
    return (
      <ReviewedImage
        alt='reviewed'
        data-reviewed-image-source='pic.png'
        node={{ type: 'element', tagName: 'img', properties: {}, children: [] }}
      />
    );
  }
  render(
    <ReviewProviders adapter={adapter} initialFiles={files} initialSource={source}>
      <Parent />
    </ReviewProviders>
  );
  await screen.findByRole('img');
  const before = capabilityReads;
  act(() => review.addComment('pic.png', null, 'unrelated feedback', 'bug', null));
  act(() => review.toggleViewed('pic.png'));
  expect(capabilityReads).toBe(before);
  expect(loadImage).toHaveBeenCalledOnce();
});

it('invalidates snapshot and file authorization during render and aborts owned reads', async () => {
  let push!: (payload: DiffLoadPayload) => void;
  const signals: AbortSignal[] = [];
  const finish: Array<(result: ImageLoadResult) => void> = [];
  const loadImage = vi.fn((_path: string, signal: AbortSignal) => {
    signals.push(signal);
    return new Promise<ImageLoadResult>(resolve => finish.push(resolve));
  });
  const adapter = {
    loadDiff: async () => ({ files, source }),
    onDiffLoad: (receive: typeof push) => {
      push = receive;
      return () => {};
    },
    reads: { loadImage },
  };
  let review!: ReviewContextValue;
  const seen: Array<string | null> = [];
  function Parent() {
    review = useReview();
    useLayoutEffect(() => {
      seen.push(document.querySelector('img')?.getAttribute('src') ?? null);
    });
    return <ReviewedImage alt='reviewed' data-reviewed-image-source='pic.png' />;
  }
  const view = render(
    <ReviewProviders adapter={adapter}>
      <Parent />
    </ReviewProviders>
  );
  await act(async () => {});
  await act(async () => finish[0]({ dataUri: png }));
  expect(screen.getByRole('img')).toBeTruthy();
  act(() => push({ files: [...files], source }));
  expect(seen.at(-1)).toBeNull();
  expect(signals[0].aborted).toBe(true);
  act(() => review.setDiffFiles([]));
  expect(signals[1].aborted).toBe(true);
  await act(async () => finish[1]({ dataUri: png }));
  expect(screen.queryByRole('img')).toBeNull();
  expect(loadImage).toHaveBeenCalledTimes(2);
  view.unmount();
});

it('supports context-only and provider-free media without changing hook order', async () => {
  let legacy!: ReviewContextValue;
  function Capture() {
    legacy = useReview();
    return null;
  }
  const mounted = render(
    <ReviewProviders adapter={{ loadDiff: vi.fn() }} initialFiles={files} initialSource={source}>
      <Capture />
    </ReviewProviders>
  );
  mounted.unmount();
  const loadImage = vi.fn(async () => ({ dataUri: png }));
  const adapter = { loadDiff: vi.fn(), loadImage };
  const tree = (value: ReviewContextValue | null) => (
    <ReviewAdapterProvider adapter={adapter}>
      <ReviewContext.Provider value={value}>
        <ReviewedImage alt='legacy' data-reviewed-image-source='pic.png' />
      </ReviewContext.Provider>
    </ReviewAdapterProvider>
  );
  const view = render(tree(legacy));
  expect((await screen.findByRole('img')).getAttribute('src')).toBe(png);
  view.rerender(tree({ ...legacy, diffFiles: [] }));
  expect(screen.queryByRole('img')).toBeNull();
  view.rerender(tree(null));
  expect(screen.getByRole('alert')).toBeTruthy();
  view.rerender(tree(legacy));
  expect((await screen.findByRole('img')).getAttribute('src')).toBe(png);
  expect(loadImage).toHaveBeenCalledTimes(2);
});
