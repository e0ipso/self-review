import React from 'react';
import { expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReviewComment } from '@self-review/types';
import { FileSectionHeader, type FileSectionHeaderProps } from './FileSectionHeader';
import { installBrowserApiStubs } from '../../test-helpers';
installBrowserApiStubs();

// A required comments property is part of the existing deep-import contract.
const commentsRequired: FileSectionHeaderProps extends { comments: ReviewComment[] }
  ? true
  : false = true;

it('keeps required comment entities and every existing header action in the compatibility facade', () => {
  expect(commentsRequired).toBe(true);
  const onToggle = vi.fn();
  const onViewedToggle = vi.fn();
  const onAddFileComment = vi.fn();
  const onRenderViewModeChange = vi.fn();
  const comment: ReviewComment = {
    id: 'c',
    filePath: 'a.md',
    body: 'finding',
    category: 'bug',
    suggestion: null,
    lineRange: null,
  };
  render(
    <FileSectionHeader
      file={{ oldPath: '', newPath: 'a.md', changeType: 'added', hunks: [], isBinary: false }}
      filePath='a.md'
      expanded
      isViewed={false}
      isPreviewable
      renderViewMode='raw'
      bodyId='body'
      comments={[comment, { ...comment, id: 'c2' }]}
      onToggle={onToggle}
      onViewedToggle={onViewedToggle}
      onAddFileComment={onAddFileComment}
      onRenderViewModeChange={onRenderViewModeChange}
    />
  );
  expect(screen.getByText('2')).toBeTruthy();
  const disclosure = screen.getByRole('button', { name: 'Collapse a.md' });
  expect(disclosure.getAttribute('aria-controls')).toBe('body');
  fireEvent.click(disclosure);
  expect(onToggle).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByTestId('viewed-a.md'));
  expect(onViewedToggle).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByTestId('add-file-comment-a.md'));
  expect(onAddFileComment).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Rendered view' }));
  expect(onRenderViewModeChange).toHaveBeenCalledWith('rendered');
  expect(onToggle).toHaveBeenCalledTimes(1);
});
