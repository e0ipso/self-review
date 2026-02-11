import React, { useState } from 'react';
import { useConfig } from '../context/ConfigContext';
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
  ChevronsDownUp,
  ChevronsUpDown,
} from 'lucide-react';

export default function Toolbar() {
  const { config, updateConfig } = useConfig();
  const [allExpanded, setAllExpanded] = useState(true);

  const handleToggleAllSections = () => {
    const newExpanded = !allExpanded;
    setAllExpanded(newExpanded);
    const event = new CustomEvent('toggle-all-sections', { detail: { expanded: newExpanded } });
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
    <div className="flex items-center justify-between h-11 px-3 border-b border-border bg-background" data-testid="toolbar">
      <div className="flex items-center gap-2">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={config.diffView}
          onValueChange={handleViewModeChange}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <ToggleGroupItem value="split" data-testid="view-mode-split" className="gap-1.5 px-2.5">
                <Columns2 className="h-3.5 w-3.5" />
                <span className="text-xs">Split</span>
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent>Side-by-side view</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <ToggleGroupItem value="unified" data-testid="view-mode-unified" className="gap-1.5 px-2.5">
                <AlignJustify className="h-3.5 w-3.5" />
                <span className="text-xs">Unified</span>
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent>Unified view</TooltipContent>
          </Tooltip>
        </ToggleGroup>

        <Separator orientation="vertical" className="h-5" />

        <Button
          variant="ghost"
          size="sm"
          data-testid={allExpanded ? 'collapse-all-btn' : 'expand-all-btn'}
          onClick={handleToggleAllSections}
          className="gap-1.5 h-8 px-2.5 text-muted-foreground hover:text-foreground"
        >
          {allExpanded ? (
            <ChevronsDownUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronsUpDown className="h-3.5 w-3.5" />
          )}
          <span className="text-xs">{allExpanded ? 'Collapse' : 'Expand'}</span>
        </Button>
      </div>

      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={config.theme}
        onValueChange={(value) => value && handleThemeChange(value as 'light' | 'dark' | 'system')}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem value="light" data-testid="theme-option-light" className="h-8 w-8 p-0">
              <Sun className="h-3.5 w-3.5" />
              <span className="sr-only">Light theme</span>
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>Light theme</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem value="dark" data-testid="theme-option-dark" className="h-8 w-8 p-0">
              <Moon className="h-3.5 w-3.5" />
              <span className="sr-only">Dark theme</span>
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>Dark theme</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem value="system" data-testid="theme-option-system" className="h-8 w-8 p-0">
              <Monitor className="h-3.5 w-3.5" />
              <span className="sr-only">System theme</span>
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>System theme</TooltipContent>
        </Tooltip>
      </ToggleGroup>
    </div>
  );
}
