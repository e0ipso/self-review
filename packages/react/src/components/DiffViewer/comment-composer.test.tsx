import React from 'react';
import { it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { DiffFile } from '@self-review/types';
import { ConfigProvider } from '../../context/ConfigContext';
import { ReviewProvider } from '../../context/ReviewContext';
import FileSection from './FileSection';
import { installBrowserApiStubs } from '../../test-helpers';
installBrowserApiStubs();
const file: DiffFile = {
  oldPath: 'a.ts',
  newPath: 'a.ts',
  changeType: 'modified',
  isBinary: false,
  hunks: [
    {
      header: '@@ -1 +1 @@',
      oldStart: 1,
      oldLines: 1,
      newStart: 1,
      newLines: 1,
      lines: [{ type: 'context', oldLineNumber: 1, newLineNumber: 1, content: 'context' }],
    },
  ],
};
function Tree({ mode, collapsed = false }: { mode: 'split' | 'unified'; collapsed?: boolean }) {
  const [expanded, setExpanded] = React.useState(!collapsed);
  return (
    <ConfigProvider>
      <ReviewProvider initialFiles={[file]}>
        <FileSection
          file={file}
          viewMode={mode}
          expanded={expanded}
          onToggleExpanded={() => setExpanded(previous => !previous)}
        />
      </ReviewProvider>
    </ConfigProvider>
  );
}
it('opens and focuses the file composer when its section was collapsed', () => {
  render(<Tree mode='unified' collapsed />);
  fireEvent.click(screen.getByTestId('add-file-comment-a.ts'));
  const textarea = screen.getByTestId('comment-input').querySelector('textarea');
  expect(textarea).not.toBeNull();
  expect(document.activeElement).toBe(textarea);
});
it.each(['split', 'unified'] as const)(
  'opens an old-side context comment from the %s keyboard gutter',
  mode => {
    render(<Tree mode={mode} />);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Comment on old line 1' }), {
      key: 'Enter',
    });
    expect(screen.getAllByTestId('comment-input')).toHaveLength(1);
    expect(document.activeElement).toBe(
      screen.getByTestId('comment-input').querySelector('textarea')
    );
  }
);
