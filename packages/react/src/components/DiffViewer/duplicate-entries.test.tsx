import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { DiffFile } from '@self-review/types';
import { ReviewPanel } from '../../ReviewPanel';
import { useReview, type ReviewContextValue } from '../../context/ReviewContext';
import { installBrowserApiStubs } from '../../test-helpers';
installBrowserApiStubs();
afterEach(cleanup);
const file: DiffFile = {
  oldPath: 'same',
  newPath: 'same',
  changeType: 'modified',
  isBinary: false,
  hunks: [],
};
const files = [file, { ...file }];
it('renders duplicate entries without key collisions and preserves their live section state across updates', async () => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  let review!: ReviewContextValue;
  function Probe() {
    review = useReview();
    return null;
  }
  render(
    <ReviewPanel
      adapter={{
        loadDiff: async () => ({ files, source: { type: 'directory', sourcePath: '/review' } }),
      }}
    >
      <Probe />
    </ReviewPanel>
  );
  const sections = await screen.findAllByTestId('file-section-same');
  const entries = screen.getAllByTestId('file-entry-same');
  expect(sections).toHaveLength(2);
  expect(entries).toHaveLength(2);
  fireEvent.click(within(sections[1]).getByTestId('add-file-comment-same'));
  const composer = within(sections[1]).getByRole('textbox');
  fireEvent.change(composer, { target: { value: 'local draft' } });
  act(() => review.addComment('same', null, 'grouped feedback', 'note', null));
  expect(review.files.map(entry => entry.comments.length)).toEqual([1, 1]);
  expect(screen.getAllByTestId('file-section-same')).toEqual(sections);
  expect(within(sections[1]).getByRole('textbox')).toBe(composer);
  expect((composer as HTMLTextAreaElement).value).toBe('local draft');
  // An ordinary same-source payload must preserve both entries and the surviving draft.
  act(() => review.setDiffFiles(files.map(entry => ({ ...entry }))));
  expect(screen.getAllByTestId('file-section-same')).toEqual(sections);
  expect((within(sections[1]).getByRole('textbox') as HTMLTextAreaElement).value).toBe(
    'local draft'
  );
  act(() => review.toggleViewed('same'));
  expect(review.files.map(entry => entry.viewed)).toEqual([true, true]);
  expect(
    errors.mock.calls.filter(args =>
      args.some(arg => typeof arg === 'string' && /same key|unique.*key/i.test(arg))
    )
  ).toEqual([]);
});

it('keeps every duplicate section and tree entry visible in guided mode', async () => {
  render(
    <ReviewPanel
      adapter={{
        loadDiff: async () => ({ files, source: { type: 'directory', sourcePath: '/review' } }),
        onGuideLoad: receive => {
          receive({
            groups: [
              {
                name: 'Shared changes',
                implicit: false,
                files: [{ path: 'same', description: 'Inspect both entries' }],
              },
            ],
          });
          return () => {};
        },
      }}
    />
  );
  expect(await screen.findAllByTestId('file-section-same')).toHaveLength(2);
  expect(screen.getAllByTestId('file-entry-same')).toHaveLength(2);
  expect(screen.getByTestId('guide-group-Shared changes')).toBeTruthy();
});
