import React, { createRef } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { ResumeLoadPayload } from '@self-review/types';
import { ReviewProviders } from './ReviewProviders';
import {
  useOptionalApplySession,
  useReview,
  type ReviewContextValue,
} from './context/ReviewContext';
import { useReviewBridge, type ReviewHandle } from './hooks/useReviewBridge';
import { installBrowserApiStubs } from './test-helpers';
installBrowserApiStubs();

const files = [
  { oldPath: 'a', newPath: 'a', changeType: 'added' as const, isBinary: false, hunks: [] },
];
const source = { type: 'directory' as const, sourcePath: '/a' };

it('composes static host content, bridge and narrow Apply subscriptions', async () => {
  let review!: ReviewContextValue;
  let applyRenders = 0;
  const ref = createRef<ReviewHandle>();
  const changed = vi.fn();
  function Apply() {
    useOptionalApplySession();
    applyRenders++;
    return null;
  }
  function Host() {
    review = useReview();
    useReviewBridge(ref, changed);
    return <span>Host welcome or review</span>;
  }
  const loadDiff = vi.fn();
  render(
    <ReviewProviders adapter={{ loadDiff }} initialFiles={files} initialSource={source}>
      <Apply />
      <Host />
    </ReviewProviders>
  );
  expect(screen.getByText('Host welcome or review')).toBeTruthy();
  expect(loadDiff).not.toHaveBeenCalled();
  const before = applyRenders;
  act(() => review.addComment('a', null, 'comment', 'bug', null));
  act(() => review.toggleViewed('a'));
  expect(applyRenders).toBe(before);
  expect(ref.current?.getReviewState().files[0].comments[0].body).toBe('comment');
  expect(changed).toHaveBeenCalledTimes(2);
  act(() => review.setApplyDestination('/chosen'));
  expect(applyRenders).toBe(before + 1);
  expect(changed).toHaveBeenCalledTimes(2);
});

it('keeps a pushed resume when the initial request resolves later and drops disposed pushes', async () => {
  let receive!: (payload: ResumeLoadPayload) => void;
  let finish!: (payload: ResumeLoadPayload) => void;
  const unsubscribe = vi.fn();
  let review!: ReviewContextValue;
  function Probe() {
    review = useReview();
    return null;
  }
  const mounted = render(
    <ReviewProviders
      adapter={{
        loadDiff: async () => ({ files, source }),
        loadResumedReview: () =>
          new Promise(resolve => {
            finish = resolve;
          }),
        onResumeLoad: callback => {
          receive = callback;
          return unsubscribe;
        },
      }}
    >
      <Probe />
    </ReviewProviders>
  );
  await waitFor(() => expect(finish).toBeTypeOf('function'));
  const comment = {
    id: 'pushed',
    filePath: 'a',
    lineRange: null,
    body: 'pushed',
    category: 'bug',
    suggestion: null,
  };
  act(() => receive({ comments: [comment], viewedFiles: [] }));
  await act(async () => finish({ comments: [], viewedFiles: [] }));
  expect(review.files[0].comments).toEqual([comment]);
  mounted.unmount();
  expect(unsubscribe).toHaveBeenCalledOnce();
  act(() => receive({ comments: [], viewedFiles: [] }));
});
