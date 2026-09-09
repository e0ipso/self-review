import React from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

export interface FileTreeToggleProps {
  /** True while the file tree panel is collapsed to zero width. */
  collapsed: boolean;
  /** DOM id of the panel this control shows and hides. */
  controls: string;
  onToggle: () => void;
}

/**
 * Collapses and restores the file tree panel. Floats over the diff pane in the
 * same spot in both states so the way back is never further than the way out,
 * and carries `aria-expanded`/`aria-controls` because the panel it operates on
 * is a sibling rather than its own child.
 */
export default function FileTreeToggle({ collapsed, controls, onToggle }: FileTreeToggleProps) {
  const label = collapsed ? 'Show file tree' : 'Hide file tree';
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant='outline'
          size='icon'
          className='h-7 w-7 rounded-full shadow-md text-muted-foreground hover:text-foreground'
          data-testid='file-tree-toggle'
          aria-expanded={!collapsed}
          aria-controls={controls}
          aria-label={label}
          onClick={onToggle}
        >
          <Icon className='h-3.5 w-3.5' />
        </Button>
      </TooltipTrigger>
      <TooltipContent side='right'>{label}</TooltipContent>
    </Tooltip>
  );
}
