import React from 'react';
import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { DiffFile } from '@self-review/types';
import { ConfigProvider } from '../../context/ConfigContext';
import { ReviewProvider } from '../../context/ReviewContext';
import { installBrowserApiStubs } from '../../test-helpers';
import * as slots from './InlineCommentSlot';
import UnifiedView from './UnifiedView';
import SplitView from './SplitView';

installBrowserApiStubs();

it.each([UnifiedView, SplitView])(
  'mounts feedback only where needed with all raw text immediately present',
  View => {
    const slot = vi.spyOn(slots, 'InlineCommentSlot');
    const count = 100;
    const file: DiffFile = {
      oldPath: 'source.txt',
      newPath: 'source.txt',
      changeType: 'modified',
      isBinary: false,
      hunks: [
        {
          header: '@@ -1,100 +1,100 @@',
          oldStart: 1,
          newStart: 1,
          oldLines: count,
          newLines: count,
          lines: Array.from({ length: count }, (_, i) => ({
            type: 'context',
            oldLineNumber: i + 1,
            newLineNumber: i + 1,
            content: `searchable source ${i + 1}`,
          })),
        },
      ],
    };
    const tree = (selected: boolean) => (
      <ConfigProvider>
        <ReviewProvider initialFiles={[file]}>
          <View
            file={file}
            commentRange={selected ? { start: 10, end: 10, side: 'new' } : null}
            dragState={null}
            onDragStart={vi.fn()}
            onCancelComment={vi.fn()}
            onCommentSaved={vi.fn()}
          />
        </ReviewProvider>
      </ConfigProvider>
    );
    const { container, rerender } = render(tree(false));
    const source = Array.from(container.querySelectorAll('code'));
    expect(source).toHaveLength(count * (View === SplitView ? 2 : 1));
    expect(source.at(-1)?.textContent).toBe('searchable source 100');
    expect(slot).not.toHaveBeenCalled();
    rerender(tree(true));
    expect(slot).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('comment-input')).toBeTruthy();
    expect(container.querySelector('code')).toBe(source[0]);
    expect(container.querySelectorAll('code')).toHaveLength(source.length);
  }
);
