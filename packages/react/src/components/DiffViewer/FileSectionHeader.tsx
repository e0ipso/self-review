import React, { useState, useEffect, useRef } from 'react';
import type { DiffFile, ReviewComment } from '@self-review/types';
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
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { getFileStats, getChangeTypeInfo } from '../../utils/diff-styles';

export interface FileSectionHeaderProps {
  file: DiffFile;
  filePath: string;
  expanded: boolean;
  isViewed: boolean;
  isPreviewable: boolean;
  renderViewMode: 'raw' | 'rendered';
  comments: ReviewComment[];
  onToggle: () => void;
  onViewedToggle: () => void;
  onAddFileComment: () => void;
  onRenderViewModeChange: (mode: 'raw' | 'rendered') => void;
}

export function FileSectionHeader({
  file,
  filePath,
  expanded,
  isViewed,
  isPreviewable,
  renderViewMode,
  comments,
  onToggle,
  onViewedToggle,
  onAddFileComment,
  onRenderViewModeChange,
}: FileSectionHeaderProps) {
  const { additions, deletions } = getFileStats(file);
  const displayPath =
    file.changeType === 'renamed'
      ? `${file.oldPath} → ${file.newPath}`
      : filePath;
  const changeLabel =
    file.changeType.charAt(0).toUpperCase() + file.changeType.slice(1);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isStuck, setIsStuck] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsStuck(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <>
    <div ref={sentinelRef} className='h-0 w-0' aria-hidden />
    <div
      className={`sticky top-0 z-10 flex items-center gap-2 h-10 px-3 bg-muted/80 backdrop-blur-sm border-b border-border cursor-pointer select-none${isStuck ? '' : ' rounded-t-lg'}`}
      data-testid={`file-header-${filePath}`}
      onClick={onToggle}
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
          onValueChange={(v) => v && onRenderViewModeChange(v as 'raw' | 'rendered')}
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
              onViewedToggle();
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
              onAddFileComment();
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
    </>
  );
}
