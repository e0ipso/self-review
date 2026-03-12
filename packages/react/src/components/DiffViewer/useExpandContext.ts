import { useState, useLayoutEffect, useRef, useCallback } from 'react';
import type { DiffFile, DiffHunk } from '@self-review/types';
import { useReview } from '../../context/ReviewContext';
import {
  trimHunkContext,
  getHunkChangeRange,
  countLeadingContext,
  countTrailingContext,
  type HunkChangeRange,
  type HunkContextBudget,
} from './diff-utils';

interface UseExpandContextParams {
  file: DiffFile;
  filePath: string;
  isExpandable: boolean;
  sectionRef: React.RefObject<HTMLElement | null>;
}

interface UseExpandContextResult {
  expandLoading: boolean;
  totalLines: number | null;
  handleExpandContext: (direction: 'up' | 'down' | 'all', hunkIndex: number, position: 'top' | 'between' | 'bottom') => void;
}

export function useExpandContext({
  file,
  filePath,
  isExpandable,
  sectionRef,
}: UseExpandContextParams): UseExpandContextResult {
  const { expandFileContext, updateFileHunks } = useReview();
  const [expandLoading, setExpandLoading] = useState(false);
  const [totalLines, setTotalLines] = useState<number | null>(null);

  // Per-hunk directional context budgets, raw hunk cache, and original change ranges.
  // Keyed by original hunk positions so they survive hunk merging from expansion.
  const originalRangesRef = useRef<HunkChangeRange[] | null>(null);
  const hunkBudgetsRef = useRef<HunkContextBudget[] | null>(null);
  const rawHunksRef = useRef<DiffHunk[] | null>(null);
  const lastRequestedContextRef = useRef<number>(0);

  // Initialize per-hunk tracking from the initial hunks (run once)
  if (originalRangesRef.current === null && file.hunks.length > 0) {
    originalRangesRef.current = file.hunks.map(h => getHunkChangeRange(h));
    hunkBudgetsRef.current = file.hunks.map(h => ({
      above: countLeadingContext(h),
      below: countTrailingContext(h),
    }));
    lastRequestedContextRef.current = Math.max(
      ...file.hunks.flatMap(h => [countLeadingContext(h), countTrailingContext(h)]),
      0,
    );
  }

  // Scroll compensation: keep the user looking at the same code after expansion.
  // We anchor on a specific diff line that existed before expansion:
  //   - Expand up: the first line of the hunk (it will shift down as new lines appear above)
  //   - Expand down/all: the last line of the hunk (stays in place, new lines appear below)
  // We record that line's position relative to the scroll container before expansion,
  // then after React commits the new DOM, find the same line and adjust scrollTop.
  const scrollCompensationRef = useRef<{
    anchorLineNumber: number;
    anchorSide: 'old' | 'new';
    anchorOffsetFromContainerTop: number;
    scrollTop: number;
  } | null>(null);

  useLayoutEffect(() => {
    const compensation = scrollCompensationRef.current;
    if (!compensation) return;
    scrollCompensationRef.current = null;

    const scrollContainer = document.querySelector<HTMLElement>(
      '[data-scroll-container="diff"]'
    );
    if (!scrollContainer || !sectionRef.current) return;

    // Find the anchor line element in the updated DOM
    const selector = `[data-line-number="${compensation.anchorLineNumber}"][data-line-side="${compensation.anchorSide}"]`;
    const anchorEl = sectionRef.current.querySelector<HTMLElement>(selector);
    if (!anchorEl) return;

    const containerRect = scrollContainer.getBoundingClientRect();
    const anchorRect = anchorEl.getBoundingClientRect();
    const currentOffset = anchorRect.top - containerRect.top;
    const drift = currentOffset - compensation.anchorOffsetFromContainerTop;
    if (Math.abs(drift) > 1) {
      scrollContainer.scrollTop = compensation.scrollTop + drift;
    }
  }, [file.hunks]);

  // Stable refs for callback dependencies
  const expandLoadingRef = useRef(expandLoading);
  expandLoadingRef.current = expandLoading;
  const fileHunksRef = useRef(file.hunks);
  fileHunksRef.current = file.hunks;
  const totalLinesRef = useRef(totalLines);
  totalLinesRef.current = totalLines;

  const handleExpandContext = useCallback(async (direction: 'up' | 'down' | 'all', hunkIndex: number, position: 'top' | 'between' | 'bottom') => {
    if (!isExpandable || expandLoadingRef.current) return;
    const budgets = hunkBudgetsRef.current;
    const originalRanges = originalRangesRef.current;
    if (!budgets || !originalRanges) return;

    const currentHunks = fileHunksRef.current;

    // --- Update per-hunk budgets for the clicked direction ---
    // Map current hunkIndex back to original hunk indices via change ranges.
    const currentHunk = currentHunks[hunkIndex];
    const findOriginalIndices = (h: DiffHunk): number[] => {
      const indices: number[] = [];
      for (let i = 0; i < originalRanges.length; i++) {
        const range = originalRanges[i];
        for (const line of h.lines) {
          if (line.type === 'context') continue;
          if (range.oldRange && line.oldLineNumber !== null &&
              line.oldLineNumber >= range.oldRange[0] && line.oldLineNumber <= range.oldRange[1]) {
            indices.push(i);
            break;
          }
          if (range.newRange && line.newLineNumber !== null &&
              line.newLineNumber >= range.newRange[0] && line.newLineNumber <= range.newRange[1]) {
            indices.push(i);
            break;
          }
        }
      }
      return indices;
    };

    const STEP = 5;
    const MAX_CONTEXT = 99999;

    if (direction === 'up') {
      // Increase `above` for the first original hunk in currentHunk
      const indices = findOriginalIndices(currentHunk);
      if (indices.length > 0) {
        budgets[indices[0]].above += STEP;
      }
    } else if (direction === 'down') {
      // The hunk ABOVE the bar:
      //   bottom bar: hunkIndex IS the hunk above
      //   between bar: hunkIndex is the hunk below, so above = hunkIndex - 1
      const aboveIdx = position === 'bottom' ? hunkIndex : hunkIndex - 1;
      const aboveHunk = currentHunks[Math.max(0, aboveIdx)];
      const indices = findOriginalIndices(aboveHunk);
      if (indices.length > 0) {
        budgets[indices[indices.length - 1]].below += STEP;
      }
    } else {
      // 'all' — expand both sides fully
      if (position === 'top') {
        const indices = findOriginalIndices(currentHunk);
        if (indices.length > 0) budgets[indices[0]].above = MAX_CONTEXT;
      } else if (position === 'bottom') {
        const indices = findOriginalIndices(currentHunk);
        if (indices.length > 0) budgets[indices[indices.length - 1]].below = MAX_CONTEXT;
      } else {
        // between: expand below of hunk above AND above of hunk below
        const aboveHunk = currentHunks[hunkIndex - 1];
        const aboveIndices = findOriginalIndices(aboveHunk);
        if (aboveIndices.length > 0) budgets[aboveIndices[aboveIndices.length - 1]].below = MAX_CONTEXT;
        const belowIndices = findOriginalIndices(currentHunk);
        if (belowIndices.length > 0) budgets[belowIndices[0]].above = MAX_CONTEXT;
      }
    }

    // --- Pick scroll anchor ---
    const scrollContainer = document.querySelector<HTMLElement>(
      '[data-scroll-container="diff"]'
    );
    if (scrollContainer && sectionRef.current && currentHunks.length > 0) {
      let anchorLine: { lineNumber: number; side: 'old' | 'new' } | null = null;

      const getFirstLine = (hi: number) => {
        const line = currentHunks[hi].lines[0];
        return line.type === 'deletion'
          ? { lineNumber: line.oldLineNumber!, side: 'old' as const }
          : { lineNumber: line.newLineNumber!, side: 'new' as const };
      };
      const getLastLine = (hi: number) => {
        const lines = currentHunks[hi].lines;
        const line = lines[lines.length - 1];
        return line.type === 'deletion'
          ? { lineNumber: line.oldLineNumber!, side: 'old' as const }
          : { lineNumber: line.newLineNumber!, side: 'new' as const };
      };

      if (direction === 'up') {
        anchorLine = getFirstLine(hunkIndex);
      } else if (direction === 'down') {
        const aboveIdx = position === 'bottom' ? hunkIndex : hunkIndex - 1;
        anchorLine = getLastLine(Math.max(0, aboveIdx));
      } else {
        anchorLine = getFirstLine(hunkIndex);
      }

      if (anchorLine) {
        const selector = `[data-line-number="${anchorLine.lineNumber}"][data-line-side="${anchorLine.side}"]`;
        const anchorEl = sectionRef.current.querySelector<HTMLElement>(selector);
        if (anchorEl) {
          const containerRect = scrollContainer.getBoundingClientRect();
          const anchorRect = anchorEl.getBoundingClientRect();
          scrollCompensationRef.current = {
            anchorLineNumber: anchorLine.lineNumber,
            anchorSide: anchorLine.side,
            anchorOffsetFromContainerTop: anchorRect.top - containerRect.top,
            scrollTop: scrollContainer.scrollTop,
          };
        }
      }
    }

    // --- Fetch (if needed) and trim ---
    const maxBudget = Math.max(...budgets.flatMap(b => [b.above, b.below]), 0);

    setExpandLoading(true);

    let rawHunks: DiffHunk[] | null = null;
    let newTotalLines = totalLinesRef.current;

    if (maxBudget > lastRequestedContextRef.current || !rawHunksRef.current) {
      // Need fresh data from git
      const result = await expandFileContext(filePath, maxBudget);
      if (!result) {
        setExpandLoading(false);
        scrollCompensationRef.current = null;
        return;
      }
      rawHunks = result.hunks;
      if (result.totalLines > 0) newTotalLines = result.totalLines;
      rawHunksRef.current = rawHunks;
      lastRequestedContextRef.current = maxBudget;
    } else {
      // Re-trim existing cached data
      rawHunks = rawHunksRef.current;
    }

    const trimmed = trimHunkContext(rawHunks, originalRanges, budgets);
    updateFileHunks(filePath, trimmed);
    setTotalLines(newTotalLines);
    setExpandLoading(false);
  }, [isExpandable, filePath, expandFileContext, updateFileHunks]);

  return { expandLoading, totalLines, handleExpandContext };
}
