import React, { useEffect } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ConfigProvider } from '../../packages/react/src/context/ConfigContext';
import { ReviewProvider, useReview } from '../../packages/react/src/context/ReviewContext';
import { ReviewAdapterProvider } from '../../packages/react/src/context/ReviewAdapterContext';
import { installBrowserApiStubs } from '../../packages/react/src/test-helpers';
import type { ReviewSaveResult, ReviewState, DiffLoadPayload } from '../shared/types';
import { SaveReviewBoundary, useSaveReview } from './useSaveReview';

installBrowserApiStubs();
const payload: DiffLoadPayload = {
  files: [{ oldPath: 'a.ts', newPath: 'a.ts', changeType: 'modified', isBinary: false, hunks: [] }],
  source: { type: 'directory', sourcePath: '/review' },
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function fixture() {
  const publication = deferred<ReviewSaveResult>();
  const saveReview = vi.fn((_state: ReviewState) => publication.promise);
  const acknowledgeReviewSave = vi.fn();
  const api = {
    submitReview: vi.fn(),
    saveAndQuit: vi.fn(),
    saveReview,
    acknowledgeReviewSave,
    getSaveResult: vi.fn(async () => ({ status: 'saved', receipt: 'disk-receipt' }) as const),
  };
  let directSave!: () => void;
  let directEdit!: () => void;
  let directComment!: (body: string) => void;
  const shortcut = vi.fn();
  function Controls() {
    const review = useReview();
    const save = useSaveReview(api);
    directSave = save;
    directEdit = () => review.toggleViewed('a.ts');
    directComment = body => review.addComment('a.ts', null, body, 'note', null);
    useEffect(() => {
      document.addEventListener('keydown', shortcut);
      return () => document.removeEventListener('keydown', shortcut);
    }, []);
    return (
      <>
        <button onClick={save}>Finish</button>
        <button onClick={() => review.toggleViewed('a.ts')}>Toggle viewed</button>
        <span>Comments: {review.files[0]?.comments.length ?? 0}</span>
        <output>{review.files[0]?.viewed ? 'Viewed' : 'Unviewed'}</output>
      </>
    );
  }
  const view = render(
    <ConfigProvider initialConfig={{}}>
      <ReviewProvider initialFiles={payload.files} initialSource={payload.source}>
        <SaveReviewBoundary api={api}>
          <Controls />
        </SaveReviewBoundary>
      </ReviewProvider>
    </ConfigProvider>
  );
  return {
    ...view,
    api,
    publication,
    shortcut,
    save: () => directSave(),
    edit: () => directEdit(),
    comment: (body: string) => directComment(body),
  };
}

it('freezes mutations and shortcuts immediately, deduplicates save, then restores editing after a known failure', async () => {
  const f = fixture();
  fireEvent.click(screen.getByText('Toggle viewed'));
  act(() => f.comment('Retain this comment'));
  fireEvent.click(screen.getByText('Finish'));
  expect(screen.getByTestId('desktop-review-interaction').hasAttribute('inert')).toBe(true);
  act(() => {
    f.save();
    f.edit();
    f.comment('Blocked during publication');
  });
  fireEvent.keyDown(document, { key: 'f' });
  fireEvent.click(screen.getByText('Toggle viewed'));
  expect(f.shortcut).not.toHaveBeenCalled();
  expect(screen.getByText('Viewed')).toBeTruthy();
  expect(f.api.saveReview).toHaveBeenCalledTimes(1);
  expect(f.api.saveReview.mock.calls[0][0].files[0].viewed).toBe(true);
  expect(f.api.saveReview.mock.calls[0][0].files[0].comments.map(comment => comment.body)).toEqual([
    'Retain this comment',
  ]);
  await act(async () =>
    f.publication.resolve({ status: 'failed', message: 'Disk full', detail: 'Free space' })
  );
  expect(screen.getByRole('alert').textContent).toContain('Disk full');
  expect(screen.getByTestId('desktop-review-interaction').hasAttribute('inert')).toBe(false);
  fireEvent.click(screen.getByText('Toggle viewed'));
  expect(screen.getByText('Unviewed')).toBeTruthy();
  expect(f.api.acknowledgeReviewSave).not.toHaveBeenCalled();
  act(() => f.comment('After recovery'));
  expect(screen.getByText('Comments: 2')).toBeTruthy();
});

it('receives publication before allowing shutdown and never retries a committed save with a lost reply', async () => {
  const f = fixture();
  fireEvent.click(screen.getByText('Finish'));
  // A faithful write boundary: the disk write committed; its reply disconnected.
  await act(async () =>
    f.publication.reject(Object.assign(new Error('lost reply'), { uncertain: true }))
  );
  expect(screen.getByText(/The save outcome is unknown/)).toBeTruthy();
  act(() => f.save());
  expect(f.api.saveReview).toHaveBeenCalledTimes(1);
  expect(f.api.acknowledgeReviewSave).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Check publication status'));
  await waitFor(() =>
    expect(f.api.acknowledgeReviewSave).toHaveBeenCalledExactlyOnceWith('disk-receipt')
  );
  expect(f.api.saveReview).toHaveBeenCalledTimes(1);
});

it('acknowledges a received receipt without unlocking the saved snapshot', async () => {
  const f = fixture();
  fireEvent.click(screen.getByText('Finish'));
  expect(f.api.acknowledgeReviewSave).not.toHaveBeenCalled();
  await act(async () => f.publication.resolve({ status: 'saved', receipt: 'published' }));
  expect(f.api.acknowledgeReviewSave).toHaveBeenCalledExactlyOnceWith('published');
  act(() => f.edit());
  expect(screen.getByText('Unviewed')).toBeTruthy();
});

it('drops an old publication reply when the review session is replaced', async () => {
  const publication = deferred<ReviewSaveResult>();
  const api = {
    submitReview: vi.fn(),
    saveAndQuit: vi.fn(),
    saveReview: () => publication.promise,
    acknowledgeReviewSave: vi.fn(),
  };
  let push!: (value: DiffLoadPayload) => void;
  const adapter = {
    loadDiff: async () => payload,
    onDiffLoad: (callback: typeof push) => {
      push = callback;
      return () => {};
    },
  };
  function Finish() {
    const save = useSaveReview(api);
    return <button onClick={save}>Finish</button>;
  }
  render(
    <ReviewAdapterProvider adapter={adapter}>
      <ConfigProvider initialConfig={{}}>
        <ReviewProvider>
          <SaveReviewBoundary api={api}>
            <Finish />
          </SaveReviewBoundary>
        </ReviewProvider>
      </ConfigProvider>
    </ReviewAdapterProvider>
  );
  await waitFor(() => expect(push).toBeTypeOf('function'));
  fireEvent.click(screen.getByText('Finish'));
  await act(async () => push({ ...payload, source: { type: 'directory', sourcePath: '/new' } }));
  await act(async () => publication.resolve({ status: 'saved', receipt: 'stale' }));
  expect(api.acknowledgeReviewSave).not.toHaveBeenCalled();
  expect(screen.getByTestId('desktop-review-interaction').hasAttribute('inert')).toBe(false);
});

it('hands one acknowledged snapshot to the host and freezes direct mutations before it answers', async () => {
  const publication = deferred<ReviewSaveResult>();
  const api = {
    submitReview: vi.fn(),
    saveAndQuit: vi.fn(),
    saveReview: vi.fn(() => publication.promise),
    acknowledgeReviewSave: vi.fn(),
  };
  let edit!: () => void;
  function Controls() {
    const review = useReview();
    const save = useSaveReview(api);
    edit = () => review.toggleViewed('a.ts');
    return (
      <>
        <button onClick={save}>Finish</button>
        <span>{review.files[0]?.viewed ? 'Viewed' : 'Unviewed'}</span>
      </>
    );
  }
  render(
    <ConfigProvider initialConfig={{}}>
      <ReviewProvider initialFiles={payload.files} initialSource={payload.source}>
        <Controls />
      </ReviewProvider>
    </ConfigProvider>
  );
  fireEvent.click(screen.getByText('Finish'));
  act(() => edit());
  expect(screen.getByText('Unviewed')).toBeTruthy();
  expect(api.saveReview).toHaveBeenCalledTimes(1);
  expect(api.submitReview).not.toHaveBeenCalled();
  await act(async () => publication.resolve({ status: 'saved', receipt: 'done' }));
});

it('keeps a legacy save visibly unacknowledged and restores editing on an explicit failure push', async () => {
  let failed!: () => void;
  const api = {
    submitReview: vi.fn(),
    saveAndQuit: vi.fn(),
    onSaveFailed: (callback: () => void) => {
      failed = callback;
      return () => {};
    },
  };
  function Finish() {
    const save = useSaveReview(api);
    return <button onClick={save}>Legacy finish</button>;
  }
  render(
    <ConfigProvider initialConfig={{}}>
      <ReviewProvider initialFiles={payload.files} initialSource={payload.source}>
        <SaveReviewBoundary api={api}>
          <Finish />
        </SaveReviewBoundary>
      </ReviewProvider>
    </ConfigProvider>
  );
  fireEvent.click(screen.getByText('Legacy finish'));
  expect(api.submitReview).toHaveBeenCalledTimes(1);
  expect(api.saveAndQuit).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/The save outcome is unknown/)).toBeTruthy();
  act(() => failed());
  expect(screen.getByTestId('desktop-review-interaction').hasAttribute('inert')).toBe(false);
});

it('refuses publication while the current diff is still a loading placeholder', async () => {
  const resume = deferred<import('../shared/types').ResumeLoadPayload>();
  const api = {
    submitReview: vi.fn(),
    saveAndQuit: vi.fn(),
    saveReview: vi.fn(),
    acknowledgeReviewSave: vi.fn(),
  };
  const adapter = { loadDiff: async () => payload, loadResumedReview: () => resume.promise };
  function Finish() {
    const save = useSaveReview(api);
    return <button onClick={save}>Finish loading</button>;
  }
  render(
    <ReviewAdapterProvider adapter={adapter}>
      <ConfigProvider initialConfig={{}}>
        <ReviewProvider>
          <SaveReviewBoundary api={api}>
            <Finish />
          </SaveReviewBoundary>
        </ReviewProvider>
      </ConfigProvider>
    </ReviewAdapterProvider>
  );
  fireEvent.click(screen.getByText('Finish loading'));
  expect(api.saveReview).not.toHaveBeenCalled();
  expect(screen.getByRole('alert').textContent).toContain('still loading');
  expect(screen.getByTestId('desktop-review-interaction').hasAttribute('inert')).toBe(false);
  await act(async () => resume.resolve({ comments: [], viewedFiles: [] }));
});
