import React from 'react';
import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import Prism from 'prismjs';
import { installBrowserApiStubs } from '../../test-helpers';
installBrowserApiStubs();
import type { DiffFile } from '@self-review/types';
import { ConfigProvider } from '../../context/ConfigContext';
import { ReviewProvider } from '../../context/ReviewContext';
import SyntaxLine from './SyntaxLine';
import UnifiedView from './UnifiedView';
import SplitView from './SplitView';
import { MarkdownCode } from './MarkdownCode';
import { HIGHLIGHT_MAX_LINE_CHARS, HIGHLIGHT_MAX_FILE_LINES } from './highlight-budget';

it('keeps long lines and fences literal without passing them to Prism', () => {
  const highlight = vi.spyOn(Prism, 'highlight');
  const text = '<img src=x onerror=alert(1)>' + 'x'.repeat(HIGHLIGHT_MAX_LINE_CHARS);
  const { container } = render(
    <>
      <SyntaxLine content={text} language='typescript' lineType='context' />
      <MarkdownCode className='language-javascript'>{text}</MarkdownCode>
    </>
  );
  expect(highlight).not.toHaveBeenCalled();
  expect(container.querySelector('img')).toBeNull();
  expect(container.querySelectorAll('code')[0].textContent).toBe(text);
  expect(container.querySelectorAll('code')[1].textContent).toBe(text);
});

it.each(['unified', 'split'] as const)(
  'bounds %s highlighting while retaining every source anchor and gutter',
  mode => {
    const highlight = vi.spyOn(Prism, 'highlight');
    const count = HIGHLIGHT_MAX_FILE_LINES + 5;
    const file: DiffFile = {
      oldPath: 'a.ts',
      newPath: 'a.ts',
      changeType: 'modified',
      isBinary: false,
      hunks: [
        {
          header: '@@ -1,1005 +1,1005 @@',
          oldStart: 1,
          newStart: 1,
          oldLines: count,
          newLines: count,
          lines: Array.from({ length: count }, (_, i) => ({
            type: 'context',
            oldLineNumber: i + 1,
            newLineNumber: i + 1,
            content: i === count - 1 ? '<script>literal last line</script>' : `const a${i} = 1;`,
          })),
        },
      ],
    };
    const View = mode === 'split' ? SplitView : UnifiedView;
    const { container } = render(
      <ConfigProvider>
        <ReviewProvider initialFiles={[file]}>
          <View
            file={file}
            commentRange={null}
            dragState={null}
            onDragStart={vi.fn()}
            onCancelComment={vi.fn()}
            onCommentSaved={vi.fn()}
          />
        </ReviewProvider>
      </ConfigProvider>
    );
    expect(highlight.mock.calls.length).toBeLessThanOrEqual(
      HIGHLIGHT_MAX_FILE_LINES * (mode === 'split' ? 2 : 1)
    );
    expect(container.querySelector('[role=status]')?.textContent).toContain(
      'All source lines remain available'
    );
    expect(
      container.querySelector(`[data-line-number="${count}"][data-line-side="new"]`)?.textContent
    ).toContain('literal last line');
    expect(screen.getByTestId(`comment-icon-new-${count}`).getAttribute('aria-label')).toBe(
      `Comment on new line ${count.toLocaleString('en')}`
    );
    expect(container.querySelectorAll('script')).toHaveLength(0);
    expect(container.querySelectorAll('code').length).toBe(count * (mode === 'split' ? 2 : 1));
  },
  15000
);
