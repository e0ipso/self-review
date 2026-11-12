import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import RenderedImageView from './RenderedImageView';
import { ReviewAdapterProvider } from '../../context/ReviewAdapterContext';
import type { ReviewAdapter } from '../../adapter';

describe('RenderedImageView', () => {
  afterEach(() => cleanup());

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
});
