import React, { createRef } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import type { DiffFile, DiffSource } from '@self-review/types';
import { ConfigProvider } from './ConfigContext';
import { ReviewServicesProvider } from './ReviewServicesContext';
import {
  ReviewProvider,
  useReview,
  useReviewSaveTransaction,
  type ReviewContextValue,
  type ReviewSaveTransaction,
} from './ReviewContext';
import { useReviewBridge, type ReviewHandle } from '../hooks/useReviewBridge';
import { installBrowserApiStubs } from '../test-helpers';

installBrowserApiStubs();
afterEach(cleanup);

const files: DiffFile[] = [
  { oldPath: 'a', newPath: 'a', changeType: 'modified', isBinary: false, hunks: [] },
];
const source: DiffSource = { type: 'directory', sourcePath: '/review' };

function mount(now: () => Date) {
  const handle = createRef<ReviewHandle>();
  let save!: ReviewSaveTransaction;
  let review!: ReviewContextValue;
  function Probe() {
    save = useReviewSaveTransaction();
    review = useReview();
    useReviewBridge(handle);
    return null;
  }
  function Host({ now }: { now: () => Date }) {
    return (
      <ReviewServicesProvider services={{ now, createId: () => 'comment' }}>
        <ConfigProvider>
          <ReviewProvider initialFiles={files} initialSource={source}>
            <Probe />
          </ReviewProvider>
        </ConfigProvider>
      </ReviewServicesProvider>
    );
  }
  const view = render(<Host now={now} />);
  return {
    begin: () => save.begin(),
    capture: () => handle.current!.getReviewState(),
    review: () => review,
    setClock: (next: () => Date) => view.rerender(<Host now={next} />),
    save: () => save,
  };
}

it('uses the scoped current clock for snapshots and saves without replacing the review', () => {
  const first = '2024-02-03T04:05:06.000Z';
  const second = '2025-06-07T08:09:10.000Z';
  const f = mount(() => new Date(first));
  act(() => f.review().addComment('a', null, 'kept', 'note', null));
  const session = f.review().sessionId;
  const begin = f.save().begin;
  expect(f.capture().timestamp).toBe(first);
  const saved = begin();
  expect(saved.state.timestamp).toBe(first);
  saved.unlock();

  f.setClock(() => new Date(second));
  expect(f.capture().timestamp).toBe(second);
  const next = begin();
  expect(next.state.timestamp).toBe(second);
  expect(next.state.files[0].comments[0].body).toBe('kept');
  expect(f.review().sessionId).toBe(session);
  expect(next.current()).toBe(true);
});

it.each([
  () => new Date(NaN),
  () => {
    throw new Error('Clock unavailable');
  },
])('does not reserve a save after its clock fails', now => {
  const f = mount(now);
  expect(() => f.begin()).toThrow();
  f.setClock(() => new Date('2024-02-03T04:05:06.000Z'));
  act(() => f.review().toggleViewed('a'));
  const saved = f.begin();
  expect(saved.state.files[0].viewed).toBe(true);
  expect(saved.state.timestamp).toBe('2024-02-03T04:05:06.000Z');
});
