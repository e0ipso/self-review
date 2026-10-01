import React, { createRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import type { DiffFile, ReviewState } from '@self-review/types';

import { installBrowserApiStubs } from './test-helpers';

installBrowserApiStubs();

// The real FileSection is not under test here: the probe acts on the file it
// is handed exactly the way the section header and gutter do, through the
// review context.
vi.mock('./components/DiffViewer/FileSection', async () => {
  const { useReview } = await import('./context/ReviewContext');
  return {
    default: ({ file }: { file: DiffFile }) => {
      const { addComment, toggleViewed } = useReview();
      const path = file.newPath || file.oldPath;
      return (
        <div>
          <span data-testid='visible-path'>{path}</span>
          <span data-testid='visible-hunks'>{file.hunks.length}</span>
          <button onClick={() => addComment(path, null, `on ${path}`, 'bug', null)}>comment</button>
          <button onClick={() => toggleViewed(path)}>viewed</button>
        </div>
      );
    },
  };
});

import { SingleFileReview, type SingleFileReviewHandle } from './SingleFileReview';

function diffFile(path: string, hunkCount = 0): DiffFile {
  return {
    oldPath: path,
    newPath: path,
    changeType: 'modified',
    isBinary: false,
    hunks: Array.from({ length: hunkCount }, () => ({
      header: '@@ -1 +1 @@',
      oldStart: 1,
      oldLines: 1,
      newStart: 1,
      newLines: 1,
      lines: [],
    })),
  };
}

function summary(state: ReviewState): string[] {
  return state.files.map(f => `${f.path}:${f.viewed}:${f.comments.map(c => c.body).join(',')}`);
}

function setup(file: DiffFile) {
  const ref = createRef<SingleFileReviewHandle>();
  const view = render(<SingleFileReview ref={ref} file={file} />);
  const exported = () => ref.current!.getReviewState();
  return { ref, view, exported };
}

describe('SingleFileReview session boundary', () => {
  it('starts a fresh session for the new file and applies actions to it', async () => {
    const { ref, view, exported } = setup(diffFile('a.ts'));
    await waitFor(() => expect(summary(exported())).toEqual(['a.ts:false:']));

    act(() => screen.getByText('comment').click());
    act(() => screen.getByText('viewed').click());
    expect(summary(exported())).toEqual(['a.ts:true:on a.ts']);

    view.rerender(<SingleFileReview ref={ref} file={diffFile('b.ts')} />);

    await waitFor(() => expect(summary(exported())).toEqual(['b.ts:false:']));
    expect(screen.getByTestId('visible-path').textContent).toBe('b.ts');
    expect(exported().source).toEqual({ type: 'file', sourcePath: 'b.ts' });

    act(() => screen.getByText('comment').click());
    act(() => screen.getByText('viewed').click());
    expect(summary(exported())).toEqual(['b.ts:true:on b.ts']);
  });

  it('keeps comments when the same file arrives as a new object', async () => {
    const { ref, view, exported } = setup(diffFile('a.ts'));
    await waitFor(() => expect(summary(exported())).toEqual(['a.ts:false:']));
    act(() => screen.getByText('comment').click());

    view.rerender(<SingleFileReview ref={ref} file={diffFile('a.ts', 2)} />);

    expect(screen.getByTestId('visible-hunks').textContent).toBe('2');
    expect(summary(exported())).toEqual(['a.ts:false:on a.ts']);
  });

  it('starts a fresh session when the source names a different review', async () => {
    const ref = createRef<SingleFileReviewHandle>();
    const file = diffFile('a.ts');
    const view = render(
      <SingleFileReview ref={ref} file={file} source={{ type: 'directory', sourcePath: '/one' }} />
    );
    await waitFor(() => expect(ref.current!.getReviewState().files).toHaveLength(1));
    act(() => screen.getByText('comment').click());

    view.rerender(
      <SingleFileReview ref={ref} file={file} source={{ type: 'directory', sourcePath: '/two' }} />
    );

    await waitFor(() =>
      expect(ref.current!.getReviewState().source).toEqual({
        type: 'directory',
        sourcePath: '/two',
      })
    );
    expect(summary(ref.current!.getReviewState())).toEqual(['a.ts:false:']);
  });
});
