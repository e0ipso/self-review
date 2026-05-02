import React from 'react';
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
  onScrollToFile: (filePath: string) => void;
  onToggleViewed: (filePath: string) => void;
}

export function FileTreeEntry({
  file,
  isActive,
  commentCount,
  viewed,
  onScrollToFile,
  onToggleViewed,
}: FileTreeEntryProps) {
  const filePath = file.newPath || file.oldPath;
  const stats = getFileStats(file);
  const changeType = getChangeTypeInfo(file.changeType);

  return (
    <Tooltip key={filePath}>
      <TooltipTrigger asChild>
        <button
          data-testid={`file-entry-${filePath}`}
          data-file-path={filePath}
          onClick={() => onScrollToFile(filePath)}
          className={`w-full text-left px-2 py-1.5 rounded-md transition-colors cursor-pointer ${
            isActive
              ? 'bg-accent text-accent-foreground'
              : 'hover:bg-accent/50 text-foreground'
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
            <TruncatedPath path={filePath} />

            {/* Indicators */}
            <div className='flex items-center gap-1 flex-shrink-0'>
              {stats.additions > 0 && (
                <span className='text-[10px] tabular-nums font-medium text-emerald-600 dark:text-emerald-400'>
                  +{stats.additions}
                </span>
              )}
              {stats.deletions > 0 && (
                <span className='text-[10px] tabular-nums font-medium text-red-600 dark:text-red-400'>
                  -{stats.deletions}
                </span>
              )}
              {commentCount > 0 && (
                <span className='inline-flex items-center gap-0.5 text-muted-foreground'>
                  <MessageSquare className='h-3 w-3' />
                  <span className='text-[10px] tabular-nums'>
                    {commentCount}
                  </span>
                </span>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    data-testid={`viewed-toggle-${filePath}`}
                    role='button'
                    tabIndex={0}
                    onClick={e => {
                      e.stopPropagation();
                      onToggleViewed(filePath);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation();
                        e.preventDefault();
                        onToggleViewed(filePath);
                      }
                    }}
                    className='inline-flex items-center justify-center h-5 w-5 rounded-sm hover:bg-accent/80 transition-colors cursor-pointer'
                  >
                    {viewed ? (
                      <CircleCheck className='h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400' />
                    ) : (
                      <CircleDashed className='h-3.5 w-3.5 text-muted-foreground/60' />
                    )}
                  </span>
                </TooltipTrigger>
                <TooltipContent side='right'>
                  {viewed ? 'Mark as needs review' : 'Mark as done reviewing'}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </button>
      </TooltipTrigger>
      <TooltipContent side='right' className='max-w-sm'>
        <p className='font-mono text-xs break-all'>{filePath}</p>
      </TooltipContent>
    </Tooltip>
  );
}
