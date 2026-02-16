import React, { useState, useMemo } from 'react';
import { useConfig } from '../context/ConfigContext';
import { useReview } from '../context/ReviewContext';
import { Button } from './ui/button';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import { Separator } from './ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import {
  Columns2,
  AlignJustify,
  Sun,
  Moon,
  Monitor,
  MessageSquare,
  MessageSquareOff,
  FilePlus2,
  FileX,
  WrapText,
  MoveHorizontal,
  Terminal,
  CheckCircle2,
} from 'lucide-react';

export default function Toolbar() {
  const { config, updateConfig } = useConfig();
  const { diffFiles, diffSource } = useReview();
  const [allCommentsCollapsed, setAllCommentsCollapsed] = useState(false);

  const stats = useMemo(() => {
    let additions = 0;
    let deletions = 0;
    for (const file of diffFiles) {
      for (const hunk of file.hunks) {
        for (const line of hunk.lines) {
          if (line.type === 'addition') additions++;
          else if (line.type === 'deletion') deletions++;
        }
      }
    }
    return { files: diffFiles.length, additions, deletions };
  }, [diffFiles]);

  const handleToggleAllComments = () => {
    const newCollapsed = !allCommentsCollapsed;
    setAllCommentsCollapsed(newCollapsed);
    const event = new CustomEvent('toggle-all-comments', {
      detail: { collapsed: newCollapsed },
    });
    document.dispatchEvent(event);
  };

  const handleViewModeChange = (value: string) => {
    if (value === 'split' || value === 'unified') {
      updateConfig({ diffView: value });
    }
  };

  const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
    updateConfig({ theme });
  };

  return (
    <div
      className='flex items-center justify-between h-11 px-3 border-b border-border bg-background'
      data-testid='toolbar'
    >
      <div className='flex items-center gap-2'>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='ghost'
              size='sm'
              data-testid='toggle-untracked-btn'
              onClick={() =>
                updateConfig({ showUntracked: !config.showUntracked })
              }
              className='gap-1.5 h-8 px-2.5 text-muted-foreground hover:text-foreground'
            >
              {config.showUntracked ? (
                <FileX className='h-3.5 w-3.5' />
              ) : (
                <FilePlus2 className='h-3.5 w-3.5' />
              )}
              <span className='text-xs'>
                {config.showUntracked ? 'Hide' : 'Show'} New Files
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {config.showUntracked
              ? 'Hide new files not yet in git'
              : 'Show new files not yet in git'}
          </TooltipContent>
        </Tooltip>

        <Separator orientation='vertical' className='h-5' />

        <ToggleGroup
          type='single'
          variant='outline'
          size='sm'
          value={config.diffView}
          onValueChange={handleViewModeChange}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <ToggleGroupItem
                value='split'
                data-testid='view-mode-split'
                className='gap-1.5 px-2.5'
              >
                <Columns2 className='h-3.5 w-3.5' />
                <span className='text-xs'>Split</span>
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent>Side-by-side view</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <ToggleGroupItem
                value='unified'
                data-testid='view-mode-unified'
                className='gap-1.5 px-2.5'
              >
                <AlignJustify className='h-3.5 w-3.5' />
                <span className='text-xs'>Unified</span>
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent>Unified view</TooltipContent>
          </Tooltip>
        </ToggleGroup>

        <Separator orientation='vertical' className='h-5' />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='ghost'
              size='sm'
              data-testid={
                allCommentsCollapsed
                  ? 'expand-all-comments-btn'
                  : 'collapse-all-comments-btn'
              }
              onClick={handleToggleAllComments}
              className='gap-1.5 h-8 px-2.5 text-muted-foreground hover:text-foreground'
            >
              {allCommentsCollapsed ? (
                <MessageSquare className='h-3.5 w-3.5' />
              ) : (
                <MessageSquareOff className='h-3.5 w-3.5' />
              )}
              <span className='text-xs'>
                {allCommentsCollapsed ? 'Expand' : 'Collapse'} Comments
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {allCommentsCollapsed
              ? 'Expand all comments'
              : 'Collapse all comments'}
          </TooltipContent>
        </Tooltip>

      </div>

      <div
        className='flex items-center gap-2 text-xs text-muted-foreground'
        data-testid='diff-stats'
      >
        <span className='inline-flex items-center gap-1 font-mono'>
          <Terminal className='h-3 w-3' />
          {diffSource.type === 'git'
            ? `git diff${diffSource.gitDiffArgs ? ` ${diffSource.gitDiffArgs}` : ''}`
            : diffSource.type === 'directory'
              ? diffSource.sourcePath
              : ''}
        </span>
        <Separator orientation='vertical' className='h-3.5' />
        <span>
          {stats.files} {stats.files === 1 ? 'file' : 'files'} changed
        </span>
        {stats.additions > 0 && (
          <span className='text-green-600 dark:text-green-400'>
            +{stats.additions}
          </span>
        )}
        {stats.deletions > 0 && (
          <span className='text-red-600 dark:text-red-400'>
            -{stats.deletions}
          </span>
        )}
      </div>

      <div className='flex items-center gap-2'>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='ghost'
              size='sm'
              data-testid='toggle-word-wrap-btn'
              onClick={() => updateConfig({ wordWrap: !config.wordWrap })}
              className='gap-1.5 h-8 px-2.5 text-muted-foreground hover:text-foreground'
            >
              {config.wordWrap ? (
                <WrapText className='h-3.5 w-3.5' />
              ) : (
                <MoveHorizontal className='h-3.5 w-3.5' />
              )}
              <span className='text-xs'>
                {config.wordWrap ? 'Wrap Lines' : 'No Wrap'}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {config.wordWrap
              ? 'Wrap long lines'
              : 'Scroll long lines horizontally'}
          </TooltipContent>
        </Tooltip>

        <Separator orientation='vertical' className='h-5' />

        <ToggleGroup
          type='single'
          variant='outline'
          size='sm'
          value={config.theme}
          onValueChange={value =>
            value && handleThemeChange(value as 'light' | 'dark' | 'system')
          }
        >
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem
              value='light'
              data-testid='theme-option-light'
              className='h-8 w-8 p-0'
            >
              <Sun className='h-3.5 w-3.5' />
              <span className='sr-only'>Light theme</span>
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>Light theme</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem
              value='dark'
              data-testid='theme-option-dark'
              className='h-8 w-8 p-0'
            >
              <Moon className='h-3.5 w-3.5' />
              <span className='sr-only'>Dark theme</span>
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>Dark theme</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem
              value='system'
              data-testid='theme-option-system'
              className='h-8 w-8 p-0'
            >
              <Monitor className='h-3.5 w-3.5' />
              <span className='sr-only'>System theme</span>
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>System theme</TooltipContent>
        </Tooltip>
        </ToggleGroup>

        <Separator orientation='vertical' className='h-5' />

        <Button
          variant='default'
          size='sm'
          data-testid='finish-review-btn'
          onClick={() => window.electronAPI.saveAndQuit()}
          className='gap-1.5 h-8 px-3'
        >
          <CheckCircle2 className='h-3.5 w-3.5' />
          <span className='text-xs font-medium'>Finish Review</span>
        </Button>
      </div>
    </div>
  );
}
