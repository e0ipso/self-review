import React, { Profiler, useContext } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { DiffFile, GuideLoadPayload } from '@self-review/types';
import GuideChapterDivider from './DiffViewer/GuideChapterDivider';
import GuideRouteHud from './GuideRouteHud';
import { ReviewProvider, useReview, type ReviewContextValue } from '../context/ReviewContext';
import { ReviewContext, SessionStoreContext } from '../context/review-context';
import type { ReviewSessionStore } from '../context/review-session';
import { ConfigProvider } from '../context/ConfigContext';
import { DiffNavigationProvider, useDiffNavigationContext } from '../context/DiffNavigationContext';
import { GuideProvider, useGuide } from '../context/GuideContext';
import { getGuideAccent } from '../utils/guide-accents';
import { installBrowserApiStubs } from '../test-helpers';

installBrowserApiStubs();
afterEach(cleanup);

const diff: DiffFile[] = [
  { oldPath: 'old', newPath: 'shared', changeType: 'renamed', hunks: [], isBinary: false },
  { oldPath: 'shared', newPath: '', changeType: 'deleted', hunks: [], isBinary: false },
];
const guide: GuideLoadPayload = {
  groups: [
    { name: 'Chapter', implicit: false, files: [{ path: 'shared' }] },
    { name: 'Empty', implicit: false, files: [] },
  ],
};
const chapterProps = {
  header: { name: 'Chapter', implicit: false },
  index: 0,
  totalStops: 2,
  implicitLast: false,
  entries: diff.map(file => ({ file })),
};

function fixture() {
  let review!: ReviewContextValue;
  let store!: ReviewSessionStore;
  let navigation!: ReturnType<typeof useDiffNavigationContext>;
  let guideState!: ReturnType<typeof useGuide>;
  function Capture() {
    review = useReview();
    store = useContext(SessionStoreContext)!;
    navigation = useDiffNavigationContext();
    guideState = useGuide();
    return null;
  }
  const chapterRenders = vi.fn();
  const hudRenders = vi.fn();
  const view = render(
    <ConfigProvider>
      <GuideProvider initialGuide={guide}>
        <DiffNavigationProvider>
          <ReviewProvider
            initialFiles={diff}
            initialSource={{ type: 'directory', sourcePath: '/a' }}
          >
            <Capture />
            <Profiler id='chapter' onRender={chapterRenders}>
              <GuideChapterDivider {...chapterProps} />
            </Profiler>
            <Profiler id='hud' onRender={hudRenders}>
              <GuideRouteHud />
            </Profiler>
          </ReviewProvider>
        </DiffNavigationProvider>
      </GuideProvider>
    </ConfigProvider>
  );
  return {
    ...view,
    review: () => review,
    store: () => store,
    navigation: () => navigation,
    guide: () => guideState,
    chapterRenders,
    hudRenders,
  };
}

it('does not render guide progress on comment or reply changes and updates on viewed changes', () => {
  const f = fixture();
  const before = [f.chapterRenders.mock.calls.length, f.hudRenders.mock.calls.length];
  act(() => f.review().addComment('shared', null, 'original', 'note', null));
  const id = f.review().files[0].comments[0].id;
  act(() => f.review().editComment(id, { body: 'edited' }));
  act(() => f.review().addReply(id, 'reply'));
  act(() => f.review().deleteComment(id));
  expect([f.chapterRenders.mock.calls.length, f.hudRenders.mock.calls.length]).toEqual(before);
  act(() => f.review().toggleViewed('shared'));
  expect(screen.getByText('2/2 reviewed', { exact: false })).toBeTruthy();
  expect(f.chapterRenders.mock.calls.length).toBeGreaterThan(before[0]);
  expect(f.hudRenders.mock.calls.length).toBeGreaterThan(before[1]);
});

it('uses the first duplicate for chapter counts and any viewed duplicate for HUD completion', () => {
  const f = fixture();
  act(() =>
    f.store().dispatch({
      type: 'files',
      update: files => [files[0], { ...files[1], viewed: true }],
    })
  );
  expect(screen.getByText('0/2 reviewed', { exact: false })).toBeTruthy();
  const stop = screen.getByRole('button', { name: 'Go to stop 1: Chapter' });
  expect(stop.firstElementChild?.className).toContain(getGuideAccent(0).dotSoft);
  const empty = screen.getByRole('button', { name: 'Go to stop 2: Empty' });
  expect(empty.firstElementChild?.className).toContain(getGuideAccent(1).dotFaint);
  const hudCount = f.hudRenders.mock.calls.length;
  act(() => f.store().dispatch({ type: 'files', update: files => [...files].reverse() }));
  expect(screen.getByText('2/2 reviewed', { exact: false })).toBeTruthy();
  expect(f.hudRenders).toHaveBeenCalledTimes(hudCount);
  act(() =>
    f.store().dispatch({
      type: 'payload',
      payload: { files: [], source: { type: 'directory', sourcePath: '/b' } },
    })
  );
  expect(screen.getByText('0/2 reviewed', { exact: false })).toBeTruthy();
  // A logical source replacement drops the old walkthrough as well as its viewed flags.
  expect(screen.queryByTestId('guide-route-hud')).toBeNull();
});

it('keeps ordered stops, empty-stop controls, routing and the flat toggle', () => {
  const f = fixture();
  const target = document.createElement('section');
  target.scrollIntoView = vi.fn();
  act(() => f.navigation().registerFileElement('shared', target));
  const stops = screen.getAllByRole('button', { name: /Go to stop/ });
  expect(stops.map(stop => stop.getAttribute('aria-label'))).toEqual([
    'Go to stop 1: Chapter',
    'Go to stop 2: Empty',
  ]);
  fireEvent.click(stops[0]);
  expect(target.scrollIntoView).toHaveBeenCalledOnce();
  fireEvent.click(stops[1]);
  expect(target.scrollIntoView).toHaveBeenCalledOnce();
  act(() => f.guide().setMode('flat'));
  expect(screen.queryByTestId('guide-route-hud')).toBeNull();
  act(() => f.guide().setMode('guided'));
  expect(screen.getByTestId('guide-route-hud')).toBeTruthy();
});

it('supports context-only legacy guide compositions with the same duplicate rules', () => {
  const f = fixture();
  const review = f.review();
  f.unmount();
  const files = [review.files[0], { ...review.files[1], viewed: true }];
  const tree = (value: ReviewContextValue) => (
    <ConfigProvider>
      <GuideProvider initialGuide={guide}>
        <DiffNavigationProvider>
          <ReviewContext.Provider value={value}>
            <GuideChapterDivider {...chapterProps} />
            <GuideRouteHud />
          </ReviewContext.Provider>
        </DiffNavigationProvider>
      </GuideProvider>
    </ConfigProvider>
  );
  const view = render(tree({ ...review, files }));
  expect(screen.getByText('0/2 reviewed', { exact: false })).toBeTruthy();
  expect(
    screen.getByRole('button', { name: 'Go to stop 1: Chapter' }).firstElementChild?.className
  ).toContain(getGuideAccent(0).dotSoft);
  view.rerender(tree({ ...review, files: [...files].reverse() }));
  expect(screen.getByText('2/2 reviewed', { exact: false })).toBeTruthy();
});
