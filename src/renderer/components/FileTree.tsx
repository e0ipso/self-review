import React, { useState, useMemo } from 'react';
import { useReview } from '../context/ReviewContext';
import { useDiffNavigationContext } from '../context/DiffNavigationContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { Search, CircleDashed, CircleCheck, MessageSquare, ChevronsDownUp, ChevronsUpDown, Keyboard } from 'lucide-react';
import type { DiffFile } from '../../shared/types';

export default function FileTree() {
  const { diffFiles, files } = useReview();
  const { activeFilePath, scrollToFile } = useDiffNavigationContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [allExpanded, setAllExpanded] = useState(true);

  const handleToggleAllSections = () => {
    const newExpanded = !allExpanded;
    setAllExpanded(newExpanded);
    const event = new CustomEvent('toggle-all-sections', {
      detail: { expanded: newExpanded },
    });
    document.dispatchEvent(event);
  };

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return diffFiles;
    const query = searchQuery.toLowerCase();
    return diffFiles.filter(file => file.newPath.toLowerCase().includes(query));
  }, [diffFiles, searchQuery]);

  const getFileStats = (file: DiffFile) => {
    let additions = 0;
    let deletions = 0;
    file.hunks.forEach(hunk => {
      hunk.lines.forEach(line => {
        if (line.type === 'addition') additions++;
        if (line.type === 'deletion') deletions++;
      });
    });
    return { additions, deletions };
  };

  const getCommentCount = (filePath: string) => {
    const fileState = files.find(f => f.path === filePath);
    return fileState?.comments.length || 0;
  };

  const isViewed = (filePath: string) => {
    const fileState = files.find(f => f.path === filePath);
    return fileState?.viewed || false;
  };

  const getChangeType = (changeType: DiffFile['changeType']) => {
    switch (changeType) {
      case 'added':
        return {
          label: 'A',
          className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
        };
      case 'modified':
        return {
          label: 'M',
          className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
        };
      case 'deleted':
        return {
          label: 'D',
          className: 'bg-red-500/15 text-red-700 dark:text-red-400',
        };
      case 'renamed':
        return {
          label: 'R',
          className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
        };
    }
  };

  const splitPath = (fullPath: string) => {
    const lastSlash = fullPath.lastIndexOf('/');
    if (lastSlash === -1) return { dir: '', fileName: fullPath };
    return {
      dir: fullPath.slice(0, lastSlash + 1),
      fileName: fullPath.slice(lastSlash + 1),
    };
  };

  return (
    <div className='flex flex-col h-full' data-testid='file-tree'>
      {/* Header */}
      <div className='px-3 pt-3 pb-2'>
        <div className='flex items-center justify-between mb-2.5'>
          <span className='text-[11px] font-semibold uppercase tracking-wider text-muted-foreground'>
            Changed files
          </span>
          <div className='flex items-center gap-1'>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant='ghost'
                  size='icon'
                  data-testid='keyboard-shortcuts-btn'
                  className='h-5 w-5 text-muted-foreground hover:text-foreground'
                >
                  <Keyboard className='h-3.5 w-3.5' />
                </Button>
              </TooltipTrigger>
              <TooltipContent side='right' className='text-xs space-y-1 p-2'>
                <div className='font-medium mb-1'>Keyboard Shortcuts</div>
                <div className='flex justify-between gap-4'><span>Comment on line</span><kbd className='font-mono'>f</kbd></div>
                <div className='flex justify-between gap-4'><span>Jump to file</span><kbd className='font-mono'>g</kbd></div>
                <div className='flex justify-between gap-4'><span>Scroll diffs</span><kbd className='font-mono'>j/k</kbd></div>
                <div className='flex justify-between gap-4'><span>Cancel</span><kbd className='font-mono'>Esc</kbd></div>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant='ghost'
                  size='icon'
                  data-testid={allExpanded ? 'collapse-all-btn' : 'expand-all-btn'}
                  onClick={handleToggleAllSections}
                  className='h-5 w-5 text-muted-foreground hover:text-foreground'
                >
                  {allExpanded ? (
                    <ChevronsDownUp className='h-3.5 w-3.5' />
                  ) : (
                    <ChevronsUpDown className='h-3.5 w-3.5' />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {allExpanded ? 'Collapse all files' : 'Expand all files'}
              </TooltipContent>
            </Tooltip>
            <Badge
              variant='secondary'
              className='h-5 px-1.5 text-[11px] font-normal tabular-nums rounded'
            >
              {diffFiles.length}
            </Badge>
          </div>
        </div>
        <div className='relative'>
          <Search className='absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none' />
          <Input
            type='text'
            placeholder='Filter files...'
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className='h-7 pl-7 text-xs bg-background'
            data-testid='file-search'
          />
        </div>
      </div>

      <Separator />

      {/* File List */}
      <div className='flex-1 overflow-y-auto overflow-x-hidden p-1'>
        {filteredFiles.map(file => {
          const filePath = file.newPath || file.oldPath;
          const stats = getFileStats(file);
          const commentCount = getCommentCount(filePath);
          const viewed = isViewed(filePath);
          const isActive = activeFilePath === filePath;
          const changeType = getChangeType(file.changeType);
          const { dir, fileName } = splitPath(filePath);

          return (
            <Tooltip key={filePath}>
              <TooltipTrigger asChild>
                <button
                  data-testid={`file-entry-${filePath}`}
                  data-file-path={filePath}
                  onClick={() => scrollToFile(filePath)}
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
                    <span className='flex-1 min-w-0 flex font-mono text-xs leading-tight'>
                      {dir && (
                        <span className='truncate text-muted-foreground/70'>
                          {dir}
                        </span>
                      )}
                      <span className='flex-shrink-0 whitespace-nowrap'>
                        {fileName}
                      </span>
                    </span>

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
                      {viewed ? (
                        <CircleCheck className='h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400' />
                      ) : (
                        <CircleDashed className='h-3.5 w-3.5 text-muted-foreground/60' />
                      )}
                    </div>
                  </div>
                </button>
              </TooltipTrigger>
              <TooltipContent side='right' className='max-w-sm'>
                <p className='font-mono text-xs break-all'>{filePath}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}

        {filteredFiles.length === 0 && (
          <div className='text-center text-muted-foreground text-xs py-8'>
            {searchQuery ? 'No files match your search' : 'No files in diff'}
          </div>
        )}
      </div>

    </div>
  );
}
