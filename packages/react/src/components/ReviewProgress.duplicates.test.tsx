import React, { Profiler } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { DiffFile } from '@self-review/types';
import { ConfigProvider } from '../context/ConfigContext';
import { ReviewProvider, useReviewCommands } from '../context/ReviewContext';
import { TooltipProvider } from './ui/tooltip';
import { installBrowserApiStubs } from '../test-helpers';
import ReviewProgress from './ReviewProgress';

installBrowserApiStubs();
afterEach(cleanup);

const files: DiffFile[] = [
  { oldPath: 'old', newPath: 'shared', changeType: 'renamed', isBinary: false, hunks: [] },
  { oldPath: 'shared', newPath: '', changeType: 'deleted', isBinary: false, hunks: [] },
];

function fixture() {
  const onRender = vi.fn();
  function Actions() {
    const { toggleViewed, addReply } = useReviewCommands();
    return (
      <>
        <button onClick={() => toggleViewed('shared')}>Mark viewed</button>
        <button onClick={() => addReply('comment', 'reply')}>Reply</button>
      </>
    );
  }
  render(
    <ConfigProvider>
      <TooltipProvider>
        <ReviewProvider
          initialFiles={files}
          initialComments={[
            {
              id: 'comment',
              filePath: 'shared',
              body: 'kept',
              category: 'note',
              lineRange: null,
              suggestion: null,
            },
          ]}
        >
          <Actions />
          <Profiler id='progress' onRender={onRender}>
            <ReviewProgress />
          </Profiler>
        </ReviewProvider>
      </TooltipProvider>
    </ConfigProvider>
  );
  return onRender;
}

it('counts each viewed canonical entry when a rename and deletion share a display path', () => {
  fixture();
  fireEvent.click(screen.getByRole('button', { name: 'Mark viewed' }));
  const progress = screen.getByRole('progressbar', { name: 'Review progress' });
  expect(progress.getAttribute('aria-valuemax')).toBe('2');
  expect(progress.getAttribute('aria-valuenow')).toBe('2');
});

it('retains the original per-entry comment total for repeated paths', () => {
  fixture();
  expect(screen.getByTestId('review-stats').textContent).toBe('2');
});

it('does not rerender progress when a reply leaves per-entry totals unchanged', () => {
  const onRender = fixture();
  expect(onRender).toHaveBeenCalled();
  onRender.mockClear();
  fireEvent.click(screen.getByRole('button', { name: 'Mark viewed' }));
  expect(onRender).toHaveBeenCalled();
  onRender.mockClear();
  fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
  expect(onRender).not.toHaveBeenCalled();
});
