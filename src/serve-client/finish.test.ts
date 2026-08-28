// Tests for the finish control's submit flow.
//
// This is the one path in the browser client that is neither the library's
// code nor a single fetch: it reads the panel's imperative handle, submits,
// and has to report a failed write rather than telling the reviewer their
// review was saved when it was not.

import { describe, it, expect, vi } from 'vitest';
import type { ReviewState } from '../shared/types';
import { finishReview } from './finish';

const state: ReviewState = {
  timestamp: '2026-01-01T00:00:00.000Z',
  source: { type: 'git', gitDiffArgs: '--staged' },
  files: [],
};

describe('finishReview', () => {
  it('submits the state the handle reports and says it was saved', async () => {
    const submitReview = vi.fn(() => Promise.resolve());

    const status = await finishReview(
      { getReviewState: () => state },
      { loadDiff: () => Promise.reject(new Error('unused')), submitReview }
    );

    expect(submitReview).toHaveBeenCalledWith(state);
    expect(status).toEqual({ kind: 'saved' });
  });

  it('reports the failure message rather than claiming the review was saved', async () => {
    const status = await finishReview(
      { getReviewState: () => state },
      {
        loadDiff: () => Promise.reject(new Error('unused')),
        submitReview: () => Promise.reject(new Error('Failed to save the review: disk full')),
      }
    );

    expect(status).toEqual({
      kind: 'error',
      message: 'Failed to save the review: disk full',
    });
  });

  it('reports an error when the panel has not mounted yet', async () => {
    const submitReview = vi.fn(() => Promise.resolve());

    const status = await finishReview(null, {
      loadDiff: () => Promise.reject(new Error('unused')),
      submitReview,
    });

    expect(submitReview).not.toHaveBeenCalled();
    expect(status.kind).toBe('error');
  });
});
