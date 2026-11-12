import React from 'react';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { DiffFile } from '@self-review/types';
import {
  PreviewRenderingProvider,
  type PreviewRenderer,
} from '../../context/PreviewRenderingContext';
import { DiffContentArea, type DiffContentAreaProps } from './DiffContentArea';
import type { FileSectionBodyProps, FileSectionBody } from './FileSectionBody';
import type { RenderedTextMode } from '../../utils/file-type-utils';

vi.mock('../../context/ReviewAdapterContext', () => ({
  useAdapter: () => ({ loadImage: vi.fn() }),
}));

vi.mock('./RenderedMarkdownView', () => ({
  default: ({ contentMode }: { contentMode: RenderedTextMode }) => (
    <div data-testid='rendered-text-view' data-content-mode={contentMode} />
  ),
}));

vi.mock('./RenderedImageView', () => ({
  default: ({ filePath }: { filePath: string }) => (
    <div data-testid='rendered-image-view' data-file-path={filePath} />
  ),
}));

vi.mock('./RenderedSvgView', () => ({
  default: () => <div data-testid='rendered-svg-view' />,
}));

vi.mock('./UnifiedView', () => ({
  default: () => <div data-testid='unified-view' />,
}));

vi.mock('./SplitView', () => ({
  default: () => <div data-testid='split-view' />,
}));

function makeFile(filePath: string, overrides: Partial<DiffFile> = {}): DiffFile {
  return {
    oldPath: filePath,
    newPath: filePath,
    changeType: 'added',
    isBinary: false,
    hunks: [
      {
        header: '@@ -0,0 +1,1 @@',
        oldStart: 0,
        oldLines: 0,
        newStart: 1,
        newLines: 1,
        lines: [
          {
            type: 'addition',
            oldLineNumber: null,
            newLineNumber: 1,
            content: '<p>Hello</p>',
          },
        ],
      },
    ],
    ...overrides,
  };
}

function renderContentArea(
  overrides: Partial<DiffContentAreaProps> = {},
  previewRenderer?: PreviewRenderer
) {
  const file = overrides.file ?? makeFile('index.html');
  const props: DiffContentAreaProps = {
    file,
    filePath: file.newPath || file.oldPath,
    viewMode: 'unified',
    renderViewMode: 'rendered',
    isEligibleForRenderedView: true,
    renderedTextMode: 'html',
    showImagePreview: false,
    showSvgPreview: false,
    contentLoad: { kind: 'idle' },
    onRetry: vi.fn(),
    commentRange: null,
    dragState: null,
    onDragStart: vi.fn(),
    onCancelComment: vi.fn(),
    onCommentSaved: vi.fn(),
    onCommentRange: vi.fn(),
    isExpandable: false,
    expandLoading: false,
    totalLines: null,
    handleExpandContext: vi.fn(),
    ...overrides,
  };

  render(
    <PreviewRenderingProvider previewRenderer={previewRenderer}>
      <DiffContentArea {...props} />
    </PreviewRenderingProvider>
  );
}

describe('DiffContentArea rendered preview dispatch', () => {
  it('dispatches added HTML files to the rendered text view with html mode', () => {
    renderContentArea({
      file: makeFile('index.html'),
      renderedTextMode: 'html',
    });

    expect(screen.getByTestId('rendered-text-view').getAttribute('data-content-mode')).toBe('html');
  });

  it('keeps added Markdown files on the rendered text view with markdown mode', () => {
    renderContentArea({
      file: makeFile('README.md', {
        hunks: [
          {
            header: '@@ -0,0 +1,1 @@',
            oldStart: 0,
            oldLines: 0,
            newStart: 1,
            newLines: 1,
            lines: [
              {
                type: 'addition',
                oldLineNumber: null,
                newLineNumber: 1,
                content: '# Hello',
              },
            ],
          },
        ],
      }),
      renderedTextMode: 'markdown',
    });

    expect(screen.getByTestId('rendered-text-view').getAttribute('data-content-mode')).toBe(
      'markdown'
    );
  });

  it('keeps raster image previews on the image branch', () => {
    renderContentArea({
      file: makeFile('assets/photo.png', { isBinary: true, hunks: [] }),
      isEligibleForRenderedView: false,
      renderedTextMode: null,
      showImagePreview: true,
    });

    expect(screen.getByTestId('rendered-image-view').getAttribute('data-file-path')).toBe(
      'assets/photo.png'
    );
    expect(screen.queryByTestId('rendered-text-view')).toBeNull();
  });

  it('keeps SVG previews on the SVG branch', () => {
    renderContentArea({
      file: makeFile('assets/icon.svg'),
      isEligibleForRenderedView: false,
      renderedTextMode: null,
      showSvgPreview: true,
    });

    expect(screen.getByTestId('rendered-svg-view')).toBeTruthy();
    expect(screen.queryByTestId('rendered-text-view')).toBeNull();
  });

  it('falls back to raw diff rendering when rendered text mode is unavailable', () => {
    renderContentArea({
      renderViewMode: 'rendered',
      isEligibleForRenderedView: false,
      renderedTextMode: null,
    });

    expect(screen.getByTestId('unified-view')).toBeTruthy();
    expect(screen.queryByTestId('rendered-text-view')).toBeNull();
  });
});

describe('DiffContentArea omitted content', () => {
  it('shows why a file was listed without content instead of "No changes to display"', () => {
    const reason = 'Not loaded: this file is 7 MiB, over the 5 MiB per-file read budget.';
    renderContentArea({
      file: makeFile('huge.log', { hunks: [], omittedReason: reason }),
      renderViewMode: 'raw',
      isEligibleForRenderedView: false,
      renderedTextMode: null,
      contentLoad: { kind: 'loaded' },
    });

    expect(screen.getByTestId('content-omitted').textContent).toContain(reason);
    expect(screen.queryByText('No changes to display')).toBeNull();
  });
});

it('keeps the legacy preview flag property types required', () => {
  expectTypeOf<
    React.ComponentProps<typeof FileSectionBody>
  >().toEqualTypeOf<FileSectionBodyProps>();
  expectTypeOf<DiffContentAreaProps['showImagePreview']>().toEqualTypeOf<boolean>();
  expectTypeOf<DiffContentAreaProps['showSvgPreview']>().toEqualTypeOf<boolean>();
  expectTypeOf<DiffContentAreaProps['isEligibleForRenderedView']>().toEqualTypeOf<boolean>();
  expectTypeOf<DiffContentAreaProps['renderedTextMode']>().toEqualTypeOf<RenderedTextMode | null>();
});

it('lets a host wrap the built-in preview without altering legacy dispatch', () => {
  renderContentArea(
    {},
    {
      supports: () => true,
      component: ({ children, onCommentRange }) => (
        <section aria-label='Host preview'>
          <button onClick={() => onCommentRange(1, 1, 'new')}>Annotate</button>
          {children}
        </section>
      ),
    }
  );
  expect(
    screen
      .getByRole('region', { name: 'Host preview' })
      .contains(screen.getByTestId('rendered-text-view'))
  ).toBe(true);
});
it('lets a host render an added format while keeping raw mode available', () => {
  renderContentArea(
    { file: makeFile('schema.custom'), preview: { kind: 'none' } },
    {
      supports: file => file.newPath.endsWith('.custom'),
      component: ({ filePath, children }) => (
        <div>
          {filePath}
          {children}
        </div>
      ),
    }
  );
  expect(screen.getByText('schema.custom')).toBeTruthy();
  expect(screen.queryByTestId('rendered-text-view')).toBeNull();
});
it('does not invoke host preview composition for raw mode', () => {
  const component = vi.fn(() => null);
  renderContentArea({ renderViewMode: 'raw' }, { supports: () => true, component });
  expect(component).not.toHaveBeenCalled();
  expect(screen.getByTestId('unified-view')).toBeTruthy();
});
