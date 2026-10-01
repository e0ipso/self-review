import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import RenderedImageView from './RenderedImageView';

describe('RenderedImageView', () => {
  afterEach(() => cleanup());

  it('settles a rejected image request into a visible error', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      const onLoadImage = vi.fn(() => Promise.reject(new Error('network down')));
      render(<RenderedImageView filePath='img/logo.png' onLoadImage={onLoadImage} />);

      expect(await screen.findByText('Failed to load image.')).toBeTruthy();
      expect(document.querySelector('.animate-spin')).toBeNull();
      // Give an unhandled rejection a turn to surface before checking for one.
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
