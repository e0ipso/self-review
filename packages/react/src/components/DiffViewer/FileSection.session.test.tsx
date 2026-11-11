import React from 'react';
import { it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { DiffFile, DiffLoadPayload } from '@self-review/types';
import { ReviewPanel } from '../../ReviewPanel';
import type { ReviewAdapter } from '../../adapter';
import { installBrowserApiStubs } from '../../test-helpers';
installBrowserApiStubs();
function file(path: string, image = false): DiffFile {
  return {
    oldPath: path,
    newPath: path,
    changeType: 'added',
    isBinary: image,
    hunks: image
      ? []
      : [
          {
            header: '@@ -0,0 +1 @@',
            oldStart: 0,
            oldLines: 0,
            newStart: 1,
            newLines: 1,
            lines: [{ type: 'addition', oldLineNumber: null, newLineNumber: 1, content: 'hello' }],
          },
        ],
  };
}
it('replaces same-path image and composer state when the review changes', async () => {
  let push!: (payload: DiffLoadPayload) => void;
  const files = [file('a.ts'), file('logo.png', true)];
  const loadImage = vi
    .fn()
    .mockResolvedValueOnce({ dataUri: 'data:image/png;base64,AAAA' })
    .mockResolvedValue({ dataUri: 'data:image/png;base64,BBBB' });
  const adapter: ReviewAdapter = {
    loadDiff: async () => ({ files, source: { type: 'directory', sourcePath: '/a' } }),
    onDiffLoad: cb => {
      push = cb;
      return () => {};
    },
    loadImage,
  };
  render(<ReviewPanel adapter={adapter} />);
  await waitFor(() =>
    expect(screen.getByAltText('logo.png').getAttribute('src')).toContain('AAAA')
  );
  fireEvent.click(screen.getByTestId('add-file-comment-a.ts'));
  const editor = screen.getByTestId('file-section-a.ts').querySelector('textarea')!;
  fireEvent.change(editor, { target: { value: 'unsaved old draft' } });
  act(() => push({ files: [...files], source: { type: 'directory', sourcePath: '/b' } }));
  await waitFor(() =>
    expect(screen.getByAltText('logo.png').getAttribute('src')).toContain('BBBB')
  );
  expect(screen.queryByDisplayValue('unsaved old draft')).toBeNull();
  expect(screen.queryByTestId('comment-input')).toBeNull();
});
