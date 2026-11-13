import React, { Suspense, startTransition, useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { DiffFile, LineRange, ReviewComment } from '@self-review/types';
import type { ReviewAdapter } from '../../adapter';
import { ReviewAdapterProvider } from '../../context/ReviewAdapterContext';
import { ConfigProvider, useAppearance } from '../../context/ConfigContext';
import { ReviewProvider, useReviewCommands } from '../../context/ReviewContext';
import { LocalizationProvider } from '../../localization/LocalizationContext';
import { installBrowserApiStubs } from '../../test-helpers';
import * as styles from '../../utils/diff-styles';
import UnifiedView from './UnifiedView';
import SplitView from './SplitView';

installBrowserApiStubs();

function sourceFile(): DiffFile {
  return {
    oldPath: 'source.txt',
    newPath: 'source.txt',
    changeType: 'modified',
    isBinary: false,
    hunks: [
      {
        header: '@@ -5,2 +7,3 @@',
        oldStart: 5,
        newStart: 7,
        oldLines: 2,
        newLines: 3,
        lines: [
          { type: 'context', oldLineNumber: 5, newLineNumber: 7, content: '<div>&amp;\t😀 אבג' },
          { type: 'deletion', oldLineNumber: 6, newLineNumber: null, content: 'removed' },
          { type: 'addition', oldLineNumber: null, newLineNumber: 8, content: '' },
          { type: 'addition', oldLineNumber: null, newLineNumber: 9, content: 'final\n' },
        ],
      },
    ],
  };
}

it.each([UnifiedView, SplitView])(
  'keeps literal source, anchors and every activation with fresh callbacks',
  View => {
    const file = sourceFile();
    const adapter: ReviewAdapter = {
      loadDiff: vi.fn(),
      loadFileContent: vi.fn(),
      expandContext: vi.fn(),
      loadImage: vi.fn(),
      readAttachment: vi.fn(),
      writeClipboard: vi.fn(),
      submitReview: vi.fn(),
      publishReview: vi.fn(),
      applySuggestion: vi.fn(),
    };
    const first = vi.fn();
    const latest = vi.fn();
    const noop = vi.fn();
    const tree = (drag = first) => (
      <ConfigProvider>
        <ReviewProvider initialFiles={[file]}>
          <ReviewAdapterProvider adapter={adapter}>
            <View
              file={file}
              commentRange={null}
              dragState={null}
              onDragStart={drag}
              onCancelComment={noop}
              onCommentSaved={noop}
            />
          </ReviewAdapterProvider>
        </ReviewProvider>
      </ConfigProvider>
    );
    const { container, rerender } = render(tree());
    const codes = [...container.querySelectorAll('code')];
    expect(codes.map(code => code.textContent)).toEqual(
      View === UnifiedView
        ? ['<div>&amp;    😀 אבג', 'removed', '', 'final\n']
        : ['<div>&amp;    😀 אבג', '<div>&amp;    😀 אבג', 'removed', '', 'final\n']
    );
    expect(container.querySelector('code div')).toBeNull();
    const expected = [
      ['old', 5, 0],
      ['new', 7, 0],
      ['old', 6, 1],
      ['new', 8, 2],
      ['new', 9, 3],
    ] as const;
    for (const [side, line, index] of expected) {
      const button = screen.getByTestId(`comment-icon-${side}-${line}`);
      expect(button.closest('[data-line-side]')?.getAttribute('data-line-side')).toBe(
        View === UnifiedView && side === 'old' && line === 5 ? 'new' : side
      );
      expect(screen.getByTestId(`${side}-line-source.txt-${line}`)).toBeTruthy();
      if (View === UnifiedView)
        expect(button.closest('[data-row-index]')?.getAttribute('data-row-index')).toBe(
          String(index)
        );
      const coordinate = View === UnifiedView ? index : line;
      first.mockClear();
      fireEvent.mouseDown(button, { button: 0 });
      fireEvent.mouseUp(button);
      fireEvent.click(button, { detail: 1 });
      expect(first.mock.calls).toEqual([[coordinate, side]]);
      for (const key of ['Enter', ' ']) {
        first.mockClear();
        fireEvent.keyDown(button, { key });
        expect(first.mock.calls).toEqual([[coordinate, side, true]]);
      }
      first.mockClear();
      (button as HTMLButtonElement).click();
      expect(first.mock.calls).toEqual([[coordinate, side, true]]);
    }
    rerender(tree(latest));
    first.mockClear();
    (screen.getByTestId('comment-icon-new-9') as HTMLButtonElement).click();
    expect(latest.mock.calls).toEqual([[View === UnifiedView ? 3 : 9, 'new', true]]);
    expect(first).not.toHaveBeenCalled();
    expect(noop).not.toHaveBeenCalled();
    Object.values(adapter).forEach(method => expect(method).not.toHaveBeenCalled());
    expect([...container.querySelectorAll('code')]).toEqual(codes);
  }
);

function Controls() {
  const { editComment } = useReviewCommands();
  const { updateConfig } = useAppearance();
  return (
    <>
      <button onClick={() => editComment('thread', { body: 'Changed body' })}>Change body</button>
      <button
        onClick={() => editComment('thread', { lineRange: { start: 9, end: 9, side: 'new' } })}
      >
        Move thread
      </button>
      <button onClick={() => updateConfig({ theme: 'dark', wordWrap: true })}>Wrap and dark</button>
    </>
  );
}

it.each([UnifiedView, SplitView])(
  'skips unchanged raw work while preserving feedback, drafts and real appearance updates',
  View => {
    const gutterWork = vi.spyOn(styles, 'getGutterBg');
    const file = sourceFile();
    const comment: ReviewComment = {
      id: 'thread',
      filePath: 'source.txt',
      lineRange: { start: 7, end: 7, side: 'new' },
      body: 'Initial body',
      category: 'note',
      suggestion: null,
    };
    const drag = vi.fn();
    const latestDrag = vi.fn();
    const noop = vi.fn();
    const tree = (range: LineRange = { start: 8, end: 8, side: 'new' }, onDragStart = drag) => (
      <ConfigProvider initialConfig={{ theme: 'light', wordWrap: false }}>
        <ReviewProvider initialFiles={[file]} initialComments={[comment]}>
          <Controls />
          <View
            file={file}
            commentRange={range}
            dragState={null}
            onDragStart={onDragStart}
            onCancelComment={noop}
            onCommentSaved={noop}
          />
        </ReviewProvider>
      </ConfigProvider>
    );
    const { container, rerender } = render(tree());
    expect(gutterWork).toHaveBeenCalled();
    const codes = [...container.querySelectorAll('code')];
    const text = codes[0].firstChild;
    const draft = screen.getByPlaceholderText(
      'Add your review comment... (paste or drop images here)'
    ) as HTMLTextAreaElement;
    fireEvent.change(draft, { target: { value: 'Keep this draft' } });
    gutterWork.mockClear();
    rerender(tree(undefined, latestDrag));
    fireEvent.click(screen.getByText('Change body'));
    expect(screen.getByText('Changed body')).toBeTruthy();
    expect(gutterWork).not.toHaveBeenCalled();
    (screen.getByTestId('comment-icon-new-9') as HTMLButtonElement).click();
    expect(latestDrag).toHaveBeenCalledWith(View === UnifiedView ? 3 : 9, 'new', true);
    expect(draft.value).toBe('Keep this draft');
    expect(container.querySelector('code')?.firstChild).toBe(text);
    expect([...container.querySelectorAll('code')]).toEqual(codes);
    fireEvent.click(screen.getByText('Move thread'));
    expect(gutterWork).toHaveBeenCalled();
    expect(
      screen.getByTestId('comment-icon-new-9').closest('[data-line-type]')?.className
    ).toContain('shadow-');
    expect(
      screen.getByTestId('comment-icon-new-7').closest('[data-line-type]')?.className
    ).not.toContain('shadow-');
    gutterWork.mockClear();
    rerender(tree({ start: 7, end: 8, side: 'new' }));
    expect(gutterWork).toHaveBeenCalled();
    expect(
      screen.getByTestId('comment-icon-new-7').closest('[data-line-type]')?.className
    ).toContain('bg-blue-100');
    expect(draft.value).toBe('Keep this draft');
    fireEvent.click(screen.getByText('Wrap and dark'));
    expect(container.querySelector('.self-review.dark')).toBeTruthy();
    expect(codes[0].className).toContain('whitespace-pre-wrap');
    expect([...container.querySelectorAll('code')]).toEqual(codes);
    expect(drag).not.toHaveBeenCalled();
    expect(noop).not.toHaveBeenCalled();
  }
);

it.each([UnifiedView, SplitView])(
  'observes same-reference source mutation and localization after rerender',
  View => {
    const file = sourceFile();
    const drag = vi.fn();
    const noop = vi.fn();
    const tree = (translated = false) => (
      <LocalizationProvider
        direction={translated ? 'rtl' : 'ltr'}
        messages={translated ? { 'Comment on new line {line}': 'New source {line}' } : undefined}
      >
        <ConfigProvider>
          <ReviewProvider initialFiles={[file]}>
            <View
              file={file}
              commentRange={null}
              dragState={null}
              onDragStart={drag}
              onCancelComment={noop}
              onCommentSaved={noop}
            />
          </ReviewProvider>
        </ConfigProvider>
      </LocalizationProvider>
    );
    const { container, rerender } = render(tree());
    const line = file.hunks[0].lines[3];
    line.content = '<changed>\t終\n';
    line.newLineNumber = 10;
    line.type = 'context';
    rerender(tree(true));
    expect(container.querySelector('[dir="rtl"]')).toBeTruthy();
    expect(container.querySelectorAll('code')[View === UnifiedView ? 3 : 4].textContent).toBe(
      '<changed>    終\n'
    );
    expect(screen.queryByTestId('comment-icon-new-9')).toBeNull();
    const button = screen.getByRole('button', { name: 'New source 10' });
    expect(button.closest('[data-line-type]')?.getAttribute('data-line-type')).toBe('context');
    expect(button.closest('[data-line-number]')?.getAttribute('data-line-number')).toBe('10');
    (button as HTMLButtonElement).click();
    expect(drag).toHaveBeenCalledWith(View === UnifiedView ? 3 : 10, 'new', true);
  }
);

it.each([UnifiedView, SplitView])(
  'updates drag selection with the existing layout coordinates and sides',
  View => {
    const file = sourceFile();
    const noop = vi.fn();
    const tree = (selected: boolean) => (
      <ConfigProvider>
        <ReviewProvider initialFiles={[file]}>
          <View
            file={file}
            commentRange={null}
            dragState={
              selected
                ? {
                    startLine: View === UnifiedView ? 0 : 5,
                    currentLine: View === UnifiedView ? 1 : 6,
                    side: 'old',
                  }
                : null
            }
            onDragStart={noop}
            onCancelComment={noop}
            onCommentSaved={noop}
          />
        </ReviewProvider>
      </ConfigProvider>
    );
    const { container, rerender } = render(tree(false));
    const codes = [...container.querySelectorAll('code')];
    rerender(tree(true));
    const selected = [...container.querySelectorAll('[data-line-type]')].filter(row =>
      row.className.includes('bg-blue-100')
    );
    expect(
      selected.map(row => [
        row.getAttribute('data-line-number'),
        row.getAttribute('data-line-side'),
      ])
    ).toEqual(
      View === UnifiedView
        ? [
            ['7', 'new'],
            ['6', 'old'],
          ]
        : [
            ['5', 'old'],
            ['6', 'old'],
          ]
    );
    rerender(tree(false));
    expect(
      [...container.querySelectorAll('[data-line-type]')].some(row =>
        row.className.includes('bg-blue-100')
      )
    ).toBe(false);
    expect([...container.querySelectorAll('code')]).toEqual(codes);
    expect(noop).not.toHaveBeenCalled();
  }
);

it.each([UnifiedView, SplitView])(
  'retains the committed callback through an interrupted render',
  async View => {
    const file = sourceFile();
    const callbacks = [vi.fn(), vi.fn(), vi.fn()];
    const pending = new Promise<void>(() => {});
    let setVersion: React.Dispatch<React.SetStateAction<number>>;
    function Suspend({ version }: { version: number }) {
      if (version === 1) throw pending;
      return null;
    }
    function Fixture() {
      const [version, update] = useState(0);
      setVersion = update;
      return (
        <ConfigProvider>
          <ReviewProvider initialFiles={[file]}>
            <Suspense fallback={<p>Pending</p>}>
              <View
                file={file}
                commentRange={null}
                dragState={null}
                onDragStart={callbacks[version]}
                onCancelComment={callbacks[0]}
                onCommentSaved={callbacks[0]}
              />
              <Suspend version={version} />
            </Suspense>
          </ReviewProvider>
        </ConfigProvider>
      );
    }
    render(<Fixture />);
    const button = screen.getByTestId('comment-icon-new-9') as HTMLButtonElement;
    await act(async () => {
      startTransition(() => setVersion(1));
    });
    expect(screen.queryByText('Pending')).toBeNull();
    button.click();
    expect(callbacks[0]).toHaveBeenCalledTimes(1);
    expect(callbacks[1]).not.toHaveBeenCalled();
    await act(async () => setVersion(2));
    expect(screen.getByTestId('comment-icon-new-9')).toBe(button);
    button.click();
    expect(callbacks[2]).toHaveBeenCalledWith(View === UnifiedView ? 3 : 9, 'new', true);
    expect(callbacks[0]).toHaveBeenCalledTimes(1);
    expect(callbacks[1]).not.toHaveBeenCalled();
  }
);
