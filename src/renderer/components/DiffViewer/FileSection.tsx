import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import type { DiffFile, DiffHunk } from '../../../shared/types';
import { useReview } from '../../context/ReviewContext';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import {
  ChevronDown,
  ChevronRight,
  MessageSquare,
  CircleDashed,
  CircleCheck,
} from 'lucide-react';
import SplitView from './SplitView';
import UnifiedView from './UnifiedView';
import RenderedMarkdownView from './RenderedMarkdownView';
import CommentInput from '../Comments/CommentInput';
import CommentDisplay from '../Comments/CommentDisplay';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import {
  trimHunkContext,
  getHunkChangeRange,
  countLeadingContext,
  countTrailingContext,
  type HunkChangeRange,
  type HunkContextBudget,
} from './diff-utils';

export interface FileSectionProps {
  file: DiffFile;
  viewMode: 'split' | 'unified';
  expanded?: boolean;
  onToggleExpanded?: (filePath: string) => void;
}

export default function FileSection({
  file,
  viewMode,
  expanded: controlledExpanded,
  onToggleExpanded,
}: FileSectionProps) {
  const { toggleViewed, getCommentsForFile, files, diffSource, expandFileContext, updateFileHunks } = useReview();
  const [internalExpanded, setInternalExpanded] = useState(true);
  const expanded =
    controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  const [commentRange, setCommentRange] = useState<{
    start: number;
    end: number;
    side: 'old' | 'new';
  } | null>(null);
  const [dragState, setDragState] = useState<{
    startLine: number;
    currentLine: number;
    side: 'old' | 'new';
  } | null>(null);
  const [showingFileComment, setShowingFileComment] = useState(false);
  const [markdownViewMode, setMarkdownViewMode] = useState<'raw' | 'rendered'>('raw');
  const sectionRef = useRef<HTMLDivElement>(null);

  const isEligibleForRenderedView = file.changeType === 'added' && /\.(md|markdown)$/i.test(file.newPath || file.oldPath || '');

  const filePath = file.newPath || file.oldPath;
  const comments = getCommentsForFile(filePath);
  const fileComments = comments.filter(c => c.lineRange === null);
  const fileState = files.find(f => f.path === filePath);
  const isViewed = fileState?.viewed || false;

  // Expand context state
  const isExpandable = diffSource.type === 'git' && !file.isUntracked && !file.isBinary;
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

  const handleExpandContext = useCallback(async (direction: 'up' | 'down' | 'all', hunkIndex: number, position: 'top' | 'between' | 'bottom') => {
    if (!isExpandable || expandLoading) return;
    const budgets = hunkBudgetsRef.current;
    const originalRanges = originalRangesRef.current;
    if (!budgets || !originalRanges) return;

    // --- Update per-hunk budgets for the clicked direction ---
    // Map current hunkIndex back to original hunk indices via change ranges.
    const currentHunk = file.hunks[hunkIndex];
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
      const aboveHunk = file.hunks[Math.max(0, aboveIdx)];
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
        const aboveHunk = file.hunks[hunkIndex - 1];
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
    if (scrollContainer && sectionRef.current && file.hunks.length > 0) {
      let anchorLine: { lineNumber: number; side: 'old' | 'new' } | null = null;

      const getFirstLine = (hi: number) => {
        const line = file.hunks[hi].lines[0];
        return line.type === 'deletion'
          ? { lineNumber: line.oldLineNumber!, side: 'old' as const }
          : { lineNumber: line.newLineNumber!, side: 'new' as const };
      };
      const getLastLine = (hi: number) => {
        const lines = file.hunks[hi].lines;
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
    let newTotalLines = totalLines;

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
  }, [isExpandable, expandLoading, filePath, expandFileContext, updateFileHunks, file.hunks, totalLines]);

  // Effective view mode: added/deleted files are forced to unified view even when viewMode is 'split'
  const effectiveViewMode = viewMode === 'split' && (file.changeType === 'added' || file.changeType === 'deleted')
    ? 'unified'
    : viewMode;

  // Build lookup map for hunk boundaries (line number + side -> hunk bounds)
  const hunkLineMap = useMemo(() => {
    const map = new Map<
      string,
      { hunkIndex: number; minLine: number; maxLine: number }
    >();
    file.hunks.forEach((hunk, hunkIndex) => {
      let minOld = Infinity,
        maxOld = -Infinity;
      let minNew = Infinity,
        maxNew = -Infinity;
      for (const line of hunk.lines) {
        if (line.oldLineNumber !== null) {
          minOld = Math.min(minOld, line.oldLineNumber);
          maxOld = Math.max(maxOld, line.oldLineNumber);
        }
        if (line.newLineNumber !== null) {
          minNew = Math.min(minNew, line.newLineNumber);
          maxNew = Math.max(maxNew, line.newLineNumber);
        }
      }
      for (const line of hunk.lines) {
        if (line.oldLineNumber !== null) {
          map.set(`old-${line.oldLineNumber}`, {
            hunkIndex,
            minLine: minOld,
            maxLine: maxOld,
          });
        }
        if (line.newLineNumber !== null) {
          map.set(`new-${line.newLineNumber}`, {
            hunkIndex,
            minLine: minNew,
            maxLine: maxNew,
          });
        }
      }
    });
    return map;
  }, [file]);

  // Build row-index mapping for unified view cross-type drag
  const unifiedRowMap = useMemo(() => {
    if (effectiveViewMode !== 'unified') return null;
    const map = new Map<
      number,
      { lineNumber: number; side: 'old' | 'new'; hunkIndex: number }
    >();
    let rowIndex = 0;
    file.hunks.forEach((hunk, hunkIdx) => {
      for (const line of hunk.lines) {
        const ln =
          line.type === 'deletion' ? line.oldLineNumber! : line.newLineNumber!;
        const s: 'old' | 'new' = line.type === 'deletion' ? 'old' : 'new';
        map.set(rowIndex, { lineNumber: ln, side: s, hunkIndex: hunkIdx });
        rowIndex++;
      }
    });
    return map;
  }, [file, effectiveViewMode]);

  const hunkRowBounds = useMemo(() => {
    if (effectiveViewMode !== 'unified') return null;
    const bounds: { min: number; max: number }[] = [];
    let rowIndex = 0;
    for (const hunk of file.hunks) {
      bounds.push({ min: rowIndex, max: rowIndex + hunk.lines.length - 1 });
      rowIndex += hunk.lines.length;
    }
    return bounds;
  }, [file, effectiveViewMode]);

  // Refs for stable access in event handlers
  const dragStateRef = useRef(dragState);
  dragStateRef.current = dragState;
  const hunkLineMapRef = useRef(hunkLineMap);
  hunkLineMapRef.current = hunkLineMap;
  const unifiedRowMapRef = useRef(unifiedRowMap);
  unifiedRowMapRef.current = unifiedRowMap;
  const hunkRowBoundsRef = useRef(hunkRowBounds);
  hunkRowBoundsRef.current = hunkRowBounds;
  const viewModeRef = useRef(effectiveViewMode);
  viewModeRef.current = effectiveViewMode;

  // Sync viewed state with expansion: when viewed is checked, collapse the file
  useEffect(() => {
    if (isViewed && expanded && onToggleExpanded) {
      onToggleExpanded(filePath);
    }
  }, [isViewed]);

  const handleViewedToggle = () => {
    toggleViewed(filePath);
    // If checking as viewed, collapse the file
    if (!isViewed && expanded && onToggleExpanded) {
      onToggleExpanded(filePath);
    }
    // If unchecking viewed, expand the file
    if (isViewed && !expanded && onToggleExpanded) {
      onToggleExpanded(filePath);
    }
  };

  const handleCommentRange = (
    start: number,
    end: number,
    side: 'old' | 'new'
  ) => {
    setCommentRange({
      start: Math.min(start, end),
      end: Math.max(start, end),
      side,
    });
    setDragState(null);
  };

  const handleCancelComment = () => {
    setCommentRange(null);
    setDragState(null);
  };

  const handleCommentSaved = () => {
    setCommentRange(null);
  };

  const handleDragStart = (lineNumber: number, side: 'old' | 'new') => {
    const state = { startLine: lineNumber, currentLine: lineNumber, side };
    dragStateRef.current = state;
    setDragState(state);
  };

  // Document-level listeners for drag — registered on mount, check ref inside.
  // This avoids timing issues between React state updates and listener registration.
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const ds = dragStateRef.current;
      if (!ds) return;

      // Find line element under cursor
      let lineEl: HTMLElement | null = null;

      // Fast path: elementFromPoint
      const target = document.elementFromPoint(e.clientX, e.clientY);
      lineEl = target?.closest(
        '[data-line-number]'
      ) as HTMLElement | null;

      // Fallback: search within the file section for element at coordinates
      if (!lineEl && sectionRef.current) {
        const candidates = sectionRef.current.querySelectorAll<HTMLElement>(
          '[data-line-number]'
        );
        for (const el of candidates) {
          const rect = el.getBoundingClientRect();
          if (
            e.clientY >= rect.top &&
            e.clientY <= rect.bottom &&
            e.clientX >= rect.left &&
            e.clientX <= rect.right
          ) {
            lineEl = el;
            break;
          }
        }
      }

      if (!lineEl) return;

      if (viewModeRef.current === 'unified') {
        // Unified mode: use row indices for cross-type drag
        const rowIndexAttr = lineEl.getAttribute('data-row-index');
        if (!rowIndexAttr) return;
        const rowIndex = parseInt(rowIndexAttr, 10);
        if (isNaN(rowIndex)) return;

        const rowMap = unifiedRowMapRef.current;
        const bounds = hunkRowBoundsRef.current;
        if (!rowMap || !bounds) return;

        const startInfo = rowMap.get(ds.startLine);
        if (!startInfo) return;
        const hunkBounds = bounds[startInfo.hunkIndex];
        const clamped = Math.max(
          hunkBounds.min,
          Math.min(hunkBounds.max, rowIndex)
        );
        setDragState(prev => {
          const next = prev ? { ...prev, currentLine: clamped } : null;
          dragStateRef.current = next;
          return next;
        });
      } else {
        // Split mode: use line numbers with side matching
        const lineNumber = parseInt(
          lineEl.getAttribute('data-line-number')!,
          10
        );
        const side = lineEl.getAttribute('data-line-side') as 'old' | 'new';
        if (!isNaN(lineNumber) && side === ds.side) {
          const startKey = `${ds.side}-${ds.startLine}`;
          const hunkInfo = hunkLineMapRef.current.get(startKey);
          if (!hunkInfo) return;

          const clampedLine = Math.max(
            hunkInfo.minLine,
            Math.min(hunkInfo.maxLine, lineNumber)
          );
          setDragState(prev => {
            const next = prev ? { ...prev, currentLine: clampedLine } : null;
            dragStateRef.current = next;
            return next;
          });
        }
      }
    };

    const handleMouseUp = () => {
      const ds = dragStateRef.current;
      if (!ds) return;

      if (viewModeRef.current === 'unified' && unifiedRowMapRef.current) {
        // Convert row index range to real line range
        const minRow = Math.min(ds.startLine, ds.currentLine);
        const maxRow = Math.max(ds.startLine, ds.currentLine);
        const rowMap = unifiedRowMapRef.current;

        const newLines: number[] = [];
        const oldLines: number[] = [];
        for (let i = minRow; i <= maxRow; i++) {
          const info = rowMap.get(i);
          if (info) {
            if (info.side === 'new') newLines.push(info.lineNumber);
            else oldLines.push(info.lineNumber);
          }
        }

        // Prefer new side; fall back to old for deletion-only selections
        if (newLines.length > 0) {
          handleCommentRange(
            Math.min(...newLines),
            Math.max(...newLines),
            'new'
          );
        } else if (oldLines.length > 0) {
          handleCommentRange(
            Math.min(...oldLines),
            Math.max(...oldLines),
            'old'
          );
        }
      } else {
        const start = Math.min(ds.startLine, ds.currentLine);
        const end = Math.max(ds.startLine, ds.currentLine);
        handleCommentRange(start, end, ds.side);
      }
      dragStateRef.current = null;
      setDragState(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Listen for programmatic comment triggering from keyboard hint system
  useEffect(() => {
    const handler = (e: Event) => {
      const { filePath: targetFile, lineNumber, side } = (e as CustomEvent).detail;
      if (targetFile !== filePath) return;
      if (dragStateRef.current) return;
      handleCommentRange(lineNumber, lineNumber, side);
    };
    document.addEventListener('trigger-line-comment', handler);
    return () => document.removeEventListener('trigger-line-comment', handler);
  }, [filePath]);

  const handleAddFileComment = () => {
    setShowingFileComment(true);
  };

  const handleCancelFileComment = () => {
    setShowingFileComment(false);
  };

  const getChangeTypeStyle = () => {
    switch (file.changeType) {
      case 'added':
        return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400';
      case 'deleted':
        return 'bg-red-500/15 text-red-700 dark:text-red-400';
      case 'renamed':
        return 'bg-blue-500/15 text-blue-700 dark:text-blue-400';
      case 'modified':
        return 'bg-amber-500/15 text-amber-700 dark:text-amber-400';
      default:
        return '';
    }
  };

  const getLineStats = () => {
    let additions = 0;
    let deletions = 0;
    for (const hunk of file.hunks) {
      for (const line of hunk.lines) {
        if (line.type === 'addition') additions++;
        if (line.type === 'deletion') deletions++;
      }
    }
    return { additions, deletions };
  };

  const { additions, deletions } = getLineStats();
  const displayPath =
    file.changeType === 'renamed'
      ? `${file.oldPath} → ${file.newPath}`
      : filePath;
  const changeLabel =
    file.changeType.charAt(0).toUpperCase() + file.changeType.slice(1);

  return (
    <div
      ref={sectionRef}
      className={`border-b border-border${dragState ? ' select-none' : ''}`}
      data-file-path={filePath}
      data-testid={`file-section-${filePath}`}
    >
      {/* Header */}
      <div
        className='sticky top-0 z-10 flex items-center gap-2 h-10 px-3 bg-muted/50 backdrop-blur-sm border-b border-border cursor-pointer select-none'
        data-testid={`file-header-${filePath}`}
        onClick={() => {
          if (onToggleExpanded) {
            onToggleExpanded(filePath);
          } else {
            setInternalExpanded(!expanded);
          }
        }}
      >
        {/* Expand/collapse indicator */}
        <span className='text-muted-foreground' data-testid='collapse-toggle'>
          {expanded ? (
            <ChevronDown className='h-4 w-4' />
          ) : (
            <ChevronRight className='h-4 w-4' />
          )}
        </span>

        {/* File path */}
        <span className='font-mono text-[13px] font-medium truncate flex-1 min-w-0'>
          {displayPath}
        </span>

        {/* Change type */}
        <Badge
          variant='secondary'
          className={`text-[10px] font-semibold px-1.5 py-0 h-5 ${getChangeTypeStyle()}`}
        >
          {changeLabel}
        </Badge>

        {/* Line stats */}
        <span className='flex items-center gap-1 text-xs tabular-nums text-muted-foreground'>
          {additions > 0 && (
            <span className='text-emerald-600 dark:text-emerald-400'>
              +{additions}
            </span>
          )}
          {deletions > 0 && (
            <span className='text-red-600 dark:text-red-400'>-{deletions}</span>
          )}
        </span>

        {/* Raw/Rendered toggle for eligible markdown files */}
        {isEligibleForRenderedView && (
          <ToggleGroup
            type='single'
            value={markdownViewMode}
            onValueChange={(v) => v && setMarkdownViewMode(v as 'raw' | 'rendered')}
            size='sm'
            className='h-6'
            onClick={e => e.stopPropagation()}
          >
            <ToggleGroupItem value='raw' aria-label='Raw view' className='text-[10px] h-6 px-1.5'>
              Raw
            </ToggleGroupItem>
            <ToggleGroupItem value='rendered' aria-label='Rendered view' className='text-[10px] h-6 px-1.5'>
              Rendered
            </ToggleGroupItem>
          </ToggleGroup>
        )}

        {/* Comment count */}
        {comments.length > 0 && (
          <span className='inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums'>
            <MessageSquare className='h-3.5 w-3.5' />
            {comments.length}
          </span>
        )}

        <Separator orientation='vertical' className='h-5' />

        {/* Viewed toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='ghost'
              size='sm'
              data-testid={`viewed-${filePath}`}
              data-hint-action='toggle-viewed'
              data-hint-file-path={filePath}
              onClick={e => {
                e.stopPropagation();
                handleViewedToggle();
              }}
              className='h-7 w-7 p-0 text-muted-foreground hover:text-foreground'
            >
              {isViewed ? (
                <CircleCheck className='h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400' />
              ) : (
                <CircleDashed className='h-3.5 w-3.5' />
              )}
              <span className='sr-only'>
                {isViewed ? 'Done reviewing' : 'To review'}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isViewed ? 'Mark as needs review' : 'Mark as done reviewing'}
          </TooltipContent>
        </Tooltip>

        {/* Add file comment */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='ghost'
              size='sm'
              data-testid={`add-file-comment-${filePath}`}
              data-hint-action='add-file-comment'
              data-hint-file-path={filePath}
              onClick={e => {
                e.stopPropagation();
                handleAddFileComment();
              }}
              className='h-7 w-7 p-0 text-muted-foreground hover:text-foreground'
            >
              <MessageSquare className='h-3.5 w-3.5' />
              <span className='sr-only'>Add comment</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add file comment</TooltipContent>
        </Tooltip>
      </div>

      {/* Body */}
      {expanded && (
        <div className='bg-background file-diff-content'>
          {/* File-level comments */}
          {fileComments.length > 0 && (
            <div className='p-3 space-y-2 bg-muted/20 border-b border-border'>
              {fileComments.map(comment => (
                <CommentDisplay key={comment.id} comment={comment} />
              ))}
            </div>
          )}

          {/* File comment input */}
          {showingFileComment && (
            <div className='p-3 bg-muted/20 border-b border-border'>
              <CommentInput
                filePath={filePath}
                lineRange={null}
                onCancel={handleCancelFileComment}
                onSubmit={() => setShowingFileComment(false)}
              />
            </div>
          )}

          {/* Diff content */}
          {/* Force unified view for pure additions/deletions to avoid wasted empty pane in split view */}
          {file.isBinary ? (
            <div className='flex items-center justify-center py-12 text-sm text-muted-foreground'>
              Binary file — no diff available
            </div>
          ) : file.hunks.length === 0 ? (
            <div className='flex items-center justify-center py-12 text-sm text-muted-foreground'>
              No changes to display
            </div>
          ) : markdownViewMode === 'rendered' && isEligibleForRenderedView ? (
            <RenderedMarkdownView
              file={file}
              commentRange={commentRange}
              onCancelComment={handleCancelComment}
              onCommentSaved={handleCommentSaved}
              onGutterMouseDown={(startLine, endLine) => {
                handleCommentRange(startLine, endLine, 'new');
              }}
            />
          ) : viewMode === 'split' && file.changeType !== 'added' && file.changeType !== 'deleted' ? (
            <SplitView
              file={file}
              commentRange={commentRange}
              dragState={dragState}
              onDragStart={handleDragStart}
              onCancelComment={handleCancelComment}
              onCommentSaved={handleCommentSaved}
              onExpandContext={isExpandable ? handleExpandContext : undefined}
              isExpandable={isExpandable}
              expandLoading={expandLoading}
              totalLines={totalLines}
            />
          ) : (
            <UnifiedView
              file={file}
              commentRange={commentRange}
              dragState={dragState}
              onDragStart={handleDragStart}
              onCancelComment={handleCancelComment}
              onCommentSaved={handleCommentSaved}
              onExpandContext={isExpandable ? handleExpandContext : undefined}
              isExpandable={isExpandable}
              expandLoading={expandLoading}
              totalLines={totalLines}
            />
          )}
        </div>
      )}
    </div>
  );
}
