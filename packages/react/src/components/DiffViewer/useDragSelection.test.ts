import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRef } from 'react';
import { useDragSelection } from './useDragSelection';
import type { DiffFile } from '@self-review/types';

function makeFile(
  lines: { type: 'addition' | 'deletion' | 'context'; old: number | null; new: number | null }[]
): DiffFile {
  return {
    oldPath: 'src/foo.ts',
    newPath: 'src/foo.ts',
    changeType: 'modified',
    isBinary: false,
    hunks: [
      {
        header: '@@ -1,3 +1,3 @@',
        oldStart: 1,
        oldLines: lines.length,
        newStart: 1,
        newLines: lines.length,
        lines: lines.map(l => ({
          type: l.type,
          content: 'x',
          oldLineNumber: l.old,
          newLineNumber: l.new,
        })),
      },
    ],
  };
}

const file = makeFile([
  { type: 'context', old: 1, new: 1 },
  { type: 'addition', old: null, new: 2 },
  { type: 'context', old: 3, new: 3 },
]);

// A bare vi.fn() infers Mock<Procedure | Constructable>, which no specific
// signature accepts, so the mocked callback needs its type written out. The
// hook's own params type is module-private, hence the local copy.
type CommentRangeHandler = (start: number, end: number, side: 'old' | 'new') => void;

describe('useDragSelection', () => {
  let onCommentRange: Mock<CommentRangeHandler>;

  beforeEach(() => {
    onCommentRange = vi.fn<CommentRangeHandler>();
  });

  it('starts with null drag state', () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(null);
      return useDragSelection({
        sectionRef: ref,
        effectiveViewMode: 'split',
        file,
        filePath: 'src/foo.ts',
        onCommentRange,
      });
    });
    expect(result.current.dragState).toBeNull();
  });

  it('sets drag state on handleDragStart', () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(null);
      return useDragSelection({
        sectionRef: ref,
        effectiveViewMode: 'split',
        file,
        filePath: 'src/foo.ts',
        onCommentRange,
      });
    });

    act(() => {
      result.current.handleDragStart(2, 'new');
    });

    expect(result.current.dragState).toEqual({
      startLine: 2,
      currentLine: 2,
      side: 'new',
    });
  });

  it('commits range on mouseup after drag start', () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(null);
      return useDragSelection({
        sectionRef: ref,
        effectiveViewMode: 'split',
        file,
        filePath: 'src/foo.ts',
        onCommentRange,
      });
    });

    act(() => {
      result.current.handleDragStart(1, 'new');
    });

    act(() => {
      document.dispatchEvent(new MouseEvent('mouseup'));
    });

    expect(onCommentRange).toHaveBeenCalledWith(1, 1, 'new');
    expect(result.current.dragState).toBeNull();
  });

  it('mouseup without prior drag is a no-op', () => {
    renderHook(() => {
      const ref = useRef<HTMLDivElement>(null);
      return useDragSelection({
        sectionRef: ref,
        effectiveViewMode: 'split',
        file,
        filePath: 'src/foo.ts',
        onCommentRange,
      });
    });

    act(() => {
      document.dispatchEvent(new MouseEvent('mouseup'));
    });

    expect(onCommentRange).not.toHaveBeenCalled();
  });

  it('trigger-line-comment event starts a range', () => {
    renderHook(() => {
      const ref = useRef<HTMLDivElement>(null);
      return useDragSelection({
        sectionRef: ref,
        effectiveViewMode: 'split',
        file,
        filePath: 'src/foo.ts',
        onCommentRange,
      });
    });

    act(() => {
      document.dispatchEvent(
        new CustomEvent('trigger-line-comment', {
          detail: { filePath: 'src/foo.ts', lineNumber: 3, side: 'new' },
        })
      );
    });

    expect(onCommentRange).toHaveBeenCalledWith(3, 3, 'new');
  });

  it('ignores trigger-line-comment for different file', () => {
    renderHook(() => {
      const ref = useRef<HTMLDivElement>(null);
      return useDragSelection({
        sectionRef: ref,
        effectiveViewMode: 'split',
        file,
        filePath: 'src/foo.ts',
        onCommentRange,
      });
    });

    act(() => {
      document.dispatchEvent(
        new CustomEvent('trigger-line-comment', {
          detail: { filePath: 'src/other.ts', lineNumber: 3, side: 'new' },
        })
      );
    });

    expect(onCommentRange).not.toHaveBeenCalled();
  });
});
