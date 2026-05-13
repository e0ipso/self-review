import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { DiffFile } from '@self-review/types';
import { DiffContentArea, type DiffContentAreaProps } from './DiffContentArea';
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

function renderContentArea(overrides: Partial<DiffContentAreaProps> = {}) {
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
    contentLoading: false,
    contentError: false,
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

  render(<DiffContentArea {...props} />);
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

    expect(screen.getByTestId('rendered-text-view').getAttribute('data-content-mode')).toBe('markdown');
  });

  it('keeps raster image previews on the image branch', () => {
    renderContentArea({
      file: makeFile('assets/photo.png', { isBinary: true, hunks: [] }),
      isEligibleForRenderedView: false,
      renderedTextMode: null,
      showImagePreview: true,
    });

    expect(screen.getByTestId('rendered-image-view').getAttribute('data-file-path')).toBe('assets/photo.png');
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
