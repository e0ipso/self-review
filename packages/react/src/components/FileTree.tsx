import React, { useState, useMemo } from 'react';
import { useReview } from '../context/ReviewContext';
import { useConfig } from '../context/ConfigContext';
import { useDiffNavigationContext } from '../context/DiffNavigationContext';
import { useAdapter } from '../context/ReviewAdapterContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { Search, CircleDashed, CircleCheck, MessageSquare, ChevronsDownUp, ChevronsUpDown, Keyboard, CheckCircle2, AlertCircle } from 'lucide-react';
import { getFileStats, getChangeTypeInfo } from '../utils/diff-styles';
import TruncatedPath from './TruncatedPath';

export default function FileTree() {
  const { diffFiles, files, toggleViewed } = useReview();
  const { outputPathInfo, setOutputPathInfo } = useConfig();
  const { activeFilePath, scrollToFile } = useDiffNavigationContext();
  const adapter = useAdapter();
  const [searchQuery, setSearchQuery] = useState('');
  const [allExpanded, setAllExpanded] = useState(true);


  const handleChangeOutputPath = async () => {
    if (!adapter?.changeOutputPath) return;
    const result = await adapter.changeOutputPath();
    if (result) {
      setOutputPathInfo(result);
    }
  };

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

  const getCommentCount = (filePath: string) => {
    const fileState = files.find(f => f.path === filePath);
    return fileState?.comments.length || 0;
  };

  const isViewed = (filePath: string) => {
    const fileState = files.find(f => f.path === filePath);
    return fileState?.viewed || false;
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
                <div className='flex justify-between gap-4'><span>Find in page</span><kbd className='font-mono'>Ctrl+F</kbd></div>
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
          const changeType = getChangeTypeInfo(file.changeType);

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
                          <button
                            data-testid={`viewed-toggle-${filePath}`}
                            onClick={e => {
                              e.stopPropagation();
                              toggleViewed(filePath);
                            }}
                            className='inline-flex items-center justify-center h-5 w-5 rounded-sm hover:bg-accent/80 transition-colors cursor-pointer'
                          >
                            {viewed ? (
                              <CircleCheck className='h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400' />
                            ) : (
                              <CircleDashed className='h-3.5 w-3.5 text-muted-foreground/60' />
                            )}
                          </button>
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
        })}

        {filteredFiles.length === 0 && (
          <div className='text-center text-muted-foreground text-xs py-8'>
            {searchQuery ? 'No files match your search' : 'No files in diff'}
          </div>
        )}
      </div>

      {/* Output Path Footer */}
      {outputPathInfo.resolvedOutputPath && (
        <>
          <Separator />
          <div className='px-3 py-2 space-y-1'>
            <div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
              <span className='font-medium'>Output:</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <TruncatedPath path={outputPathInfo.resolvedOutputPath} className='cursor-default' />
                </TooltipTrigger>
                <TooltipContent side='right' className='max-w-sm'>
                  <p className='font-mono text-xs break-all'>{outputPathInfo.resolvedOutputPath}</p>
                </TooltipContent>
              </Tooltip>
              {outputPathInfo.outputPathWritable ? (
                <CheckCircle2 className='h-3.5 w-3.5 text-green-500 shrink-0' />
              ) : (
                <AlertCircle className='h-3.5 w-3.5 text-red-500 shrink-0' />
              )}
              <Button
                variant='ghost'
                size='sm'
                className='h-6 px-2 text-xs ml-auto'
                onClick={handleChangeOutputPath}
              >
                Change...
              </Button>
            </div>
            {!outputPathInfo.outputPathWritable && (
              <p className='text-xs text-red-500'>Path not writable</p>
            )}
          </div>
        </>
      )}

    </div>
  );
}
