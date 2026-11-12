import React, { StrictMode, useLayoutEffect } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { DiffLoadPayload, ImageLoadResult } from '@self-review/types';
import { useReviewSource } from '../../context/ReviewContext';
import { ReviewProviders } from '../../ReviewProviders';
import { ReviewAdapterProvider } from '../../context/ReviewAdapterContext';
import { LocalizationProvider } from '../../localization/LocalizationContext';
import RenderedImageView from './RenderedImageView';
import { installBrowserApiStubs } from '../../test-helpers';
installBrowserApiStubs();
afterEach(cleanup);
const png = 'data:image/png;base64,AA==';
const nextPng = 'data:image/png;base64,AQ==';

it.each(['result', 'reject', 'throw', 'unsafe', 'decode'] as const)(
  'retries a %s failure only on explicit localized request',
  async failure => {
    let calls = 0;
    const loader = vi.fn((): Promise<ImageLoadResult> => {
      calls++;
      if (calls > 1 || failure === 'decode') return Promise.resolve({ dataUri: png });
      if (failure === 'throw') throw new Error('loader threw');
      if (failure === 'reject') return Promise.reject(new Error('loader rejected'));
      return Promise.resolve(
        failure === 'unsafe'
          ? { dataUri: 'https://example.com/private.png' }
          : { error: 'unavailable' }
      );
    });
    render(
      <LocalizationProvider locale='es' messages={{ Retry: 'Reintentar' }}>
        <RenderedImageView filePath='photo.png' onLoadImage={loader} />
      </LocalizationProvider>
    );
    if (failure === 'decode') fireEvent.error(await screen.findByRole('img'));
    const retry = await screen.findByRole('button', { name: 'Reintentar' });
    expect(screen.queryByRole('img')).toBeNull();
    await act(async () => {});
    expect(loader).toHaveBeenCalledOnce();
    fireEvent.click(retry);
    expect((await screen.findByRole('img')).getAttribute('src')).toBe(png);
    expect(loader).toHaveBeenCalledTimes(2);
  }
);

it('keeps unsupported hosts explanatory without offering a retry', async () => {
  render(<RenderedImageView filePath='photo.png' />);
  expect(await screen.findByText('Image loading not supported in this context.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
});

it('owns fresh retry reads and rejects late results after replacement or unmount', async () => {
  const signals: AbortSignal[] = [];
  const finish: Array<(result: ImageLoadResult) => void> = [];
  const loader = vi.fn((_path: string, signal: AbortSignal) => {
    signals.push(signal);
    return new Promise<ImageLoadResult>(resolve => finish.push(resolve));
  });
  const adapter = { loadDiff: vi.fn(), reads: { loadImage: loader } };
  const child = (filePath: string, host = adapter) => (
    <ReviewAdapterProvider adapter={host}>
      <RenderedImageView filePath={filePath} />
    </ReviewAdapterProvider>
  );
  const view = render(child('old.png'));
  await act(async () => finish[0]({ error: 'offline' }));
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(signals[0].aborted).toBe(true);
  expect(signals[1].aborted).toBe(false);
  view.rerender(child('new.png'));
  expect(signals[1].aborted).toBe(true);
  await act(async () => finish[1]({ dataUri: png }));
  expect(screen.queryByRole('img')).toBeNull();
  view.rerender(child('new.png', { ...adapter }));
  expect(signals[2].aborted).toBe(true);
  await act(async () => finish[2]({ dataUri: png }));
  expect(screen.queryByRole('img')).toBeNull();
  await act(async () => finish[3]({ dataUri: nextPng }));
  expect(screen.getByRole('img').getAttribute('src')).toBe(nextPng);
  view.rerender(child('last.png'));
  expect(signals[3].aborted).toBe(true);
  view.unmount();
  expect(signals[4].aborted).toBe(true);
  await act(async () => finish[4]({ dataUri: png }));
  expect(screen.queryByRole('img')).toBeNull();
});

it('removes the prior URL during replacement render before effects and rereads changed snapshots', async () => {
  const files = [
    {
      oldPath: 'photo.png',
      newPath: 'photo.png',
      changeType: 'added' as const,
      isBinary: true,
      hunks: [],
    },
  ];
  const source = { type: 'directory' as const, sourcePath: '/review' };
  const signals: AbortSignal[] = [];
  let push!: (payload: DiffLoadPayload) => void;
  const adapter = {
    loadDiff: async () => ({ files, source }),
    onDiffLoad: (receive: typeof push) => {
      push = receive;
      return () => {};
    },
    reads: {
      loadImage: vi.fn((_path: string, signal: AbortSignal) => {
        signals.push(signal);
        return signals.length === 1
          ? Promise.resolve({ dataUri: png })
          : new Promise<ImageLoadResult>(() => {});
      }),
    },
  };
  const seen: Array<string | null> = [];
  function Probe({ path }: { path: string }) {
    const source = useReviewSource();
    useLayoutEffect(() => {
      seen.push(document.querySelector('img')?.getAttribute('src') ?? null);
    });
    return source.type === 'loading' ? null : <RenderedImageView filePath={path} />;
  }
  const tree = (path: string) => (
    <ReviewProviders adapter={adapter}>
      <Probe path={path} />
    </ReviewProviders>
  );
  const view = render(tree('photo.png'));
  await screen.findByRole('img');
  view.rerender(tree('other.png'));
  expect(seen.at(-1)).toBeNull();
  expect(signals[0].aborted).toBe(true);
  act(() => push({ files: [...files], source }));
  expect(signals[1].aborted).toBe(true);
  expect(adapter.reads.loadImage).toHaveBeenCalledTimes(3);
  view.unmount();
  expect(signals[2].aborted).toBe(true);
});

it('can complete the active read under StrictMode effect replay', async () => {
  render(
    <StrictMode>
      <RenderedImageView filePath='photo.png' onLoadImage={async () => ({ dataUri: png })} />
    </StrictMode>
  );
  expect((await screen.findByRole('img')).getAttribute('src')).toBe(png);
});
