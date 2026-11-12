import React from 'react';
import { useLocalization } from '../localization/LocalizationContext';
import { useAppearance } from '../context/ConfigContext';
import { useDiffReview } from '../context/ReviewContext';
import { useReviewExpansion } from '../context/ReviewDisplayContext';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { ChevronsDownUp, ChevronsUpDown, Keyboard, Columns2, AlignJustify } from 'lucide-react';

/** Appearance and bulk commands, independent of navigation/search and review comment bodies. */
export default function FileTreeControls() {
  const { t, number } = useLocalization();
  const config = useAppearance();
  const { updateConfig } = config;
  const { diffFiles } = useDiffReview();
  const { expanded, setAllExpanded } = useReviewExpansion();
  const paths = diffFiles.map(file => file.newPath || file.oldPath);
  const allExpanded = paths.length > 0 && paths.every(path => expanded.get(path));
  const handleToggleAllSections = () => setAllExpanded(!allExpanded, paths);
  const handleViewModeChange = (value: string) => {
    if (value === 'split' || value === 'unified') updateConfig({ diffView: value });
  };
  return (
    <div className='flex items-center gap-1'>
      <ToggleGroup
        type='single'
        variant='outline'
        size='sm'
        value={config.diffView}
        onValueChange={handleViewModeChange}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem value='split' data-testid='view-mode-split' className='h-5 w-5 p-0'>
              <Columns2 className='h-3.5 w-3.5' />
              <span className='sr-only'>{t('Split view')}</span>
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>{t('Side-by-side view')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem
              value='unified'
              data-testid='view-mode-unified'
              className='h-5 w-5 p-0'
            >
              <AlignJustify className='h-3.5 w-3.5' />
              <span className='sr-only'>{t('Unified view')}</span>
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>{t('Unified view')}</TooltipContent>
        </Tooltip>
      </ToggleGroup>
      <Separator orientation='vertical' className='h-4' />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant='ghost'
            size='icon'
            data-testid='keyboard-shortcuts-btn'
            aria-label={t('Keyboard shortcuts')}
            className='h-5 w-5 text-muted-foreground hover:text-foreground'
          >
            <Keyboard className='h-3.5 w-3.5' />
          </Button>
        </TooltipTrigger>
        <TooltipContent side='right' className='text-xs space-y-1 p-2'>
          <div className='font-medium mb-1'>{t('Keyboard Shortcuts')}</div>
          <div className='flex justify-between gap-4'>
            <span>{t('Find in page')}</span>
            <kbd className='font-mono'>Ctrl+F</kbd>
          </div>
          <div className='flex justify-between gap-4'>
            <span>{t('Comment on line')}</span>
            <kbd className='font-mono'>f</kbd>
          </div>
          <div className='flex justify-between gap-4'>
            <span>{t('Jump to file')}</span>
            <kbd className='font-mono'>g</kbd>
          </div>
          <div className='flex justify-between gap-4'>
            <span>{t('Scroll diffs')}</span>
            <kbd className='font-mono'>j/k</kbd>
          </div>
          <div className='flex justify-between gap-4'>
            <span>{t('Cancel')}</span>
            <kbd className='font-mono'>Esc</kbd>
          </div>
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant='ghost'
            size='icon'
            data-testid={allExpanded ? 'collapse-all-btn' : 'expand-all-btn'}
            onClick={handleToggleAllSections}
            aria-label={t(allExpanded ? 'Collapse all files' : 'Expand all files')}
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
          {t(allExpanded ? 'Collapse all files' : 'Expand all files')}
        </TooltipContent>
      </Tooltip>
      <Badge
        variant='secondary'
        className='h-5 px-1.5 text-[11px] font-normal tabular-nums rounded'
      >
        {number(diffFiles.length)}
      </Badge>
    </div>
  );
}
