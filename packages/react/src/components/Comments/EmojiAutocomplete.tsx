import React, { useRef, useEffect } from 'react';
import type { EmojiMatch } from '../../utils/emoji-data';

export interface EmojiAutocompleteProps {
  isOpen: boolean;
  results: EmojiMatch[];
  selectedIndex: number;
  position: { top: number; left: number };
  onSelect: (emoji: EmojiMatch) => void;
  onHover: (index: number) => void;
}

export default function EmojiAutocomplete({
  isOpen,
  results,
  selectedIndex,
  position,
  onSelect,
  onHover,
}: EmojiAutocompleteProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!listRef.current) return;
    const selectedEl = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    selectedEl?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!isOpen || results.length === 0) return null;

  return (
    <div
      ref={listRef}
      className="absolute z-50 w-64 max-h-56 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md"
      style={{ top: position.top, left: position.left }}
      data-testid="emoji-autocomplete"
    >
      {results.map((emoji, index) => (
        <div
          key={emoji.id}
          className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer text-sm ${
            index === selectedIndex ? 'bg-accent text-accent-foreground' : ''
          }`}
          onMouseDown={(e) => {
            // Use mousedown instead of click to fire before textarea blur
            e.preventDefault();
            onSelect(emoji);
          }}
          onMouseEnter={() => onHover(index)}
        >
          <span className="text-lg leading-none">{emoji.native}</span>
          <span className="text-muted-foreground truncate">:{emoji.id}:</span>
        </div>
      ))}
    </div>
  );
}
