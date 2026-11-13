import React, { StrictMode } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { DiffLoadPayload, ResumeLoadPayload } from '@self-review/types';
import type { ReviewAdapter } from '../adapter';
import { ReviewAdapterProvider } from './ReviewAdapterContext';
import { ConfigProvider } from './ConfigContext';
import {
  ReviewProvider,
  useReview,
  useReviewSaveTransaction,
  type ReviewContextValue,
  type ReviewSaveTransaction,
} from './ReviewContext';
import { installBrowserApiStubs } from '../test-helpers';
installBrowserApiStubs();
it('owns StrictMode initial reads, reserves resume readiness and cancels only the disposed connection', async () => {
  const pulls: { signal: AbortSignal; resolve: (payload: DiffLoadPayload) => void }[] = [];
  const resumes: { signal: AbortSignal; resolve: (payload: ResumeLoadPayload) => void }[] = [];
  const legacy = vi.fn();
  let review!: ReviewContextValue;
  let save!: ReviewSaveTransaction;
  const adapter: ReviewAdapter = {
    loadDiff: legacy,
    initialReads: {
      loadDiff: signal => new Promise(resolve => pulls.push({ signal, resolve })),
      loadResumedReview: signal => new Promise(resolve => resumes.push({ signal, resolve })),
    },
  };
  function Probe() {
    review = useReview();
    save = useReviewSaveTransaction();
    return null;
  }
  const view = render(
    <StrictMode>
      <ReviewAdapterProvider adapter={adapter}>
        <ConfigProvider>
          <ReviewProvider>
            <Probe />
          </ReviewProvider>
        </ConfigProvider>
      </ReviewAdapterProvider>
    </StrictMode>
  );
  expect(pulls).toHaveLength(2);
  expect(pulls[0].signal.aborted).toBe(true);
  expect(pulls[1].signal.aborted).toBe(false);
  const payload: DiffLoadPayload = {
    files: [
      { newPath: 'source', oldPath: 'source', isBinary: false, changeType: 'modified', hunks: [] },
    ],
    source: { type: 'directory', sourcePath: '/owned' },
  };
  await act(async () => pulls[1].resolve(payload));
  await waitFor(() => expect(resumes).toHaveLength(1));
  expect(review.diffSource).toEqual(payload.source);
  expect(() => save.begin()).toThrow('has not finished loading');
  await act(async () =>
    pulls[0].resolve({ files: [], source: { type: 'directory', sourcePath: '/obsolete' } })
  );
  expect(review.diffSource).toEqual(payload.source);
  await act(async () => resumes[0].resolve({ comments: [], viewedFiles: ['source'] }));
  expect(review.files[0].viewed).toBe(true);
  const captured = save.begin();
  expect(captured.state.files[0].viewed).toBe(true);
  captured.unlock();
  expect(legacy).not.toHaveBeenCalled();
  let retry!: Promise<void>;
  act(() => {
    retry = review.retryResume!();
  });
  expect(resumes).toHaveLength(2);
  view.unmount();
  expect(resumes[1].signal.aborted).toBe(true);
  await act(async () => resumes[1].resolve({ comments: [] }));
  await retry;
});
