import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { DiffFile, DiffHunk } from '@self-review/types';
import { SingleFileReview } from './SingleFileReview';
import { installBrowserApiStubs } from './test-helpers';
installBrowserApiStubs();
function hunk(content: string): DiffHunk {
  return {
    header: '@@ -3 +3 @@',
    oldStart: 3,
    newStart: 3,
    oldLines: 1,
    newLines: 1,
    lines: [{ type: 'context', oldLineNumber: 3, newLineNumber: 3, content }],
  };
}
function file(content: string): DiffFile {
  return {
    oldPath: 'a.ts',
    newPath: 'a.ts',
    changeType: 'modified',
    isBinary: false,
    hunks: [hunk(content)],
  };
}
describe('single file content ownership', () => {
  it('renders content returned by a lazy adapter', async () => {
    const loadFileContent = vi.fn(async () => [hunk('lazy result')]);
    render(
      <SingleFileReview
        file={{ ...file(''), hunks: [], contentLoaded: false }}
        adapter={{ loadFileContent }}
      />
    );
    expect(await screen.findByText('lazy result')).toBeTruthy();
    expect(loadFileContent).toHaveBeenCalledTimes(1);
  });
  it('expands from the current same-path prop snapshot', async () => {
    const expandContext = vi.fn(async () => ({ hunks: [hunk('expanded result')], totalLines: 20 }));
    const adapter = { expandContext };
    const source = { type: 'git' as const, repository: '/repo', gitDiffArgs: '' };
    const view = render(
      <SingleFileReview file={file('first')} source={source} adapter={adapter} />
    );
    await screen.findByText('first');
    view.rerender(
      <SingleFileReview file={file('replacement')} source={source} adapter={adapter} />
    );
    expect(await screen.findByText('replacement')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show 2 hidden lines' }));
    await waitFor(() => expect(screen.getByText('expanded result')).toBeTruthy());
  });
});
