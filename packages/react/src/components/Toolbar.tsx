import { useLocalization } from '../localization/LocalizationContext';
import React, { useMemo } from 'react';
import { useConfiguration, useOutputPath } from '../context/ConfigContext';
import { useDiffReview } from '../context/ReviewContext';
import { useGuide } from '../context/GuideContext';
import { useAdapter } from '../context/ReviewAdapterContext';
import { Button } from './ui/button';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import { Separator } from './ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import {
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
  FolderOpen,
  FileText,
  CheckCircle2,
  Route,
  List,
} from 'lucide-react';
import { useCommentDisclosure } from '../context/ReviewDisplayContext';
import ReviewProgress from './ReviewProgress';

export interface ToolbarProps {
  /** Callback when "Finish Review" is clicked. If not provided, the button is hidden. */
  onFinishReview?: () => void;
}

export default function Toolbar({ onFinishReview }: ToolbarProps = {}) {
  const { t, number } = useLocalization();
  const { config, updateConfig } = useConfiguration();
  const { outputPathInfo } = useOutputPath();
  const { diffFiles, diffSource } = useDiffReview();
  const { guide, mode: guideMode, setMode: setGuideMode } = useGuide();
  const adapter = useAdapter();
  const { allCollapsed: allCommentsCollapsed, setAllCollapsed } = useCommentDisclosure();

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
    setAllCollapsed(!allCommentsCollapsed);
  };

  const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
    updateConfig({ theme });
  };

  return (
    <div
      className='flex shrink-0 z-20 items-center justify-between h-11 px-3 border-b border-border bg-background'
      data-testid='toolbar'
    >
      <div className='flex items-center gap-2'>
        {diffSource.type === 'git' && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant='ghost'
                  size='sm'
                  data-testid='toggle-untracked-btn'
                  onClick={() => updateConfig({ showUntracked: !config.showUntracked })}
                  className='gap-1.5 h-8 px-2.5 text-muted-foreground hover:text-foreground'
                >
                  {config.showUntracked ? (
                    <FileX className='h-3.5 w-3.5' />
                  ) : (
                    <FilePlus2 className='h-3.5 w-3.5' />
                  )}
                  <span className='text-xs'>
                    {t(config.showUntracked ? 'Hide New Files' : 'Show New Files')}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {config.showUntracked
                  ? t('Hide new files not yet in git')
                  : t('Show new files not yet in git')}
              </TooltipContent>
            </Tooltip>

            <Separator orientation='vertical' className='h-5' />
          </>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='ghost'
              size='sm'
              data-testid={
                allCommentsCollapsed ? 'expand-all-comments-btn' : 'collapse-all-comments-btn'
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
                {t(allCommentsCollapsed ? 'Expand Comments' : 'Collapse Comments')}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {t(allCommentsCollapsed ? 'Expand all comments' : 'Collapse all comments')}
          </TooltipContent>
        </Tooltip>

        {guide && (
          <>
            <Separator orientation='vertical' className='h-5' />

            <ToggleGroup
              type='single'
              variant='outline'
              size='sm'
              value={guideMode}
              onValueChange={value => {
                if (value === 'guided' || value === 'flat') {
                  setGuideMode(value);
                }
              }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <ToggleGroupItem
                    value='guided'
                    data-testid='guide-mode-guided'
                    className='h-8 px-2.5 gap-1.5'
                  >
                    <Route className='h-3.5 w-3.5' />
                    <span className='text-xs'>{t('Guided')}</span>
                  </ToggleGroupItem>
                </TooltipTrigger>
                <TooltipContent>{t('Group files by the review walkthrough')}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <ToggleGroupItem
                    value='flat'
                    data-testid='guide-mode-flat'
                    className='h-8 px-2.5 gap-1.5'
                  >
                    <List className='h-3.5 w-3.5' />
                    <span className='text-xs'>{t('Flat')}</span>
                  </ToggleGroupItem>
                </TooltipTrigger>
                <TooltipContent>{t('Flat file list (diff order)')}</TooltipContent>
              </Tooltip>
            </ToggleGroup>
          </>
        )}
      </div>

      <div
        className='flex items-center gap-2 text-xs text-muted-foreground'
        data-testid='diff-stats'
      >
        <span className='inline-flex items-center gap-1 font-mono'>
          {diffSource.type === 'file' ? (
            <FileText className='h-3 w-3' />
          ) : diffSource.type === 'directory' ? (
            <FolderOpen className='h-3 w-3' />
          ) : (
            <Terminal className='h-3 w-3' />
          )}
          {diffSource.type === 'git'
            ? `git diff${diffSource.gitDiffArgs ? ` ${diffSource.gitDiffArgs}` : ''}`
            : diffSource.type === 'directory'
              ? t('Directory: {path}', { path: diffSource.sourcePath })
              : diffSource.type === 'file'
                ? t('File: {path}', { path: diffSource.sourcePath.split('/').pop() ?? '' })
                : ''}
        </span>
        <Separator orientation='vertical' className='h-3.5' />
        <span>{t('files changed', { count: stats.files })}</span>
        {stats.additions > 0 && (
          <span className='text-green-600 dark:text-green-400'>+{number(stats.additions)}</span>
        )}
        {stats.deletions > 0 && (
          <span className='text-red-600 dark:text-red-400'>-{number(stats.deletions)}</span>
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
              <span className='text-xs'>{t(config.wordWrap ? 'Wrap Lines' : 'No Wrap')}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {t(config.wordWrap ? 'Wrap long lines' : 'Scroll long lines horizontally')}
          </TooltipContent>
        </Tooltip>

        <Separator orientation='vertical' className='h-5' />

        <ToggleGroup
          type='single'
          variant='outline'
          size='sm'
          value={config.theme}
          onValueChange={value => value && handleThemeChange(value as 'light' | 'dark' | 'system')}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <ToggleGroupItem
                value='light'
                data-testid='theme-option-light'
                className='h-8 w-8 p-0'
              >
                <Sun className='h-3.5 w-3.5' />
                <span className='sr-only'>{t('Light theme')}</span>
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent>{t('Light theme')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <ToggleGroupItem value='dark' data-testid='theme-option-dark' className='h-8 w-8 p-0'>
                <Moon className='h-3.5 w-3.5' />
                <span className='sr-only'>{t('Dark theme')}</span>
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent>{t('Dark theme')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <ToggleGroupItem
                value='system'
                data-testid='theme-option-system'
                className='h-8 w-8 p-0'
              >
                <Monitor className='h-3.5 w-3.5' />
                <span className='sr-only'>{t('System theme')}</span>
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent>{t('System theme')}</TooltipContent>
          </Tooltip>
        </ToggleGroup>

        <Separator orientation='vertical' className='h-5' />

        <ReviewProgress />

        {onFinishReview && (
          <>
            <Separator orientation='vertical' className='h-5' />

            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant='default'
                    size='sm'
                    data-testid='finish-review-btn'
                    data-hint-action='finish-review'
                    onClick={() => onFinishReview()}
                    className='gap-1.5 h-8 px-3'
                    disabled={!outputPathInfo.outputPathWritable || diffSource.type === 'loading'}
                  >
                    <CheckCircle2 className='h-3.5 w-3.5' />
                    <span className='text-xs font-medium'>{t('Finish Review')}</span>
                  </Button>
                </span>
              </TooltipTrigger>
              {!outputPathInfo.outputPathWritable && (
                <TooltipContent>
                  {/* The file tree only shows "Change..." when the host can change the path. */}
                  {adapter?.changeOutputPath
                    ? t(
                        "Output path is not writable. Click 'Change...' in the file tree to pick a save location."
                      )
                    : t('Output path is not writable.')}
                </TooltipContent>
              )}
            </Tooltip>
          </>
        )}
      </div>
    </div>
  );
}
