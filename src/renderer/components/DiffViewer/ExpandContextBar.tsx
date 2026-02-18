import React from 'react';
import { ChevronUp, ChevronDown, UnfoldVertical } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

export type ExpandDirection = 'up' | 'down' | 'all';

export interface ExpandContextBarProps {
  position: 'top' | 'between' | 'bottom';
  hunkIndex: number;
  gapSize?: number;
  onExpand: (direction: ExpandDirection, hunkIndex: number, position: 'top' | 'between' | 'bottom') => void;
  loading?: boolean;
}

export default function ExpandContextBar({
  position,
  hunkIndex,
  gapSize,
  onExpand,
  loading,
}: ExpandContextBarProps) {
  if (gapSize !== undefined && gapSize <= 0) return null;

  const showSingleButton = gapSize !== undefined && gapSize <= 20;

  const iconButton = (
    direction: ExpandDirection,
    Icon: typeof ChevronUp,
    title: string
  ) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className='flex items-center justify-center w-5 h-5 rounded-sm text-muted-foreground/60 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-600/10 transition-colors cursor-pointer'
          onClick={e => {
            e.stopPropagation();
            onExpand(direction, hunkIndex, position);
          }}
          disabled={loading}
        >
          <Icon className='h-3.5 w-3.5' />
        </button>
      </TooltipTrigger>
      <TooltipContent side='right'>{title}</TooltipContent>
    </Tooltip>
  );

  return (
    <div className='expand-context-bar flex items-center h-[26px] bg-accent/30 border-y border-border/30 text-muted-foreground select-none'>
      {/* Gutter area — matches line number column width */}
      <div className='w-10 flex-shrink-0 flex items-center justify-center gap-0.5'>
        {loading ? (
          <span className='text-[10px] text-muted-foreground/50'>...</span>
        ) : showSingleButton ? (
          iconButton('all', UnfoldVertical, `Show ${gapSize} hidden line${gapSize !== 1 ? 's' : ''}`)
        ) : (
          <>
            {(position === 'top' || position === 'between') &&
              iconButton('up', ChevronUp, 'Expand up')}
            {(position === 'bottom' || position === 'between') &&
              iconButton('down', ChevronDown, 'Expand down')}
          </>
        )}
      </div>
      {/* Label area */}
      <div className='flex-1 px-2'>
        {showSingleButton ? (
          <button
            className='text-[11px] text-muted-foreground/60 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer'
            onClick={() => onExpand('all', hunkIndex, position)}
            disabled={loading}
          >
            Show {gapSize} hidden line{gapSize !== 1 ? 's' : ''}
          </button>
        ) : (
          <button
            className='text-[11px] text-muted-foreground/60 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer'
            onClick={() => onExpand('all', hunkIndex, position)}
            disabled={loading}
          >
            Show all hidden lines
          </button>
        )}
      </div>
    </div>
  );
}
