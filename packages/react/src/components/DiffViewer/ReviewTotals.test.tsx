import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { DiffFile } from '@self-review/types';
import { ConfigProvider } from '../../context/ConfigContext';
import { ReviewProvider, useReview, type ReviewContextValue } from '../../context/ReviewContext';
import { GuideProvider } from '../../context/GuideContext';
import { LocalizationProvider } from '../../localization/LocalizationContext';
import { SPANISH_REVIEW } from '../../../../../src/shared/spanish-review';
import Toolbar from '../Toolbar';
import GuideOverviewContent from './GuideOverviewContent';
import { installBrowserApiStubs } from '../../test-helpers';
installBrowserApiStubs();
const full: DiffFile = {
  oldPath: 'a',
  newPath: 'a',
  changeType: 'modified',
  isBinary: false,
  hunks: [
    {
      header: '@@',
      oldStart: 1,
      oldLines: 1,
      newStart: 1,
      newLines: 1,
      lines: [
        { type: 'addition', content: 'new', newLineNumber: 1, oldLineNumber: null },
        { type: 'deletion', content: 'old', oldLineNumber: 1, newLineNumber: null },
      ],
    },
  ],
};
function mount(files: DiffFile[], spanish = false) {
  let review!: ReviewContextValue;
  function Probe() {
    review = useReview();
    return null;
  }
  const guide = {
    overview: 'Orientation',
    groups: [{ name: 'Read', implicit: false, files: files.map(file => ({ path: file.newPath })) }],
  };
  const view = render(
    <LocalizationProvider locale={spanish ? 'es' : 'en'} messages={spanish ? SPANISH_REVIEW : {}}>
      <ConfigProvider>
        <ReviewProvider initialFiles={files}>
          <GuideProvider initialGuide={guide}>
            <Probe />
            <Toolbar />
            <div data-testid='overview'>
              <GuideOverviewContent />
            </div>
          </GuideProvider>
        </ReviewProvider>
      </ConfigProvider>
    </LocalizationProvider>
  );
  return { ...view, review: () => review };
}
function expectTotals(additions: string, deletions: string) {
  expect(screen.getByTestId('diff-stats').textContent).toContain(additions);
  expect(screen.getByTestId('diff-stats').textContent).toContain(`-${deletions}`);
  expect(screen.getByTestId('overview').textContent).toContain(additions);
  expect(screen.getByTestId('overview').textContent).toContain(`−${deletions}`);
}
it('suppresses incomplete totals through partial loads and restores them only after every text entry loads', () => {
  const pending = { ...full, newPath: 'b', oldPath: 'b', contentLoaded: false, hunks: [] };
  const view = mount([full, pending]);
  for (const id of ['diff-stats', 'overview']) {
    expect(screen.getByTestId(id).textContent).not.toContain('+1');
    expect(screen.getByTestId(id).textContent).toContain('Line totals unavailable');
  }
  expect(screen.getByTestId('diff-stats').textContent).toContain('2 files changed');
  expect(view.container.querySelector('[aria-busy="true"]')).toBeNull();
  act(() => view.review().updateFileHunks('b', full.hunks));
  expectTotals('+2', '2');
  expect(screen.queryByText('Line totals unavailable')).toBeNull();
});
it('keeps duplicate entries, binary files, empty legacy text and omitted content honest', () => {
  const view = mount([
    full,
    { ...full },
    { ...full, isBinary: true, contentLoaded: false, hunks: [] },
    { ...full, newPath: 'empty', oldPath: 'empty', hunks: [] },
  ]);
  expectTotals('+2', '2');
  expect(screen.getByTestId('diff-stats').textContent).toContain('4 files changed');
  act(() =>
    view.review().setDiffFiles([full, { ...full, omittedReason: 'Unreadable', hunks: [] }])
  );
  expect(screen.getByTestId('diff-stats').textContent).not.toContain('+1');
  expect(screen.getByTestId('overview').textContent).not.toContain('+1');
  expect(screen.getAllByText(/Line totals unavailable/)).toHaveLength(2);
});
it('formats complete totals by locale and does not rescan hunks on comment-only edits', () => {
  const lines = Array.from({ length: 12345 }, () => full.hunks[0].lines).flat();
  const hunks = vi.fn(() => [{ ...full.hunks[0], lines }]);
  const file = {
    ...full,
    get hunks() {
      return hunks();
    },
  };
  const view = mount([file], true);
  expectTotals('+12.345', '12.345');
  const before = hunks.mock.calls.length;
  act(() => view.review().addComment('a', null, 'body', 'note', null));
  const id = view.review().files[0].comments[0].id;
  act(() => view.review().editComment(id, { body: 'edited' }));
  expect(hunks).toHaveBeenCalledTimes(before);
});
it('localizes unavailable totals and treats an empty legacy payload as complete', () => {
  const view = mount([{ ...full, contentLoaded: false, hunks: [] }], true);
  expect(screen.getAllByText(/Totales de líneas no disponibles/)).toHaveLength(2);
  act(() => view.review().setDiffFiles([]));
  expect(screen.queryByText('Totales de líneas no disponibles')).toBeNull();
  expect(screen.getByTestId('diff-stats').textContent).toContain('0 archivos cambiados');
});
