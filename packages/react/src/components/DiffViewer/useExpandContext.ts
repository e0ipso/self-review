import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { DiffFile, DiffHunk } from '@self-review/types';
import {
  useReviewCommands,
  useReviewSessionId,
  useReviewSnapshotId,
} from '../../context/ReviewContext';
import {
  trimHunkContext,
  getHunkChangeRange,
  countLeadingContext,
  countTrailingContext,
  type HunkChangeRange,
  type HunkContextBudget,
} from './diff-utils';
import { useAdapter } from '../../context/ReviewAdapterContext';
import { expandContext } from '../../read-service';
import { planExpansion } from './expansion-plan';
import { useExpansionScrollAnchor } from './useExpansionScrollAnchor';

interface UseExpandContextParams {
  file: DiffFile;
  filePath: string;
  isExpandable: boolean;
  sectionRef: React.RefObject<HTMLElement | null>;
  expanded?: boolean;
}

interface UseExpandContextResult {
  expandLoading: boolean;
  expandError?: boolean;
  totalLines: number | null;
  handleExpandContext: (
    direction: 'up' | 'down' | 'all',
    hunkIndex: number,
    position: 'top' | 'between' | 'bottom'
  ) => void;
}

export function useExpandContext({
  file,
  filePath,
  isExpandable,
  sectionRef,
  expanded = true,
}: UseExpandContextParams): UseExpandContextResult {
  const { isCurrentSession, updateFileHunks } = useReviewCommands();
  const adapter = useAdapter();
  const sessionId = useReviewSessionId();
  const snapshotId = useReviewSnapshotId();
  const [expandLoading, setExpandLoading] = useState(false);
  const [expandError, setExpandError] = useState(false);
  const [totalLines, setTotalLines] = useState<number | null>(null);

  // Per-hunk directional context budgets, raw hunk cache, and original change ranges.
  // Keyed by original hunk positions so they survive hunk merging from expansion.
  const originalRangesRef = useRef<HunkChangeRange[] | null>(null);
  const hunkBudgetsRef = useRef<HunkContextBudget[] | null>(null);
  const rawHunksRef = useRef<DiffHunk[] | null>(null);
  const lastRequestedContextRef = useRef<number>(0);

  const owner = useMemo(() => ({}), [sessionId, snapshotId, adapter, filePath]);
  const ownerRef = useRef(owner);
  const requestRef = useRef<AbortController | null>(null);
  const wanted = useRef(expanded);
  wanted.current = expanded;
  useEffect(
    () => () => {
      requestRef.current?.abort();
      requestRef.current = null;
      setExpandLoading(false);
      expandLoadingRef.current = false;
    },
    [owner, expanded]
  );
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const ownerChanged = ownerRef.current !== owner;
  if (ownerChanged) {
    ownerRef.current = owner;
    originalRangesRef.current = null;
    hunkBudgetsRef.current = null;
    rawHunksRef.current = null;
    lastRequestedContextRef.current = 0;
    setTotalLines(null);
    setExpandLoading(false);
    setExpandError(false);
  }

  // Initialize per-hunk tracking from the initial hunks (run once)
  if (originalRangesRef.current === null && file.hunks.length > 0) {
    originalRangesRef.current = file.hunks.map(h => getHunkChangeRange(h));
    hunkBudgetsRef.current = file.hunks.map(h => ({
      above: countLeadingContext(h),
      below: countTrailingContext(h),
    }));
    lastRequestedContextRef.current = Math.max(
      ...file.hunks.flatMap(h => [countLeadingContext(h), countTrailingContext(h)]),
      0
    );
  }

  const scrollAnchor = useExpansionScrollAnchor(sectionRef, file.hunks, owner);

  // Stable refs for callback dependencies
  const expandLoadingRef = useRef(expandLoading);
  expandLoadingRef.current = expandLoading;
  const fileHunksRef = useRef(file.hunks);
  fileHunksRef.current = file.hunks;
  const totalLinesRef = useRef(totalLines);
  totalLinesRef.current = totalLines;

  const handleExpandContext = useCallback(
    async (
      direction: 'up' | 'down' | 'all',
      hunkIndex: number,
      position: 'top' | 'between' | 'bottom'
    ) => {
      if (!isExpandable || !wanted.current || expandLoadingRef.current) return;
      setExpandError(false);
      const budgets = hunkBudgetsRef.current;
      const originalRanges = originalRangesRef.current;
      if (!budgets || !originalRanges) return;

      const currentHunks = fileHunksRef.current;

      const plan = planExpansion(
        currentHunks,
        originalRanges,
        budgets,
        direction,
        hunkIndex,
        position
      );
      hunkBudgetsRef.current = plan.budgets;
      scrollAnchor.capture(currentHunks, direction, hunkIndex, position);
      const { maxBudget } = plan;

      const requestOwner = ownerRef.current;
      const controller = new AbortController();
      requestRef.current = controller;
      const current = () =>
        mounted.current &&
        wanted.current &&
        ownerRef.current === requestOwner &&
        !controller.signal.aborted &&
        (isCurrentSession?.() ?? true);
      expandLoadingRef.current = true;
      setExpandLoading(true);

      let rawHunks: DiffHunk[] | null = null;
      let newTotalLines = totalLinesRef.current;

      if (maxBudget > lastRequestedContextRef.current || !rawHunksRef.current) {
        // Need fresh data from git
        let result = null;
        try {
          result = await expandContext(
            adapter,
            { filePath, contextLines: maxBudget },
            controller.signal
          );
        } catch {
          // Genuine failures retain manual retry; obsolete requests never become errors.
        }
        if (!current()) return;
        if (!result) {
          setExpandError(true);
          setExpandLoading(false);
          expandLoadingRef.current = false;
          scrollAnchor.clear();
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

      if (!current()) return;
      const trimmed = trimHunkContext(rawHunks, originalRanges, plan.budgets);
      updateFileHunks(filePath, trimmed);
      setTotalLines(newTotalLines);
      setExpandLoading(false);
      expandLoadingRef.current = false;
    },
    [isExpandable, filePath, adapter, isCurrentSession, updateFileHunks, scrollAnchor]
  );

  return { expandLoading, expandError, totalLines, handleExpandContext };
}
