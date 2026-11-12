import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import type { DiffFile, ReviewComment } from '@self-review/types';
import type { ReviewAdapter } from '../../adapter';
import { ConfigProvider } from '../../context/ConfigContext';
import { ReviewProvider } from '../../context/ReviewContext';
import { ReviewAdapterProvider } from '../../context/ReviewAdapterContext';
import { GuideProvider } from '../../context/GuideContext';
import RenderedMarkdownView from './RenderedMarkdownView';
import GuideOverviewContent from './GuideOverviewContent';
import CommentDisplay from '../Comments/CommentDisplay';

const png = 'data:image/png;base64,AA==';
function file(path: string, content = ''): DiffFile {
  const lines = content.split('\n');
  return {
    oldPath: path,
    newPath: path,
    changeType: 'added',
    isBinary: path.endsWith('.png'),
    hunks: [
      {
        header: '@@ -0,0 +1 @@',
        oldStart: 0,
        oldLines: 0,
        newStart: 1,
        newLines: lines.length,
        lines: lines.map((content, i) => ({
          type: 'addition',
          content,
          newLineNumber: i + 1,
          oldLineNumber: null,
        })),
      },
    ],
  };
}
const noop = () => {};
const image = file('docs/pic.png');
const rootImage = file('pic.png');
const comment: ReviewComment = {
  id: 'thread',
  filePath: 'docs/note.md',
  category: 'bug',
  lineRange: null,
  suggestion: null,
  body: '![comment](pic.png)',
  replies: [{ id: 'reply', body: '![reply](pic.png)' }],
};
function wrapper(adapter: ReviewAdapter, files: DiffFile[], children: React.ReactNode) {
  return (
    <ConfigProvider initialConfig={{ theme: 'light' }}>
      <ReviewAdapterProvider adapter={adapter}>
        <ReviewProvider
          initialFiles={files}
          initialSource={{ type: 'directory', sourcePath: '/review' }}
        >
          <GuideProvider initialGuide={{ overview: '![guide](pic.png)', groups: [] }}>
            {children}
          </GuideProvider>
        </ReviewProvider>
      </ReviewAdapterProvider>
    </ConfigProvider>
  );
}
function preview(source: DiffFile, mode: 'markdown' | 'html') {
  return (
    <RenderedMarkdownView
      file={source}
      contentMode={mode}
      commentRange={null}
      onCancelComment={noop}
      onCommentSaved={noop}
      onGutterMouseDown={noop}
    />
  );
}
afterEach(cleanup);

describe('reviewed media on the rendered content surfaces', () => {
  it.each(['markdown', 'html', 'comment', 'guide'] as const)(
    'never mounts raw resources in %s and reads authorized image paths',
    async surface => {
      const loadImage = vi.fn(async () => ({ dataUri: png }));
      const adapter = { loadDiff: vi.fn(), loadImage };
      const source = file(
        'docs/note.md',
        surface === 'html'
          ? '<p>source<img src="pic.png" alt="html" title="caption" width="12" height="13"></p>'
          : '![markdown](pic.png "caption")'
      );
      const children =
        surface === 'comment' ? (
          <CommentDisplay comment={comment} />
        ) : surface === 'guide' ? (
          <GuideOverviewContent />
        ) : (
          preview(source, surface)
        );
      const { container } = render(wrapper(adapter, [source, image, rootImage], children));
      for (const img of container.querySelectorAll('img')) {
        expect(img.getAttribute('src')).not.toBe('pic.png');
      }
      await waitFor(() =>
        expect(loadImage).toHaveBeenCalledWith(surface === 'guide' ? 'pic.png' : 'docs/pic.png')
      );
      await waitFor(() => expect(container.querySelector('img')?.getAttribute('src')).toBe(png));
      expect(loadImage).toHaveBeenCalledTimes(surface === 'comment' ? 2 : 1);
      if (surface === 'html') {
        expect(container.querySelector('img')?.getAttribute('width')).toBe('12');
        expect(container.querySelector('img')?.getAttribute('height')).toBe('13');
        expect(container.querySelector('img')?.getAttribute('title')).toBe('caption');
      }
    }
  );
});

describe('reviewed image authorization and lifetime', () => {
  it.each([
    ['../pic.png?q=1#view', 'pic.png'],
    ['/pic.png?q=1#view', 'pic.png'],
    ['space%20and%20%C3%A9.png', 'docs/space and é.png'],
  ])('reads %s with review coordinates only', async (url, expected) => {
    const source = file('docs/note.html', `<img src="${url}" alt="reference">`);
    const loadImage = vi.fn(async () => ({ dataUri: png }));
    const { container } = render(
      wrapper({ loadDiff: vi.fn(), loadImage }, [source, file(expected)], preview(source, 'html'))
    );
    expect(container.querySelector('img')).toBeNull();
    await waitFor(() => expect(loadImage).toHaveBeenCalledWith(expected));
    await waitFor(() => expect(container.querySelector('img')?.getAttribute('src')).toBe(png));
  });

  it.each([
    'missing.png',
    'outside.svg',
    'file:///outside-private/not-reviewed.png',
    '//outside.test/pic.png',
    'https://outside.test/pic.png',
    '../../private.png',
    '%2e%2e/%2e%2e/private.png',
    '%2foutside.png',
    'bad%5cpath.png',
  ])('refuses %s before any adapter read or resource mount', url => {
    const source = file('docs/note.html', `<img src="${url}" alt="unavailable">`);
    const loadImage = vi.fn();
    const { container, getByRole } = render(
      wrapper(
        { loadDiff: vi.fn(), loadImage },
        [source, image, file('docs/outside.svg')],
        preview(source, 'html')
      )
    );
    expect(container.querySelector('img')).toBeNull();
    expect(loadImage).not.toHaveBeenCalled();
    expect(getByRole('alert').textContent).toContain('unavailable');
  });

  it('keeps safe inline SVG, raster data, and blob images passive without host reads', () => {
    const svg = 'data:image/svg+xml,%3Csvg%20xmlns="http://www.w3.org/2000/svg"/%3E';
    const source = file(
      'docs/note.html',
      `<img src='${png}' alt="raster"><img src='${svg}' alt="svg"><img src="blob:null/image" alt="blob">`
    );
    const loadImage = vi.fn();
    const { container } = render(
      wrapper({ loadDiff: vi.fn(), loadImage }, [source], preview(source, 'html'))
    );
    expect([...container.querySelectorAll('img')].map(img => img.getAttribute('src'))).toEqual([
      png,
      svg,
      'blob:null/image',
    ]);
    expect(container.querySelector('svg')).toBeNull();
    expect(loadImage).not.toHaveBeenCalled();
  });

  it('preserves a renamed document context and refuses ambiguous image aliases', async () => {
    const source = {
      ...file('new/note.md', '![renamed](pic.png)'),
      oldPath: 'old/note.md',
      changeType: 'renamed' as const,
    };
    const renamedImage = {
      ...file('new/pic.png'),
      oldPath: 'old/pic.png',
      changeType: 'renamed' as const,
    };
    const loadImage = vi.fn(async () => ({ dataUri: png }));
    const adapter = { loadDiff: vi.fn(), loadImage };
    const { container, rerender } = render(
      wrapper(adapter, [source, renamedImage], preview(source, 'markdown'))
    );
    await waitFor(() => expect(container.querySelector('img')?.getAttribute('src')).toBe(png));
    expect(loadImage).toHaveBeenCalledWith('new/pic.png');
    rerender(
      wrapper(adapter, [source, renamedImage, file('new/pic.png')], preview(source, 'markdown'))
    );
    expect(container.querySelector('img')).toBeNull();
    expect(loadImage).toHaveBeenCalledTimes(1);
  });

  it.each([
    'file:///outside-private/not-reviewed.png',
    'https://outside.test/pic.png',
    '/private.png',
    'javascript:alert(1)',
    'data:text/html,hi',
  ])('refuses host-returned resource URL %s', async dataUri => {
    const source = file('docs/note.md', '![host](pic.png)');
    const { container, findByRole } = render(
      wrapper(
        { loadDiff: vi.fn(), loadImage: async () => ({ dataUri }) },
        [source, image],
        preview(source, 'markdown')
      )
    );
    await findByRole('alert');
    expect(container.querySelector('img')).toBeNull();
  });

  it('shows missing capability and read errors, with only manual retry', async () => {
    const source = file('docs/note.md', '![retry](pic.png)');
    const { getByRole, rerender, container } = render(
      wrapper({ loadDiff: vi.fn() }, [source, image], preview(source, 'markdown'))
    );
    expect(getByRole('alert').textContent).toContain(
      'Image loading not supported in this context.'
    );
    const loadImage = vi
      .fn()
      .mockRejectedValueOnce(new Error('transport'))
      .mockResolvedValue({ dataUri: png });
    const adapter = { loadDiff: vi.fn(), loadImage };
    const files = [source, image];
    rerender(wrapper(adapter, files, preview(source, 'markdown')));
    await waitFor(() => expect(getByRole('alert').textContent).toContain('Failed to load image.'));
    expect(loadImage).toHaveBeenCalledTimes(1);
    fireEvent.click(getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(container.querySelector('img')?.getAttribute('src')).toBe(png));
    expect(loadImage).toHaveBeenCalledTimes(2);
    fireEvent.error(container.querySelector('img')!);
    expect(getByRole('alert')).toBeTruthy();
    expect(container.querySelector('img')).toBeNull();
    expect(loadImage).toHaveBeenCalledTimes(2);
  });

  it('aborts stale snapshot reads and never displays their late images', async () => {
    const source = file('docs/note.md', '![snapshot](pic.png)');
    let first!: (result: { dataUri: string }) => void;
    let second!: (result: { dataUri: string }) => void;
    const signals: AbortSignal[] = [];
    const loadImage = vi.fn((_path: string, signal: AbortSignal) => {
      signals.push(signal);
      return new Promise<{ dataUri: string }>(resolve => {
        if (signals.length === 1) first = resolve;
        else second = resolve;
      });
    });
    const adapter = { loadDiff: vi.fn(), loadImage: vi.fn(), reads: { loadImage } };
    const { container, rerender, unmount } = render(
      wrapper(adapter, [source, image], preview(source, 'markdown'))
    );
    expect(loadImage).toHaveBeenCalledTimes(1);
    rerender(wrapper(adapter, [source, { ...image }], preview(source, 'markdown')));
    expect(signals[0].aborted).toBe(true);
    expect(loadImage).toHaveBeenCalledTimes(2);
    await act(async () => first({ dataUri: 'data:image/png;base64,T0xE' }));
    expect(container.querySelector('img')).toBeNull();
    await act(async () => second({ dataUri: png }));
    expect(container.querySelector('img')?.getAttribute('src')).toBe(png);
    expect(adapter.loadImage).not.toHaveBeenCalled();
    rerender(wrapper(adapter, [source, { ...image }], preview(source, 'markdown')));
    expect(container.querySelector('img')).toBeNull();
    unmount();
    expect(signals[2].aborted).toBe(true);
    await act(async () => second({ dataUri: 'data:image/png;base64,T0xE' }));
    expect(container.querySelector('img')).toBeNull();
  });

  it('discards pending legacy reads when the adapter is replaced', async () => {
    const source = file('docs/note.md', '![legacy](pic.png)');
    let complete!: (result: { dataUri: string }) => void;
    const oldAdapter = {
      loadDiff: vi.fn(),
      loadImage: () =>
        new Promise<{ dataUri: string }>(resolve => {
          complete = resolve;
        }),
    };
    const nextAdapter = { loadDiff: vi.fn(), loadImage: vi.fn(async () => ({ dataUri: png })) };
    const files = [source, image];
    const { container, rerender } = render(wrapper(oldAdapter, files, preview(source, 'markdown')));
    rerender(wrapper(nextAdapter, files, preview(source, 'markdown')));
    await waitFor(() => expect(container.querySelector('img')?.getAttribute('src')).toBe(png));
    await act(async () => complete({ dataUri: 'data:image/png;base64,T0xE' }));
    expect(container.querySelector('img')?.getAttribute('src')).toBe(png);
  });
});

it('resolves root feedback and its replies against the review root', async () => {
  const loadImage = vi.fn(async () => ({ dataUri: png }));
  const rootComment = { ...comment, filePath: '' };
  const { container } = render(
    wrapper(
      { loadDiff: vi.fn(), loadImage },
      [rootImage, image],
      <CommentDisplay comment={rootComment} />
    )
  );
  await waitFor(() => expect(container.querySelectorAll('img')).toHaveLength(2));
  expect(loadImage.mock.calls).toEqual([['pic.png'], ['pic.png']]);
});

it('uses an old rename alias exactly as authorized by the host', async () => {
  const source = file('docs/note.md', '![old](../old.png)');
  const renamed = { ...file('new.png'), oldPath: 'old.png', changeType: 'renamed' as const };
  const loadImage = vi.fn(async () => ({ dataUri: png }));
  const { container } = render(
    wrapper({ loadDiff: vi.fn(), loadImage }, [source, renamed], preview(source, 'markdown'))
  );
  await waitFor(() => expect(container.querySelector('img')?.getAttribute('src')).toBe(png));
  expect(loadImage).toHaveBeenCalledWith('old.png');
});
