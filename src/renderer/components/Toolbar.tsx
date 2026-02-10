import React, { useState } from 'react';
import { useConfig } from '../context/ConfigContext';
import { Button } from './ui/button';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

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
    <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background">
      <div className="flex items-center gap-4">
        {/* View Mode Toggle */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">View:</span>
          <ToggleGroup
            type="single"
            value={config.diffView}
            onValueChange={handleViewModeChange}
            className="gap-0"
          >
            <ToggleGroupItem value="split" className="px-3 py-1 text-sm">
              Split
            </ToggleGroupItem>
            <ToggleGroupItem value="unified" className="px-3 py-1 text-sm">
              Unified
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Expand/Collapse All Button */}
        <Button variant="outline" size="sm" onClick={handleToggleAllSections}>
          Expand/Collapse All
        </Button>
      </div>

      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              Theme: {config.theme.charAt(0).toUpperCase() + config.theme.slice(1)}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleThemeChange('light')}>
              Light
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleThemeChange('dark')}>
              Dark
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleThemeChange('system')}>
              System
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
