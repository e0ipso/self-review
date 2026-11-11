import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReviewProvider, useReview } from './ReviewContext';
import { ConfigProvider } from './ConfigContext';
import { ReviewAdapterProvider } from './ReviewAdapterContext';
import { installBrowserApiStubs } from '../test-helpers';
installBrowserApiStubs();
import type { ReviewAdapter } from '../adapter';

function Probe() {
  return (
    <div data-testid='paths'>
      {useReview()
        .diffFiles.map(f => f.newPath)
        .join(',')}
    </div>
  );
}
function mount(adapter: ReviewAdapter) {
  return render(
    <ReviewAdapterProvider adapter={adapter}>
      <ConfigProvider>
        <ReviewProvider>
          <Probe />
        </ReviewProvider>
      </ConfigProvider>
    </ReviewAdapterProvider>
  );
}
const payload = {
  files: [
    { oldPath: 'a', newPath: 'a', changeType: 'modified' as const, isBinary: false, hunks: [] },
  ],
  source: { type: 'directory' as const, sourcePath: '/a' },
};

describe('recoverable host loading', () => {
  it('announces an initial error and retries explicitly', async () => {
    const loadDiff = vi
      .fn()
      .mockRejectedValueOnce(new Error('host offline'))
      .mockResolvedValue(payload);
    mount({ loadDiff });
    expect((await screen.findByRole('alert')).textContent).toContain('host offline');
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading review' }));
    await waitFor(() => expect(screen.getByTestId('paths').textContent).toBe('a'));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(loadDiff).toHaveBeenCalledTimes(2);
  });
  it('reports resume failure and retries it without reloading the diff', async () => {
    const loadDiff = vi.fn(async () => payload);
    const loadResumedReview = vi
      .fn()
      .mockRejectedValueOnce(new Error('saved feedback offline'))
      .mockResolvedValue({ comments: [] });
    mount({ loadDiff, loadResumedReview });
    expect((await screen.findByRole('alert')).textContent).toContain('saved feedback offline');
    expect(screen.getByTestId('paths').textContent).toBe('a');
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Retry loading saved feedback' }))
    );
    expect(screen.queryByRole('alert')).toBeNull();
    expect(loadDiff).toHaveBeenCalledTimes(1);
    expect(loadResumedReview).toHaveBeenCalledTimes(2);
  });
});
