import { useState, useEffect, useRef, useMemo } from 'react';
import type { DiffFile } from '@self-review/core';

export type DragState = {
  startLine: number;
  currentLine: number;
  side: 'old' | 'new';
} | null;

export type CommentRange = {
  start: number;
  end: number;
  side: 'old' | 'new';
};

interface UseDragSelectionParams {
  sectionRef: React.RefObject<HTMLElement>;
  effectiveViewMode: 'split' | 'unified';
  file: DiffFile;
  filePath: string;
  onCommentRange: (start: number, end: number, side: 'old' | 'new') => void;
}

interface UseDragSelectionResult {
  dragState: DragState;
  handleDragStart: (lineNumber: number, side: 'old' | 'new') => void;
}

export function useDragSelection({
  sectionRef,
  effectiveViewMode,
  file,
  filePath,
  onCommentRange,
}: UseDragSelectionParams): UseDragSelectionResult {
  const [dragState, setDragState] = useState<DragState>(null);

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

  // Stable refs for access in event handlers
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
  const onCommentRangeRef = useRef(onCommentRange);
  onCommentRangeRef.current = onCommentRange;

  const handleDragStart = (lineNumber: number, side: 'old' | 'new') => {
    const state = { startLine: lineNumber, currentLine: lineNumber, side };
    dragStateRef.current = state;
    setDragState(state);
  };

  // Document-level listeners for drag — registered on mount, check ref inside.
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const ds = dragStateRef.current;
      if (!ds) return;

      // Find line element under cursor
      let lineEl: HTMLElement | null = null;

      // Fast path: elementFromPoint
      const target = document.elementFromPoint(e.clientX, e.clientY);
      lineEl = target?.closest('[data-line-number]') as HTMLElement | null;

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
          onCommentRangeRef.current(
            Math.min(...newLines),
            Math.max(...newLines),
            'new'
          );
        } else if (oldLines.length > 0) {
          onCommentRangeRef.current(
            Math.min(...oldLines),
            Math.max(...oldLines),
            'old'
          );
        }
      } else {
        const start = Math.min(ds.startLine, ds.currentLine);
        const end = Math.max(ds.startLine, ds.currentLine);
        onCommentRangeRef.current(start, end, ds.side);
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
      onCommentRangeRef.current(lineNumber, lineNumber, side);
    };
    document.addEventListener('trigger-line-comment', handler);
    return () => document.removeEventListener('trigger-line-comment', handler);
  }, [filePath]);

  return { dragState, handleDragStart };
}
