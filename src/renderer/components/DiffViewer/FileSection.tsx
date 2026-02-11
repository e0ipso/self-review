import React, { useState } from 'react';
import type { DiffFile, LineRange } from '../../../shared/types';
import { useReview } from '../../context/ReviewContext';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';
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

  const getChangeTypeBadge = () => {
    switch (file.changeType) {
      case 'added':
        return <Badge className="bg-green-500 text-white">Added</Badge>;
      case 'deleted':
        return <Badge className="bg-red-500 text-white">Deleted</Badge>;
      case 'renamed':
        return <Badge className="bg-blue-500 text-white">Renamed</Badge>;
      case 'modified':
        return <Badge className="bg-yellow-500 text-white">Modified</Badge>;
      default:
        return null;
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

  // Display path for renamed files
  const displayPath = file.changeType === 'renamed' ? `${file.oldPath} → ${file.newPath}` : filePath;

  return (
    <div className="border-b border-border" data-file-path={filePath} data-testid={`file-section-${filePath}`}>
      {/* Header bar */}
      <div className="bg-muted/30 px-4 py-3 flex items-center gap-3 border-t border-border" data-testid={`file-header-${filePath}`}>
        {/* Expand/collapse toggle */}
        <Button
          variant="ghost"
          size="sm"
          data-testid="collapse-toggle"
          onClick={() => {
            if (onToggleExpanded) {
              onToggleExpanded(filePath);
            } else {
              setInternalExpanded(!expanded);
            }
          }}
          className="p-1 h-auto"
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>

        {/* File path */}
        <span className="font-mono text-sm flex-1">{displayPath}</span>

        {/* Change type badge */}
        {getChangeTypeBadge()}

        {/* Line stats */}
        <span className="text-sm text-muted-foreground">
          <span className="text-green-600 dark:text-green-400">+{additions}</span>
          {' '}
          <span className="text-red-600 dark:text-red-400">-{deletions}</span>
        </span>

        {/* Comment count indicator */}
        {comments.length > 0 && (
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <MessageSquare className="h-4 w-4" />
            {comments.length}
          </span>
        )}

        {/* Viewed checkbox */}
        <div className="flex items-center gap-2">
          <Checkbox
            id={`viewed-${filePath}`}
            data-testid={`viewed-${filePath}`}
            onCheckedChange={() => toggleViewed(filePath)}
          />
          <label htmlFor={`viewed-${filePath}`} className="text-sm cursor-pointer">
            Viewed
          </label>
        </div>

        {/* Add file comment button */}
        <Button
          variant="outline"
          size="sm"
          data-testid={`add-file-comment-${filePath}`}
          onClick={handleAddFileComment}
          className="flex items-center gap-1"
        >
          <Plus className="h-4 w-4" />
          File comment
        </Button>
      </div>

      {/* Body */}
      {expanded && (
        <div className="bg-background file-diff-content">
          {/* File-level comments */}
          {fileComments.length > 0 && (
            <div className="border-b border-border">
              {fileComments.map((comment) => (
                <div key={comment.id} className="border-l-4 border-blue-500 bg-muted/30 p-4 m-4">
                  <CommentDisplay comment={comment} />
                </div>
              ))}
            </div>
          )}

          {/* File comment input */}
          {showingFileComment && (
            <div className="border-l-4 border-blue-500 bg-muted/30 p-4 m-4">
              <CommentInput
                filePath={filePath}
                lineRange={null}
                onCancel={handleCancelFileComment}
              />
            </div>
          )}

          {/* Diff content */}
          {file.isBinary ? (
            <div className="p-8 text-center text-muted-foreground">
              Binary file
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
