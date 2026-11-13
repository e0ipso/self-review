import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { DiffFile, ReviewComment } from '@self-review/types';
import { ConfigProvider } from '../../context/ConfigContext';
import { ReviewProvider } from '../../context/ReviewContext';
import { installBrowserApiStubs } from '../../test-helpers';
import UnifiedView from './UnifiedView';
import SplitView from './SplitView';

installBrowserApiStubs();
const file: DiffFile = {
  oldPath: 'a.txt',
  newPath: 'a.txt',
  changeType: 'modified',
  isBinary: false,
  hunks: [
    {
      header: '@@ -5 +7 @@',
      oldStart: 5,
      newStart: 7,
      oldLines: 1,
      newLines: 1,
      lines: [{ type: 'context', oldLineNumber: 5, newLineNumber: 7, content: 'first source' }],
    },
    {
      header: '@@ -12 +14 @@',
      oldStart: 12,
      newStart: 14,
      oldLines: 1,
      newLines: 1,
      lines: [{ type: 'context', oldLineNumber: 12, newLineNumber: 14, content: 'last source' }],
    },
  ],
};
const comments: ReviewComment[] = [
  {
    id: 'old',
    filePath: 'a.txt',
    lineRange: { side: 'old', start: 5, end: 5 },
    body: 'Old thread',
    category: 'note',
    suggestion: null,
  },
  {
    id: 'new',
    filePath: 'a.txt',
    lineRange: { side: 'new', start: 7, end: 7 },
    body: 'New thread',
    category: 'note',
    suggestion: null,
  },
];
it.each([UnifiedView, SplitView])(
  'retains top, between and bottom expansion routing and side-specific feedback',
  View => {
    const expand = vi.fn();
    const drag = vi.fn();
    const { container } = render(
      <ConfigProvider>
        <ReviewProvider initialFiles={[file]} initialComments={comments}>
          <View
            file={file}
            commentRange={{ side: 'old', start: 12, end: 12 }}
            dragState={null}
            onDragStart={drag}
            onCancelComment={vi.fn()}
            onCommentSaved={vi.fn()}
            isExpandable
            onExpandContext={expand}
            totalLines={20}
          />
        </ReviewProvider>
      </ConfigProvider>
    );
    const bars = [...container.querySelectorAll<HTMLElement>('.expand-context-bar')];
    expect(bars).toHaveLength(3);
    bars.forEach(bar => fireEvent.click(within(bar).getByText('Show 6 hidden lines')));
    expect(expand.mock.calls).toEqual([
      ['all', 0, 'top'],
      ['all', 1, 'between'],
      ['all', 1, 'bottom'],
    ]);
    const renderedThreads = [
      ...container.querySelectorAll('[data-testid="comment-old"], [data-testid="comment-new"]'),
    ].map(node => node.getAttribute('data-testid'));
    expect(renderedThreads).toEqual(
      View === UnifiedView ? ['comment-new', 'comment-old'] : ['comment-old', 'comment-new']
    );
    expect(screen.getAllByTestId('comment-input')).toHaveLength(1);
    expect(screen.getByTestId('comment-input').textContent).toContain('Comment on line 12');
    fireEvent.keyDown(screen.getByRole('button', { name: 'Comment on old line 12' }), {
      key: 'Enter',
    });
    expect(drag).toHaveBeenCalledWith(View === UnifiedView ? 1 : 12, 'old', true);
    const source = [...container.querySelectorAll('code')].map(node => node.textContent);
    expect(source).toEqual(
      View === UnifiedView
        ? ['first source', 'last source']
        : ['first source', 'first source', 'last source', 'last source']
    );
  }
);
