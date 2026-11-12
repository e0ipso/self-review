import { useAdapter } from '../../context/ReviewAdapterContext';
import { writeClipboard } from '../../utils/clipboard';
import { useOptionalSnapshotKey } from '../../context/ReviewContext';
import { useLocalization } from '../../localization/LocalizationContext';
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
  Copy,
  Check,
} from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { getFileStats, getChangeTypeInfo } from '../../utils/diff-styles';

export interface FileSectionHeaderProps {
  bodyId?: string;
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

/** Compatibility facade: comments remains a required exported property. */
export function FileSectionHeader({ comments, ...props }: FileSectionHeaderProps) {
  return <FileSectionHeaderPresentation {...props} commentCount={comments.length} />;
}

/** Internal first-party presentation only needs the count, never comment entities. */
export function FileSectionHeaderPresentation({
  bodyId,
  file,
  filePath,
  expanded,
  isViewed,
  isPreviewable,
  renderViewMode,
  commentCount,
  onToggle,
  onViewedToggle,
  onAddFileComment,
  onRenderViewModeChange,
}: Omit<FileSectionHeaderProps, 'comments'> & { commentCount: number }) {
  const { t, number } = useLocalization();
  const { additions, deletions } = getFileStats(file);
  const hasSourcePath = file.changeType === 'renamed' || file.changeType === 'copied';
  const displayPath = hasSourcePath
    ? `${file.oldPath} → ${file.newPath}`
    : // The empty path is the review-level sentinel (forge threads without an anchor).
      filePath || t('Review-level comments');
  const changeLabel =
    getChangeTypeInfo(file.changeType).label === '?' ? t('unknown') : t(file.changeType);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isStuck, setIsStuck] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const adapter = useAdapter();
  const snapshot = useOptionalSnapshotKey();
  const copyOwner = useRef(0);
  useEffect(() => {
    copyOwner.current++;
    setCopied(false);
    setCopyError(false);
    return () => {
      copyOwner.current++;
    };
  }, [filePath, adapter, snapshot]);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const copyPath = async () => {
    const pathToCopy = hasSourcePath ? file.newPath : filePath;
    const owner = ++copyOwner.current;
    setCopyError(false);
    try {
      await writeClipboard(pathToCopy, adapter);
      if (copyOwner.current !== owner) return;
      setCopied(true);
    } catch {
      if (copyOwner.current === owner) setCopyError(true);
    }
  };

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => setIsStuck(!entry.isIntersecting), {
      threshold: 0,
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {copyError && (
        <p role='alert' className='px-3 text-sm text-destructive'>
          {t('The path could not be copied. Try again or copy it manually.')}
        </p>
      )}
      <div ref={sentinelRef} className='h-0 w-0' aria-hidden />
      <div
        className={`sticky top-0 z-10 flex items-center gap-2 h-10 px-3 bg-muted/80 backdrop-blur-sm border-b border-border cursor-pointer select-none${isStuck ? '' : ' rounded-t-lg'}`}
        data-testid={`file-header-${filePath}`}
        onClick={onToggle}
      >
        <Button
          variant='ghost'
          className='h-auto min-w-0 flex-1 justify-start gap-2 p-0 text-start'
          aria-expanded={expanded}
          aria-controls={bodyId}
          aria-label={t(expanded ? 'Collapse {path}' : 'Expand {path}', { path: displayPath })}
          onClick={event => {
            event.stopPropagation();
            onToggle();
          }}
        >
          <span className='text-muted-foreground' data-testid='collapse-toggle'>
            {expanded ? <ChevronDown className='h-4 w-4' /> : <ChevronRight className='h-4 w-4' />}
          </span>
          <span className='font-mono text-[13px] font-medium truncate flex-1 min-w-0'>
            {displayPath}
          </span>
        </Button>

        {/* Copy file path */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='ghost'
              size='sm'
              data-testid={`copy-file-path-${filePath}`}
              onClick={e => {
                e.stopPropagation();
                copyPath();
              }}
              className='h-7 w-7 p-0 text-muted-foreground hover:text-foreground'
            >
              {copied ? (
                <Check className='h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400' />
              ) : (
                <Copy className='h-3.5 w-3.5' />
              )}
              <span className='sr-only'>{t('Copy file path')}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t(copied ? 'Copied!' : 'Copy file path')}</TooltipContent>
        </Tooltip>

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
            <span className='text-emerald-600 dark:text-emerald-400'>+{number(additions)}</span>
          )}
          {deletions > 0 && (
            <span className='text-red-600 dark:text-red-400'>-{number(deletions)}</span>
          )}
        </span>

        {/* Raw/Rendered toggle for eligible files (markdown, images, SVGs) */}
        {isPreviewable && (
          <ToggleGroup
            type='single'
            value={renderViewMode}
            onValueChange={v => v && onRenderViewModeChange(v as 'raw' | 'rendered')}
            size='sm'
            className='h-6'
            onClick={e => e.stopPropagation()}
          >
            <ToggleGroupItem
              value='raw'
              aria-label={t('Raw view')}
              className='text-[10px] h-6 px-1.5'
            >
              {t('Raw')}
            </ToggleGroupItem>
            <ToggleGroupItem
              value='rendered'
              aria-label={t('Rendered view')}
              className='text-[10px] h-6 px-1.5'
            >
              {t('Rendered')}
            </ToggleGroupItem>
          </ToggleGroup>
        )}

        {/* Comment count */}
        {commentCount > 0 && (
          <span className='inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums'>
            <MessageSquare className='h-3.5 w-3.5' />
            {number(commentCount)}
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
              aria-pressed={isViewed}
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
              <span className='sr-only'>{t(isViewed ? 'Done reviewing' : 'To review')}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {t(isViewed ? 'Mark as needs review' : 'Mark as done reviewing')}
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
              <span className='sr-only'>{t('Add comment')}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('Add file comment')}</TooltipContent>
        </Tooltip>
      </div>
    </>
  );
}
