import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { DiffFile } from '../../../shared/types';
import { useReview } from '../../context/ReviewContext';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { ChevronDown, ChevronRight, MessageSquare, CircleDashed, CircleCheck } from 'lucide-react';
import SplitView from './SplitView';
import UnifiedView from './UnifiedView';
import CommentInput from '../Comments/CommentInput';
import CommentDisplay from '../Comments/CommentDisplay';

export interface FileSectionProps {
  file: DiffFile;
  viewMode: 'split' | 'unified';
  expanded?: boolean;
  onToggleExpanded?: (filePath: string) => void;
}

export default function FileSection({ file, viewMode, expanded: controlledExpanded, onToggleExpanded }: FileSectionProps) {
  const { toggleViewed, getCommentsForFile, files } = useReview();
  const [internalExpanded, setInternalExpanded] = useState(true);
  const expanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  const [commentRange, setCommentRange] = useState<{ start: number; end: number; side: 'old' | 'new' } | null>(null);
  const [dragState, setDragState] = useState<{ startLine: number; currentLine: number; side: 'old' | 'new' } | null>(null);
  const [showingFileComment, setShowingFileComment] = useState(false);

  const filePath = file.newPath || file.oldPath;
  const comments = getCommentsForFile(filePath);
  const fileComments = comments.filter((c) => c.lineRange === null);
  const fileState = files.find((f) => f.path === filePath);
  const isViewed = fileState?.viewed || false;

  // Build lookup map for hunk boundaries (line number + side -> hunk bounds)
  const hunkLineMap = useMemo(() => {
    const map = new Map<string, { hunkIndex: number; minLine: number; maxLine: number }>();
    file.hunks.forEach((hunk, hunkIndex) => {
      let minOld = Infinity, maxOld = -Infinity;
      let minNew = Infinity, maxNew = -Infinity;
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
          map.set(`old-${line.oldLineNumber}`, { hunkIndex, minLine: minOld, maxLine: maxOld });
        }
        if (line.newLineNumber !== null) {
          map.set(`new-${line.newLineNumber}`, { hunkIndex, minLine: minNew, maxLine: maxNew });
        }
      }
    });
    return map;
  }, [file]);

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

  const handleCommentRange = (start: number, end: number, side: 'old' | 'new') => {
    setCommentRange({ start: Math.min(start, end), end: Math.max(start, end), side });
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
    setDragState({ startLine: lineNumber, currentLine: lineNumber, side });
  };

  const handleDragMove = useCallback((lineNumber: number, side: 'old' | 'new') => {
    if (!dragState || dragState.side !== side) return;

    // Clamp to same hunk
    const startKey = `${dragState.side}-${dragState.startLine}`;
    const hunkInfo = hunkLineMap.get(startKey);
    if (!hunkInfo) return;

    const clampedLine = Math.max(hunkInfo.minLine, Math.min(hunkInfo.maxLine, lineNumber));
    setDragState(prev => prev ? { ...prev, currentLine: clampedLine } : null);
  }, [dragState, hunkLineMap]);

  const handleDragEnd = useCallback(() => {
    if (dragState) {
      const start = Math.min(dragState.startLine, dragState.currentLine);
      const end = Math.max(dragState.startLine, dragState.currentLine);
      handleCommentRange(start, end, dragState.side);
    }
    setDragState(null);
  }, [dragState]);

  // Document-level listeners for drag
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const lineEl = target?.closest('[data-line-number]') as HTMLElement | null;
      if (lineEl) {
        const lineNumber = parseInt(lineEl.getAttribute('data-line-number')!, 10);
        const side = lineEl.getAttribute('data-line-side') as 'old' | 'new';
        if (!isNaN(lineNumber) && side === dragState.side) {
          handleDragMove(lineNumber, side);
        }
      }
    };

    const handleMouseUp = () => {
      handleDragEnd();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, hunkLineMap, handleDragMove, handleDragEnd]);

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
  const displayPath = file.changeType === 'renamed' ? `${file.oldPath} → ${file.newPath}` : filePath;
  const changeLabel = file.changeType.charAt(0).toUpperCase() + file.changeType.slice(1);

  return (
    <div className={`border-b border-border${dragState ? ' select-none' : ''}`} data-file-path={filePath} data-testid={`file-section-${filePath}`}>
      {/* Header */}
      <div
        className="sticky top-0 z-10 flex items-center gap-2 h-10 px-3 bg-muted/50 backdrop-blur-sm border-b border-border cursor-pointer select-none"
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
        <span className="text-muted-foreground" data-testid="collapse-toggle">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>

        {/* File path */}
        <span className="font-mono text-[13px] font-medium truncate flex-1 min-w-0">
          {displayPath}
        </span>

        {/* Change type */}
        <Badge variant="secondary" className={`text-[10px] font-semibold px-1.5 py-0 h-5 ${getChangeTypeStyle()}`}>
          {changeLabel}
        </Badge>

        {/* Line stats */}
        <span className="flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
          {additions > 0 && (
            <span className="text-emerald-600 dark:text-emerald-400">+{additions}</span>
          )}
          {deletions > 0 && (
            <span className="text-red-600 dark:text-red-400">-{deletions}</span>
          )}
        </span>

        {/* Comment count */}
        {comments.length > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
            <MessageSquare className="h-3.5 w-3.5" />
            {comments.length}
          </span>
        )}

        <Separator orientation="vertical" className="h-5" />

        {/* Viewed toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              data-testid={`viewed-${filePath}`}
              onClick={(e) => {
                e.stopPropagation();
                handleViewedToggle();
              }}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            >
              {isViewed ? (
                <CircleCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <CircleDashed className="h-3.5 w-3.5" />
              )}
              <span className="sr-only">{isViewed ? 'Done reviewing' : 'To review'}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isViewed ? 'Mark as needs review' : 'Mark as done reviewing'}</TooltipContent>
        </Tooltip>

        {/* Add file comment */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              data-testid={`add-file-comment-${filePath}`}
              onClick={(e) => {
                e.stopPropagation();
                handleAddFileComment();
              }}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="sr-only">Add comment</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add file comment</TooltipContent>
        </Tooltip>
      </div>

      {/* Body */}
      {expanded && (
        <div className="bg-background file-diff-content">
          {/* File-level comments */}
          {fileComments.length > 0 && (
            <div className="p-3 space-y-2 bg-muted/20 border-b border-border">
              {fileComments.map((comment) => (
                <CommentDisplay key={comment.id} comment={comment} />
              ))}
            </div>
          )}

          {/* File comment input */}
          {showingFileComment && (
            <div className="p-3 bg-muted/20 border-b border-border">
              <CommentInput
                filePath={filePath}
                lineRange={null}
                onCancel={handleCancelFileComment}
              />
            </div>
          )}

          {/* Diff content */}
          {file.isBinary ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              Binary file — no diff available
            </div>
          ) : file.hunks.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              No changes to display
            </div>
          ) : viewMode === 'split' ? (
            <SplitView
              file={file}
              commentRange={commentRange}
              dragState={dragState}
              onDragStart={handleDragStart}
              onCancelComment={handleCancelComment}
              onCommentSaved={handleCommentSaved}
            />
          ) : (
            <UnifiedView
              file={file}
              commentRange={commentRange}
              dragState={dragState}
              onDragStart={handleDragStart}
              onCancelComment={handleCancelComment}
              onCommentSaved={handleCommentSaved}
            />
          )}
        </div>
      )}
    </div>
  );
}
