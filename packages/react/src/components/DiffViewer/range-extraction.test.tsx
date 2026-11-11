import React from 'react';
import { it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { DiffFile } from '@self-review/types';
import { ConfigProvider } from '../../context/ConfigContext';
import { ReviewProvider } from '../../context/ReviewContext';
import UnifiedView from './UnifiedView';
import SplitView from './SplitView';
import * as diffUtils from './diff-utils';
import { installBrowserApiStubs } from '../../test-helpers';
installBrowserApiStubs();
vi.mock('../Comments/CommentInput', () => ({ default: () => <div /> }));
it.each([UnifiedView, SplitView])(
  'extracts the selected range only once for a many-line view',
  View => {
    const file: DiffFile = {
      oldPath: 'a.ts',
      newPath: 'a.ts',
      changeType: 'modified',
      isBinary: false,
      hunks: [
        {
          header: '@@ -1,200 +1,200 @@',
          oldStart: 1,
          newStart: 1,
          oldLines: 200,
          newLines: 200,
          lines: Array.from({ length: 200 }, (_, index) => ({
            type: 'context',
            oldLineNumber: index + 1,
            newLineNumber: index + 1,
            content: `line ${index + 1}`,
          })),
        },
      ],
    };
    const extract = vi.spyOn(diffUtils, 'extractOriginalCode');
    render(
      <ConfigProvider>
        <ReviewProvider initialFiles={[file]}>
          <View
            file={file}
            commentRange={{ start: 10, end: 10, side: 'new' }}
            dragState={null}
            onDragStart={vi.fn()}
            onCancelComment={vi.fn()}
            onCommentSaved={vi.fn()}
          />
        </ReviewProvider>
      </ConfigProvider>
    );
    expect(extract).toHaveBeenCalledTimes(1);
  }
);
