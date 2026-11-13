import React, { useState } from 'react';
import { expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { DiffFile } from '@self-review/types';
import { ReviewProviders } from '../../ReviewProviders';
import { useReviewCommands } from '../../context/ReviewContext';
import { installBrowserApiStubs } from '../../test-helpers';
import FileSection from './FileSection';
import type { PreviewRenderer } from '../../services/preview-renderer';
installBrowserApiStubs();
function file(path = 'custom.widget', content = 'original'): DiffFile {
  return {
    oldPath: '',
    newPath: path,
    changeType: 'added',
    isBinary: false,
    hunks: [
      {
        header: '@@ -0,0 +1,1 @@',
        oldStart: 0,
        oldLines: 0,
        newStart: 1,
        newLines: 1,
        lines: [{ type: 'addition', oldLineNumber: null, newLineNumber: 1, content }],
      },
    ],
  };
}
const adapter = { loadDiff: vi.fn() };
const HostPreview: PreviewRenderer['component'] = ({ children, onCommentRange, commentRange }) => (
  <>
    <p data-testid='custom-preview'>
      {commentRange ? `${commentRange.start}-${commentRange.end}` : 'host preview'}
    </p>
    <button onClick={() => onCommentRange(1, 1, 'new')}>Select preview line</button>
    {children}
  </>
);

it('resolves a supplied renderer once for the section controls and content', () => {
  const source = file();
  const supports = vi.fn(() => true);
  render(
    <ReviewProviders
      adapter={adapter}
      initialFiles={[source]}
      previewRenderer={{ supports, component: HostPreview, defaultMode: 'rendered' }}
    >
      <FileSection file={source} viewMode='split' expanded />
    </ReviewProviders>
  );
  expect(screen.getByTestId('custom-preview').textContent).toBe('host preview');
  expect(screen.getByRole('button', { name: 'Rendered view' }).getAttribute('aria-pressed')).toBe(
    'true'
  );
  expect(supports).toHaveBeenCalledTimes(1);
});

it('resets preview mode on content changes while retaining section expansion and file drafts', async () => {
  const source = file('notes.md', '# Heading');
  const files = [source];
  function Fixture() {
    const [current, setCurrent] = useState(source);
    return (
      <>
        <button
          onClick={() =>
            setCurrent({
              ...current,
              hunks: current.hunks.map(hunk => ({ ...hunk, lines: [...hunk.lines] })),
            })
          }
        >
          Refresh metadata
        </button>
        <button onClick={() => setCurrent(file('notes.md', '# Changed'))}>Replace content</button>
        <FileSection file={current} viewMode='unified' />
      </>
    );
  }
  render(
    <ReviewProviders adapter={adapter} initialFiles={files}>
      <Fixture />
    </ReviewProviders>
  );
  expect(await screen.findByRole('heading', { name: /Heading/ })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Raw view' }));
  fireEvent.click(screen.getByTestId('add-file-comment-notes.md'));
  const editor = screen.getByPlaceholderText(
    'Add your review comment... (paste or drop images here)'
  ) as HTMLTextAreaElement;
  fireEvent.change(editor, { target: { value: 'Keep file draft' } });
  fireEvent.click(screen.getByText('Refresh metadata'));
  expect(screen.getByRole('button', { name: 'Raw view' }).getAttribute('aria-pressed')).toBe(
    'true'
  );
  fireEvent.click(screen.getByText('Replace content'));
  expect(await screen.findByRole('heading', { name: /Changed/ })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Collapse notes.md' })).toBeTruthy();
  expect(screen.getByDisplayValue('Keep file draft')).toBe(editor);
});

it('keeps raw and preview selections isolated across files, collapse and file comments', () => {
  const sources = [file('one.widget'), file('two.widget')];
  const renderer: PreviewRenderer = {
    supports: () => true,
    component: HostPreview,
    defaultMode: 'rendered',
  };
  function Controls() {
    const { addComment } = useReviewCommands();
    return (
      <button
        onClick={() =>
          addComment('one.widget', { start: 1, end: 1, side: 'new' }, 'Saved thread', 'note', null)
        }
      >
        Save thread externally
      </button>
    );
  }
  render(
    <ReviewProviders adapter={adapter} initialFiles={sources} previewRenderer={renderer}>
      <Controls />
      {sources.map(source => (
        <FileSection key={source.newPath} file={source} viewMode='unified' />
      ))}
    </ReviewProviders>
  );
  fireEvent.click(screen.getAllByText('Select preview line')[0]);
  expect(screen.getAllByTestId('custom-preview').map(el => el.textContent)).toEqual([
    '1-1',
    'host preview',
  ]);
  fireEvent.click(screen.getByRole('button', { name: 'Collapse one.widget' }));
  expect(screen.getAllByTestId('custom-preview').map(el => el.textContent)).toEqual([
    'host preview',
  ]);
  fireEvent.click(screen.getByRole('button', { name: 'Expand one.widget' }));
  expect(screen.getAllByTestId('custom-preview').map(el => el.textContent)).toEqual([
    '1-1',
    'host preview',
  ]);
  fireEvent.click(screen.getAllByRole('button', { name: 'Raw view' })[0]);
  const gutter = screen.getByTestId('comment-icon-new-1');
  fireEvent.keyDown(gutter, { key: 'Enter' });
  expect(
    screen.getByPlaceholderText('Add your review comment... (paste or drop images here)')
  ).toBeTruthy();
  fireEvent.click(screen.getByTestId('cancel-comment-btn'));
  expect(
    screen.queryByPlaceholderText('Add your review comment... (paste or drop images here)')
  ).toBeNull();
  fireEvent.click(screen.getByText('Save thread externally'));
  expect(screen.getByText('Saved thread')).toBeTruthy();
  fireEvent.click(screen.getAllByRole('button', { name: 'Rendered view' })[0]);
  expect(screen.getAllByTestId('custom-preview').map(el => el.textContent)).toEqual([
    'host preview',
    'host preview',
  ]);
});
