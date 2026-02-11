import React, { useState } from 'react';
import type { DiffFile, LineRange } from '../../../shared/types';
import { useReview } from '../../context/ReviewContext';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { ChevronDown, ChevronRight, MessageSquare, Plus } from 'lucide-react';
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
  const { toggleViewed, getCommentsForFile } = useReview();
  const [internalExpanded, setInternalExpanded] = useState(true);
  const expanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  const [commentingLine, setCommentingLine] = useState<{ lineNumber: number; side: 'old' | 'new' } | null>(null);
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number; side: 'old' | 'new' } | null>(null);
  const [showingFileComment, setShowingFileComment] = useState(false);

  const filePath = file.newPath || file.oldPath;
  const comments = getCommentsForFile(filePath);
  const fileComments = comments.filter((c) => c.lineRange === null);

  const handleLineClick = (lineNumber: number, side: 'old' | 'new') => {
    setCommentingLine({ lineNumber, side });
    setSelectionRange(null);
  };

  const handleLineRangeSelect = (start: number, end: number, side: 'old' | 'new') => {
    setSelectionRange({ start, end, side });
    setCommentingLine(null);
  };

  const handleCancelComment = () => {
    setCommentingLine(null);
    setSelectionRange(null);
  };

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
    <div className="border-b border-border" data-file-path={filePath} data-testid={`file-section-${filePath}`}>
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

        {/* Viewed checkbox */}
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            id={`viewed-${filePath}`}
            data-testid={`viewed-${filePath}`}
            onCheckedChange={() => toggleViewed(filePath)}
            className="h-3.5 w-3.5"
          />
          <label htmlFor={`viewed-${filePath}`} className="text-xs text-muted-foreground cursor-pointer">
            Viewed
          </label>
        </div>

        {/* Add file comment */}
        <Button
          variant="ghost"
          size="sm"
          data-testid={`add-file-comment-${filePath}`}
          onClick={(e) => {
            e.stopPropagation();
            handleAddFileComment();
          }}
          className="h-7 px-2 gap-1 text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="text-xs">Comment</span>
        </Button>
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
          ) : viewMode === 'split' ? (
            <SplitView
              file={file}
              commentingLine={commentingLine}
              selectionRange={selectionRange}
              onLineClick={handleLineClick}
              onLineRangeSelect={handleLineRangeSelect}
              onCancelComment={handleCancelComment}
            />
          ) : (
            <UnifiedView
              file={file}
              commentingLine={commentingLine}
              selectionRange={selectionRange}
              onLineClick={handleLineClick}
              onLineRangeSelect={handleLineRangeSelect}
              onCancelComment={handleCancelComment}
            />
          )}
        </div>
      )}
    </div>
  );
}
