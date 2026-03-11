import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import { useExpandContext } from './useExpandContext';
import type { DiffFile, DiffHunk } from '@self-review/core';

const mockExpandFileContext = vi.fn();
const mockUpdateFileHunks = vi.fn();

vi.mock('../../context/ReviewContext', () => ({
  useReview: () => ({
    expandFileContext: mockExpandFileContext,
    updateFileHunks: mockUpdateFileHunks,
  }),
}));

function makeHunk(newStart: number, lines: number): DiffHunk {
  return {
    header: `@@ -${newStart},${lines} +${newStart},${lines} @@`,
    oldStart: newStart,
    oldLines: lines,
    newStart,
    newLines: lines,
    lines: Array.from({ length: lines }, (_, i) => ({
      type: 'context' as const,
      content: `line ${i + newStart}`,
      oldLineNumber: newStart + i,
      newLineNumber: newStart + i,
    })),
  };
}

function makeFile(hunks: DiffHunk[]): DiffFile {
  return {
    oldPath: 'src/foo.ts',
    newPath: 'src/foo.ts',
    changeType: 'modified',
    isBinary: false,
    hunks,
  };
}

describe('useExpandContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with expandLoading false and totalLines null', () => {
    const file = makeFile([makeHunk(1, 3)]);
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(null);
      return useExpandContext({
        file,
        filePath: 'src/foo.ts',
        isExpandable: true,
        sectionRef: ref,
      });
    });

    expect(result.current.expandLoading).toBe(false);
    expect(result.current.totalLines).toBeNull();
  });

  it('calls expandFileContext with IPC and sets expandLoading correctly', async () => {
    const expandedHunk = makeHunk(1, 5);
    mockExpandFileContext.mockResolvedValue({
      hunks: [expandedHunk],
      totalLines: 10,
    });

    const file = makeFile([makeHunk(3, 3)]);
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(null);
      return useExpandContext({
        file,
        filePath: 'src/foo.ts',
        isExpandable: true,
        sectionRef: ref,
      });
    });

    act(() => {
      result.current.handleExpandContext('up', 0, 'top');
    });

    expect(result.current.expandLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.expandLoading).toBe(false);
    });

    expect(mockExpandFileContext).toHaveBeenCalledWith('src/foo.ts', expect.any(Number));
    expect(mockUpdateFileHunks).toHaveBeenCalled();
    expect(result.current.totalLines).toBe(10);
  });

  it('does not call IPC when isExpandable is false', async () => {
    const file = makeFile([makeHunk(1, 3)]);
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(null);
      return useExpandContext({
        file,
        filePath: 'src/foo.ts',
        isExpandable: false,
        sectionRef: ref,
      });
    });

    await act(async () => {
      result.current.handleExpandContext('up', 0, 'top');
    });

    expect(mockExpandFileContext).not.toHaveBeenCalled();
  });
});
