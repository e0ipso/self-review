import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { DiffFile, ReviewComment } from '@self-review/types';
import RenderedMarkdownView from './RenderedMarkdownView';
import type { RenderedTextMode } from '../../utils/file-type-utils';

const mockState = vi.hoisted(() => ({
  comments: [] as ReviewComment[],
}));

vi.mock('../../context/ReviewContext', () => ({
  useReview: () => ({
    getCommentsForFile: vi.fn(() => mockState.comments),
  }),
}));

vi.mock('../Comments/CommentInput', () => ({
  default: () => <div data-testid='comment-input' />,
}));

vi.mock('../Comments/CommentDisplay', () => ({
  default: ({ comment }: { comment: ReviewComment }) => (
    <div data-testid='comment-display'>{comment.body}</div>
  ),
}));

vi.mock('./MermaidBlock', () => ({
  default: ({ code }: { code: string }) => <pre data-testid='mermaid-block'>{code}</pre>,
}));

function makeAddedFile(filePath: string, lines: string[]): DiffFile {
  return {
    oldPath: filePath,
    newPath: filePath,
    changeType: 'added',
    isBinary: false,
    hunks: [
      {
        header: `@@ -0,0 +1,${lines.length} @@`,
        oldStart: 0,
        oldLines: 0,
        newStart: 1,
        newLines: lines.length,
        lines: lines.map((content, index) => ({
          type: 'addition',
          oldLineNumber: null,
          newLineNumber: index + 1,
          content,
        })),
      },
    ],
  };
}

function renderView(
  file: DiffFile,
  contentMode: RenderedTextMode,
  onGutterMouseDown = vi.fn(),
) {
  const result = render(
    <RenderedMarkdownView
      file={file}
      contentMode={contentMode}
      commentRange={null}
      onCancelComment={vi.fn()}
      onCommentSaved={vi.fn()}
      onGutterMouseDown={onGutterMouseDown}
    />,
  );

  return { ...result, onGutterMouseDown };
}

describe('RenderedMarkdownView', () => {
  beforeEach(() => {
    mockState.comments = [];
  });

  it('keeps Markdown front matter, emoji, and source-line mapping', () => {
    const file = makeAddedFile('README.md', [
      '---',
      'title: Guide',
      '---',
      '# Hello :rocket:',
      '',
      '- item',
    ]);

    const { container } = renderView(file, 'markdown');

    expect(container.firstElementChild?.getAttribute('data-rendered-text-mode')).toBe('markdown');
    expect(screen.getByText('title')).toBeTruthy();
    expect(screen.getByText('Guide')).toBeTruthy();
    expect(screen.getByText('Hello 🚀').closest('h1')?.getAttribute('data-source-start-line')).toBe('4');
  });

  it('renders added-file HTML directly through commentable block wrappers', () => {
    const file = makeAddedFile('index.html', [
      '<section>',
      '  <h1>Hello <span>HTML</span></h1>',
      '  <p>First block</p>',
      '  <p>Second block</p>',
      '</section>',
    ]);

    const { container, onGutterMouseDown } = renderView(file, 'html');
    const firstParagraph = screen.getByText('First block').closest('p');

    expect(container.firstElementChild?.getAttribute('data-rendered-text-mode')).toBe('html');
    expect(container.querySelector('h1')?.getAttribute('data-source-start-line')).toBe('2');
    expect(firstParagraph?.getAttribute('data-source-start-line')).toBe('3');

    const gutterButton = firstParagraph?.querySelector('button');
    expect(gutterButton).not.toBeNull();
    fireEvent.mouseDown(gutterButton as HTMLButtonElement);

    expect(onGutterMouseDown).toHaveBeenCalledWith(3, 3);
  });

  it('displays existing line comments on rendered HTML blocks', () => {
    mockState.comments = [
      {
        id: 'comment-1',
        filePath: 'index.html',
        lineRange: { side: 'new', start: 3, end: 3 },
        body: 'Comment for first paragraph',
        category: 'note',
        suggestion: null,
      },
    ];

    const file = makeAddedFile('index.html', [
      '<main>',
      '  <h1>Hello</h1>',
      '  <p>First block</p>',
      '</main>',
    ]);

    renderView(file, 'html');

    expect(screen.getByTestId('comment-display').textContent).toBe('Comment for first paragraph');
  });

  it('omits HTML that can execute scripts or load external resources', () => {
    const file = makeAddedFile('index.html', [
      '<h1 onclick="alert(1)">Safe heading</h1>',
      '<img src="https://example.com/image.png" alt="External image">',
      '<iframe src="https://example.com"></iframe>',
      '<script>alert(1)</script>',
    ]);

    const { container } = renderView(file, 'html');

    expect(screen.getByText('Safe heading')).toBeTruthy();
    expect(container.querySelector('h1')?.getAttribute('onclick')).toBeNull();
    expect(container.querySelector('img')?.getAttribute('src')).toBeNull();
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
  });
});
