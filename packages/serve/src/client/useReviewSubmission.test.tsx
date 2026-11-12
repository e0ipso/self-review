// @vitest-environment jsdom
import React, { createRef } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import {
  ConfigProvider,
  ReviewProvider,
  useReview,
  type ReviewPanelHandle,
  type ReviewContextValue,
  type ReviewState,
} from '@self-review/react';
import { useReviewBridge } from '../../../react/src/hooks/useReviewBridge';
import { installBrowserApiStubs } from '../../../react/src/test-helpers';
import { SubmissionSession, useReviewSubmission } from './useReviewSubmission';
import { ServeRequestError } from './request-error';

installBrowserApiStubs();
afterEach(cleanup);
function deferred() {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const files = [
  { oldPath: 'a', newPath: 'a', changeType: 'modified' as const, isBinary: false, hunks: [] },
];
function fixture() {
  const first = deferred();
  const second = deferred();
  const publishReview = vi
    .fn<(_: ReviewState) => Promise<void>>()
    .mockImplementationOnce(() => first.promise)
    .mockImplementationOnce(() => second.promise);
  const adapter = { loadDiff: vi.fn(), publishReview, dispose: vi.fn() };
  const handle = createRef<ReviewPanelHandle>();
  let review!: ReviewContextValue;
  let finish!: () => Promise<void>;
  function Probe() {
    review = useReview();
    useReviewBridge(handle);
    return null;
  }
  function Host({ source }: { source: string }) {
    const submission = useReviewSubmission(handle, adapter);
    finish = submission.finish;
    return (
      <>
        <output>{submission.status}</output>
        <ConfigProvider>
          <ReviewProvider
            initialFiles={files}
            initialSource={{ type: 'directory', sourcePath: source }}
          >
            <SubmissionSession onChange={submission.sessionChanged} />
            <Probe />
          </ReviewProvider>
        </ConfigProvider>
      </>
    );
  }
  const view = render(<Host source='/first' />);
  return {
    first,
    second,
    publishReview,
    review: () => review,
    finish: () => finish(),
    replace: () => view.rerender(<Host source='/next' />),
  };
}

it('captures current store mutations before a React render and reserves them until a known refusal', async () => {
  const f = fixture();
  act(() => {
    f.review().toggleViewed('a');
    void f.finish();
    f.review().addComment('a', null, 'blocked', 'note', null);
  });
  expect(f.publishReview.mock.calls[0][0].files[0]).toMatchObject({ viewed: true, comments: [] });
  expect(f.review().files[0].comments).toEqual([]);
  await act(async () => f.first.reject(new ServeRequestError('no write', { status: 422 })));
  expect(screen.getByText('failed')).toBeTruthy();
  act(() => f.review().addComment('a', null, 'after refusal', 'note', null));
  expect(f.review().files[0].comments[0].body).toBe('after refusal');
});

it('keeps unknown publication locked against direct mutations and never replays it', async () => {
  const f = fixture();
  act(() => {
    void f.finish();
  });
  await act(async () => f.first.reject(new Error('lost acknowledgement')));
  expect(screen.getByText('uncertain')).toBeTruthy();
  act(() => {
    f.review().toggleViewed('a');
    void f.finish();
  });
  expect(f.review().files[0].viewed).toBe(false);
  expect(f.publishReview).toHaveBeenCalledTimes(1);
});

it.each(['resolve', 'reject'] as const)(
  'ignores an old publication %s after replacement and protects the next save',
  async outcome => {
    const f = fixture();
    act(() => {
      void f.finish();
    });
    f.replace();
    expect(screen.getByText('reviewing')).toBeTruthy();
    act(() => {
      f.review().toggleViewed('a');
      void f.finish();
    });
    await act(async () =>
      outcome === 'resolve'
        ? f.first.resolve()
        : f.first.reject(new ServeRequestError('old refusal', { status: 422 }))
    );
    expect(screen.getByText('submitting')).toBeTruthy();
    act(() => f.review().toggleViewed('a'));
    expect(f.review().files[0].viewed).toBe(true);
    expect(f.publishReview).toHaveBeenCalledTimes(2);
    await act(async () => f.second.resolve());
    expect(screen.getByText('submitted')).toBeTruthy();
    act(() => f.review().toggleViewed('a'));
    expect(f.review().files[0].viewed).toBe(true);
  }
);
