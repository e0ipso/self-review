import React from 'react';
import { useConfig } from '../../context/ConfigContext';
import { Button } from '../ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';

export interface CategorySelectorProps {
  value: string;
  onChange: (category: string) => void;
}

export default function CategorySelector({ value, onChange }: CategorySelectorProps) {
  const { config } = useConfig();

  if (!config.categories || config.categories.length === 0) {
    return null;
  }

  return (
    <div data-testid="category-selector" className="flex items-center gap-1">
      {config.categories.map((cat) => {
        const isActive = value === cat.name;
        return (
          <Tooltip key={cat.name}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                data-testid={`category-option-${cat.name}`}
                onClick={() => { if (!isActive) onChange(cat.name); }}
                className="h-7 px-2 text-xs gap-1.5"
                style={isActive ? {
                  backgroundColor: `${cat.color}20`,
                  color: cat.color,
                  borderColor: `${cat.color}40`,
                  borderWidth: '1px',
                } : undefined}
              >
                <span
                  className="h-2 w-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                {cat.name}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {cat.description}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
