import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import RenderedImageView from './RenderedImageView';
import { ReviewAdapterProvider } from '../../context/ReviewAdapterContext';
import type { ReviewAdapter } from '../../adapter';
import { LocalizationProvider } from '../../localization/LocalizationContext';

describe('RenderedImageView', () => {
  afterEach(() => cleanup());

  it('formats both decoded image dimensions in the selected locale', async () => {
    const onLoadImage = vi.fn(async () => ({ dataUri: 'data:image/png;base64,aW1hZ2U=' }));
    render(
      <LocalizationProvider locale='de-DE'>
        <RenderedImageView filePath='large.png' onLoadImage={onLoadImage} />
      </LocalizationProvider>
    );
    const image = await screen.findByRole('img');
    Object.defineProperties(image, {
      naturalWidth: { value: 12345 },
      naturalHeight: { value: 67890 },
    });
    fireEvent.load(image);
    expect(screen.getByText('12.345 × 67.890')).toBeTruthy();
    expect(onLoadImage).toHaveBeenCalledOnce();
  });

  it('uses the optional read path and aborts it on replacement and unmount', async () => {
    const signals: AbortSignal[] = [];
    const finish: Array<(value: { dataUri: string }) => void> = [];
    const legacy = vi.fn();
    const adapter: ReviewAdapter = {
      loadDiff: vi.fn(),
      loadImage: legacy,
      reads: {
        loadImage: (_path, signal) => {
          signals.push(signal);
          return new Promise(resolve => finish.push(resolve));
        },
      },
    };
    const child = (path: string) => (
      <ReviewAdapterProvider adapter={adapter}>
        <RenderedImageView filePath={path} onLoadImage={legacy} />
      </ReviewAdapterProvider>
    );
    const view = render(child('first.png'));
    expect(signals[0].aborted).toBe(false);
    view.rerender(child('second.png'));
    expect(signals[0].aborted).toBe(true);
    await act(async () => finish[0]({ dataUri: 'data:image/png;base64,b2xk' }));
    expect(screen.queryByRole('img')).toBeNull();
    await act(async () => finish[1]({ dataUri: 'data:image/png;base64,bmV3' }));
    expect(screen.getByRole('img').getAttribute('alt')).toBe('second.png');
    view.unmount();
    expect(signals[1].aborted).toBe(true);
    expect(legacy).not.toHaveBeenCalled();
  });

  it('settles a rejected image request into a visible error', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      const onLoadImage = vi.fn(() => Promise.reject(new Error('network down')));
      render(<RenderedImageView filePath='img/logo.png' onLoadImage={onLoadImage} />);

      expect(await screen.findByText('Failed to load image.')).toBeTruthy();
      expect(document.querySelector('.animate-spin')).toBeNull();
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('shows the error a resolved error result carries', async () => {
    const onLoadImage = vi.fn(async () => ({ error: 'Image too large' }));
    render(<RenderedImageView filePath='img/big.png' onLoadImage={onLoadImage} />);

    expect(await screen.findByText('Image too large')).toBeTruthy();
  });

  it.each([
    'https://outside.example/private.png',
    'http://outside.example/private.png',
    'file:///outside-private/not-reviewed.png',
    '/outside-private/not-reviewed.png',
    '../outside-private/not-reviewed.png',
    'javascript:alert(1)',
    'data:text/html;base64,PGgxPm5vdCBhbiBpbWFnZTwvaDE+',
    'data:image/png2;base64,bm90LWEtc3VwcG9ydGVkLWltYWdl',
  ])('rejects non-passive standalone image URL %s before mounting a resource', async dataUri => {
    const onLoadImage = vi.fn(async () => ({ dataUri }));
    const view = render(<RenderedImageView filePath='reviewed.png' onLoadImage={onLoadImage} />);
    await act(async () => {});
    expect(screen.getByRole('alert', { name: 'Image preview unavailable' })).toBeTruthy();
    expect(view.container.querySelector('img[src]')).toBeNull();
    expect(onLoadImage).toHaveBeenCalledOnce();
  });

  it.each([
    'data:image/png;base64,aW1hZ2U=',
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=',
    'blob:https://review.example/owned-image',
  ])('keeps passive standalone image URL %s', async dataUri => {
    const onLoadImage = vi.fn(async () => ({ dataUri }));
    render(<RenderedImageView filePath='reviewed.png' onLoadImage={onLoadImage} />);
    expect((await screen.findByRole('img')).getAttribute('src')).toBe(dataUri);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
