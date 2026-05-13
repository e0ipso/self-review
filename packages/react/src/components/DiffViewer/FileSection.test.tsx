import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { DiffFile } from '@self-review/types';
import FileSection from './FileSection';
import type { FileSectionHeaderProps } from './FileSectionHeader';
import type { DiffContentAreaProps } from './DiffContentArea';

vi.mock('../../context/ReviewContext', () => ({
  useReview: () => ({
    toggleViewed: vi.fn(),
    getCommentsForFile: vi.fn(() => []),
    files: [],
    diffSource: { type: 'git' },
    updateFileHunks: vi.fn(),
  }),
}));

vi.mock('../../context/ReviewAdapterContext', () => ({
  useAdapter: () => null,
}));

vi.mock('./useDragSelection', () => ({
  useDragSelection: () => ({
    dragState: null,
    handleDragStart: vi.fn(),
  }),
}));

vi.mock('./useExpandContext', () => ({
  useExpandContext: () => ({
    expandLoading: false,
    totalLines: null,
    handleExpandContext: vi.fn(),
  }),
}));

vi.mock('./FileSectionHeader', () => ({
  FileSectionHeader: ({ isPreviewable, renderViewMode }: FileSectionHeaderProps) => (
    <div
      data-testid='mock-file-section-header'
      data-previewable={String(isPreviewable)}
      data-render-view-mode={renderViewMode}
    />
  ),
}));

vi.mock('./FileSectionBody', () => ({
  FileSectionBody: ({ contentAreaProps }: { contentAreaProps: DiffContentAreaProps }) => (
    <div
      data-testid='mock-file-section-body'
      data-render-view-mode={contentAreaProps.renderViewMode}
      data-rendered-text-mode={contentAreaProps.renderedTextMode ?? 'null'}
      data-eligible-rendered-text={String(contentAreaProps.isEligibleForRenderedView)}
      data-show-image-preview={String(contentAreaProps.showImagePreview)}
      data-show-svg-preview={String(contentAreaProps.showSvgPreview)}
    />
  ),
}));

function makeDiffFile(
  filePath: string,
  overrides: Partial<DiffFile> = {},
): DiffFile {
  return {
    oldPath: filePath,
    newPath: filePath,
    changeType: 'added',
    isBinary: false,
    hunks: [],
    ...overrides,
  };
}

function renderFileSection(file: DiffFile) {
  render(<FileSection file={file} viewMode='unified' expanded={true} />);
  return {
    header: screen.getByTestId('mock-file-section-header'),
    body: screen.getByTestId('mock-file-section-body'),
  };
}

describe('FileSection preview eligibility', () => {
  it('marks added HTML files as rendered-text previewable', () => {
    const { header, body } = renderFileSection(makeDiffFile('index.html'));

    expect(header.getAttribute('data-previewable')).toBe('true');
    expect(header.getAttribute('data-render-view-mode')).toBe('rendered');
    expect(body.getAttribute('data-eligible-rendered-text')).toBe('true');
    expect(body.getAttribute('data-rendered-text-mode')).toBe('html');
  });

  it('marks added HTM files as rendered-text previewable', () => {
    const { body } = renderFileSection(makeDiffFile('templates/page.htm'));

    expect(body.getAttribute('data-eligible-rendered-text')).toBe('true');
    expect(body.getAttribute('data-rendered-text-mode')).toBe('html');
  });

  it('keeps added Markdown files on the rendered-text path', () => {
    const { header, body } = renderFileSection(makeDiffFile('README.markdown'));

    expect(header.getAttribute('data-previewable')).toBe('true');
    expect(body.getAttribute('data-eligible-rendered-text')).toBe('true');
    expect(body.getAttribute('data-rendered-text-mode')).toBe('markdown');
  });

  it('does not make non-added HTML files previewable', () => {
    const { header, body } = renderFileSection(
      makeDiffFile('index.html', { changeType: 'modified' }),
    );

    expect(header.getAttribute('data-previewable')).toBe('false');
    expect(header.getAttribute('data-render-view-mode')).toBe('raw');
    expect(body.getAttribute('data-eligible-rendered-text')).toBe('false');
    expect(body.getAttribute('data-rendered-text-mode')).toBe('null');
  });

  it('preserves image and SVG preview flags without rendered-text mode', () => {
    const image = renderFileSection(makeDiffFile('photo.png', { isBinary: true }));
    expect(image.header.getAttribute('data-previewable')).toBe('true');
    expect(image.header.getAttribute('data-render-view-mode')).toBe('rendered');
    expect(image.body.getAttribute('data-render-view-mode')).toBe('rendered');
    expect(image.body.getAttribute('data-show-image-preview')).toBe('true');
    expect(image.body.getAttribute('data-show-svg-preview')).toBe('false');
    expect(image.body.getAttribute('data-rendered-text-mode')).toBe('null');

    cleanup();

    const svg = renderFileSection(makeDiffFile('icon.svg'));
    expect(svg.header.getAttribute('data-previewable')).toBe('true');
    expect(svg.header.getAttribute('data-render-view-mode')).toBe('raw');
    expect(svg.body.getAttribute('data-render-view-mode')).toBe('raw');
    expect(svg.body.getAttribute('data-show-image-preview')).toBe('false');
    expect(svg.body.getAttribute('data-show-svg-preview')).toBe('true');
    expect(svg.body.getAttribute('data-rendered-text-mode')).toBe('null');
  });
});
