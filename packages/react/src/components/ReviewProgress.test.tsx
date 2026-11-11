import React from 'react';
import { it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ConfigProvider, useConfig } from '../context/ConfigContext';
import { ReviewProvider, useReview } from '../context/ReviewContext';
import ReviewProgress from './ReviewProgress';
import { installBrowserApiStubs } from '../test-helpers';
installBrowserApiStubs();
it('counts viewed files and comments over the visible paths when untracked files are hidden', () => {
  const files = ['tracked', 'untracked'].map(path => ({
    oldPath: path,
    newPath: path,
    changeType: 'added' as const,
    isBinary: false,
    hunks: [],
    isUntracked: path === 'untracked',
  }));
  function Controls() {
    const { toggleViewed } = useReview();
    const { updateConfig } = useConfig();
    return (
      <button
        onClick={() => {
          toggleViewed('tracked');
          toggleViewed('untracked');
          updateConfig({ showUntracked: false });
        }}
      >
        Hide
      </button>
    );
  }
  render(
    <ConfigProvider>
      <ReviewProvider initialFiles={files}>
        <Controls />
        <ReviewProgress />
      </ReviewProvider>
    </ConfigProvider>
  );
  fireEvent.click(screen.getByText('Hide'));
  expect(screen.getByTestId('review-progress').textContent).toBe('1/1');
  expect(
    screen.getByTestId('review-progress').querySelector('[style]')?.getAttribute('style')
  ).toContain('100%');
});
