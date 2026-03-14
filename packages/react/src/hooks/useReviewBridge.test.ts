import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { useReviewBridge, type ReviewHandle } from './useReviewBridge';

// Mock useReview
vi.mock('../context/ReviewContext', () => ({
  useReview: vi.fn(),
}));

import { useReview } from '../context/ReviewContext';

const mockDiffSource = { type: 'git' as const, args: [] };

function makeFile(comments: any[]) {
  return { newPath: 'file.ts', comments, hunks: [], changeType: 'modified' } as any;
}

describe('useReviewBridge', () => {
  beforeEach(() => {
    vi.mocked(useReview).mockReset();
  });

  it('calls onReviewChange with flat comments when files change', () => {
    const comment = { id: '1', body: 'hi' } as any;
    vi.mocked(useReview).mockReturnValue({
      files: [makeFile([comment])],
      diffSource: mockDiffSource,
    } as any);

    const onReviewChange = vi.fn();
    const ref = React.createRef<ReviewHandle>();
    renderHook(() => useReviewBridge(ref, onReviewChange));

    expect(onReviewChange).toHaveBeenCalledWith([comment]);
  });

  it('does not throw when onReviewChange is undefined', () => {
    vi.mocked(useReview).mockReturnValue({
      files: [makeFile([])],
      diffSource: mockDiffSource,
    } as any);
    const ref = React.createRef<ReviewHandle>();
    expect(() => renderHook(() => useReviewBridge(ref, undefined))).not.toThrow();
  });

  it('ref handle getReviewState returns current files and source', () => {
    const file = makeFile([]);
    vi.mocked(useReview).mockReturnValue({
      files: [file],
      diffSource: mockDiffSource,
    } as any);
    const ref = React.createRef<ReviewHandle>();
    renderHook(() => useReviewBridge(ref, undefined));

    const state = ref.current?.getReviewState();
    expect(state?.files).toEqual([file]);
    expect(state?.source).toEqual(mockDiffSource);
    expect(typeof state?.timestamp).toBe('string');
  });

  it('calls onReviewChange with empty array when files have no comments', () => {
    vi.mocked(useReview).mockReturnValue({
      files: [makeFile([])],
      diffSource: mockDiffSource,
    } as any);

    const onReviewChange = vi.fn();
    const ref = React.createRef<ReviewHandle>();
    renderHook(() => useReviewBridge(ref, onReviewChange));

    expect(onReviewChange).toHaveBeenCalledWith([]);
  });

  it('does not re-fire onReviewChange when files change but comments stay the same', () => {
    const comment = { id: '1', body: 'hi' } as any;
    vi.mocked(useReview).mockReturnValue({
      files: [makeFile([comment])],
      diffSource: mockDiffSource,
    } as any);

    const onReviewChange = vi.fn();
    const ref = React.createRef<ReviewHandle>();
    const { rerender } = renderHook(() => useReviewBridge(ref, onReviewChange));

    expect(onReviewChange).toHaveBeenCalledTimes(1);

    // Simulate a files reference change (e.g., viewed flag toggle) with same comments
    vi.mocked(useReview).mockReturnValue({
      files: [{ ...makeFile([comment]), viewed: true }],
      diffSource: mockDiffSource,
    } as any);
    rerender();

    // Should still be 1 — not re-fired
    expect(onReviewChange).toHaveBeenCalledTimes(1);
  });

  it('flattens comments from multiple files', () => {
    const comment1 = { id: '1', body: 'first' } as any;
    const comment2 = { id: '2', body: 'second' } as any;
    vi.mocked(useReview).mockReturnValue({
      files: [makeFile([comment1]), makeFile([comment2])],
      diffSource: mockDiffSource,
    } as any);

    const onReviewChange = vi.fn();
    const ref = React.createRef<ReviewHandle>();
    renderHook(() => useReviewBridge(ref, onReviewChange));

    expect(onReviewChange).toHaveBeenCalledWith([comment1, comment2]);
  });
});
