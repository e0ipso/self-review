import React from 'react';
import { useConfig } from '../../context/ConfigContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

export interface CategorySelectorProps {
  value: string | null;
  onChange: (category: string | null) => void;
}

export default function CategorySelector({ value, onChange }: CategorySelectorProps) {
  const { config } = useConfig();

  if (!config.categories || config.categories.length === 0) {
    return null;
  }

  return (
    <div data-testid="category-selector">
      <Select
        value={value || 'none'}
        onValueChange={(val) => onChange(val === 'none' ? null : val)}
      >
        <SelectTrigger className="h-7 w-[160px] text-xs">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none" className="text-xs">No category</SelectItem>
          {config.categories.map((cat) => (
            <SelectItem key={cat.name} value={cat.name} data-testid={`category-option-${cat.name}`} className="text-xs">
              <div className="flex items-center gap-2">
                <div
                  className="h-2 w-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                {cat.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
