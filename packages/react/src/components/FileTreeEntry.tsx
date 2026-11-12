import { useLocalization } from '../localization/LocalizationContext';
import React from 'react';
import { Button } from './ui/button';
import type { DiffFile } from '@self-review/types';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { CircleDashed, CircleCheck, MessageSquare } from 'lucide-react';
import { getFileStats, getChangeTypeInfo } from '../utils/diff-styles';
import TruncatedPath from './TruncatedPath';

export interface FileTreeEntryProps {
  file: DiffFile;
  isActive: boolean;
  commentCount: number;
  viewed: boolean;
  /** Guide-authored one-liner shown as a secondary line (Guided mode only). */
  guideDescription?: string;
  onScrollToFile: (filePath: string) => void;
  onToggleViewed: (filePath: string) => void;
}

export const FileTreeEntry = React.memo(function FileTreeEntry({
  file,
  isActive,
  commentCount,
  viewed,
  guideDescription,
  onScrollToFile,
  onToggleViewed,
}: FileTreeEntryProps) {
  const { t, number } = useLocalization();
  const filePath = file.newPath || file.oldPath;
  const stats = getFileStats(file);
  const changeType = getChangeTypeInfo(file.changeType);

  return (
    <Tooltip key={filePath}>
      <TooltipTrigger asChild>
        <div className='flex items-center rounded-md'>
          <Button
            variant='ghost'
            data-testid={`file-entry-${filePath}`}
            data-file-path={filePath}
            aria-current={isActive ? 'true' : undefined}
            onClick={() => onScrollToFile(filePath)}
            className={`h-auto min-w-0 flex-1 flex-col items-stretch text-start px-2 py-1.5 rounded-md transition-colors cursor-pointer ${
              isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50 text-foreground'
            }`}
          >
            <div className='flex items-center gap-1.5 min-w-0'>
              {/* Change type indicator */}
              <span
                className={`change-type-badge flex-shrink-0 inline-flex items-center justify-center w-[18px] h-[18px] rounded-sm text-[10px] font-bold leading-none ${changeType.className}`}
              >
                {changeType.label}
              </span>

              {/* File path */}
              <TruncatedPath path={filePath || t('Review-level comments')} />

              {/* Indicators */}
              <div className='flex items-center gap-1 flex-shrink-0'>
                {stats.additions > 0 && (
                  <span className='text-[10px] tabular-nums font-medium text-emerald-600 dark:text-emerald-400'>
                    +{number(stats.additions)}
                  </span>
                )}
                {stats.deletions > 0 && (
                  <span className='text-[10px] tabular-nums font-medium text-red-600 dark:text-red-400'>
                    -{number(stats.deletions)}
                  </span>
                )}
                {commentCount > 0 && (
                  <span className='inline-flex items-center gap-0.5 text-muted-foreground'>
                    <MessageSquare className='h-3 w-3' />
                    <span className='text-[10px] tabular-nums'>{number(commentCount)}</span>
                  </span>
                )}
              </div>
            </div>
            {guideDescription && (
              <div
                className='ps-6 pe-1 mt-1 text-[11px] leading-snug text-muted-foreground/90 line-clamp-2'
                data-testid={`guide-file-description-${filePath}`}
              >
                {guideDescription}
              </div>
            )}
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant='ghost'
                size='icon'
                data-testid={`viewed-toggle-${filePath}`}
                type='button'
                aria-label={t(
                  viewed ? 'Mark as needs review: {path}' : 'Mark as done reviewing: {path}',
                  { path: filePath }
                )}
                aria-pressed={viewed}
                onClick={e => {
                  e.stopPropagation();
                  onToggleViewed(filePath);
                }}
                className='inline-flex items-center justify-center h-5 w-5 rounded-sm hover:bg-accent/80 transition-colors cursor-pointer'
              >
                {viewed ? (
                  <CircleCheck className='h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400' />
                ) : (
                  <CircleDashed className='h-3.5 w-3.5 text-muted-foreground/60' />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side='right'>
              {t(viewed ? 'Mark as needs review' : 'Mark as done reviewing')}
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipTrigger>
      <TooltipContent side='right' className='max-w-sm'>
        <p className='font-mono text-xs break-all'>{filePath}</p>
      </TooltipContent>
    </Tooltip>
  );
});
