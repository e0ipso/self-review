import React, { useState, useEffect, useRef } from 'react';
import { useDragSelection } from './useDragSelection';
import { useExpandContext } from './useExpandContext';
import type { DiffFile } from '@self-review/core';
import { useReview } from '../../context/ReviewContext';
import { useAdapter } from '../../context/ReviewAdapterContext';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  MessageSquare,
  CircleDashed,
  CircleCheck,
} from 'lucide-react';
import SplitView from './SplitView';
import UnifiedView from './UnifiedView';
import RenderedMarkdownView from './RenderedMarkdownView';
import RenderedImageView from './RenderedImageView';
import RenderedSvgView from './RenderedSvgView';
import { isPreviewableImage, isPreviewableSvg } from '@self-review/core';
import CommentInput from '../Comments/CommentInput';
import CommentDisplay from '../Comments/CommentDisplay';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { getFileStats, getChangeTypeInfo } from '../../utils/diff-styles';

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
  const { toggleViewed, getCommentsForFile, files, diffSource, updateFileHunks } = useReview();
  const adapter = useAdapter();
  const [internalExpanded, setInternalExpanded] = useState(true);
  const expanded =
    controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  const [commentRange, setCommentRange] = useState<{
    start: number;
    end: number;
    side: 'old' | 'new';
  } | null>(null);
  const [showingFileComment, setShowingFileComment] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  const isAddedFile = file.changeType === 'added';
  const filePath_ = file.newPath || file.oldPath || '';
  const showImagePreview = isAddedFile && file.isBinary === true && isPreviewableImage(filePath_);
  const showSvgPreview = isAddedFile && isPreviewableSvg(filePath_);
  const isEligibleForRenderedView = isAddedFile && /\.(md|markdown)$/i.test(filePath_);
  const isPreviewable = showImagePreview || showSvgPreview || isEligibleForRenderedView;

  const initialViewMode = isPreviewable ? 'rendered' : 'raw';
  const [renderViewMode, setRenderViewMode] = useState<'raw' | 'rendered'>(initialViewMode);

  const filePath = file.newPath || file.oldPath;
  const comments = getCommentsForFile(filePath);
  const fileComments = comments.filter(c => c.lineRange === null);
  const fileState = files.find(f => f.path === filePath);
  const isViewed = fileState?.viewed || false;

  // Lazy content loading state (for large-payload mode)
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState(false);

  useEffect(() => {
    if (!expanded || file.contentLoaded !== false || contentLoading) return;
    if (!adapter?.loadFileContent) return;

    setContentLoading(true);
    setContentError(false);

    adapter.loadFileContent(filePath).then(hunks => {
      if (hunks) {
        updateFileHunks(filePath, hunks);
      } else {
        setContentError(true);
      }
      setContentLoading(false);
    }).catch(() => {
      setContentError(true);
      setContentLoading(false);
    });
  }, [expanded, file.contentLoaded, contentLoading, filePath, updateFileHunks, adapter]);

  // Expand context state
  const isExpandable = diffSource.type === 'git' && !file.isUntracked && !file.isBinary;

  const { expandLoading, totalLines, handleExpandContext } = useExpandContext({
    file,
    filePath,
    isExpandable,
    sectionRef,
  });

  // Effective view mode: added/deleted files are forced to unified view even when viewMode is 'split'
  const effectiveViewMode = viewMode === 'split' && (file.changeType === 'added' || file.changeType === 'deleted')
    ? 'unified'
    : viewMode;

  const handleCommentRange = (start: number, end: number, side: 'old' | 'new') => {
    setCommentRange({
      start: Math.min(start, end),
      end: Math.max(start, end),
      side,
    });
  };

  const { dragState, handleDragStart } = useDragSelection({
    sectionRef,
    effectiveViewMode,
    file,
    filePath,
    onCommentRange: handleCommentRange,
  });

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

  const handleCancelComment = () => {
    setCommentRange(null);
  };

  const handleCommentSaved = () => {
    setCommentRange(null);
  };

  const handleAddFileComment = () => {
    setShowingFileComment(true);
  };

  const handleCancelFileComment = () => {
    setShowingFileComment(false);
  };

  const { additions, deletions } = getFileStats(file);
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
          className={`text-[10px] font-semibold px-1.5 py-0 h-5 ${getChangeTypeInfo(file.changeType).className}`}
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

        {/* Raw/Rendered toggle for eligible files (markdown, images, SVGs) */}
        {isPreviewable && (
          <ToggleGroup
            type='single'
            value={renderViewMode}
            onValueChange={(v) => v && setRenderViewMode(v as 'raw' | 'rendered')}
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
          {contentLoading ? (
            <div className='flex items-center justify-center py-12 text-sm text-muted-foreground'>
              <Loader2 className='h-4 w-4 animate-spin mr-2' />
              Loading file content...
            </div>
          ) : contentError ? (
            <div className='flex flex-col items-center justify-center py-12 text-sm text-muted-foreground gap-2'>
              <span>Failed to load file content</span>
              <Button variant='outline' size='sm' onClick={() => {
                setContentError(false);
              }}>
                Retry
              </Button>
            </div>
          ) : showImagePreview && renderViewMode === 'rendered' ? (
            <RenderedImageView
              filePath={filePath ?? ''}
              onLoadImage={adapter?.loadImage}
            />
          ) : showSvgPreview && renderViewMode === 'rendered' ? (
            <RenderedSvgView file={file} />
          ) : file.isBinary ? (
            <div className='flex items-center justify-center py-12 text-sm text-muted-foreground'>
              Binary file — no diff available
            </div>
          ) : file.hunks.length === 0 && file.contentLoaded !== false ? (
            <div className='flex items-center justify-center py-12 text-sm text-muted-foreground'>
              No changes to display
            </div>
          ) : renderViewMode === 'rendered' && isEligibleForRenderedView ? (
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
