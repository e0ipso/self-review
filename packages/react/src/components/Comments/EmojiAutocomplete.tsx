import React, { useRef, useEffect, useId } from 'react';
import { useLocalization } from '../../localization/LocalizationContext';
import type { EmojiMatch } from '../../utils/emoji-data';

export interface EmojiAutocompleteProps {
  /** Use the hook popupId to connect the focused textarea. Legacy callers may omit it. */
  popupId?: string;
  isOpen: boolean;
  results: EmojiMatch[];
  selectedIndex: number;
  position: { top: number; left: number };
  onSelect: (emoji: EmojiMatch) => void;
  onHover: (index: number) => void;
}

export default function EmojiAutocomplete({
  popupId,
  isOpen,
  results,
  selectedIndex,
  position,
  onSelect,
  onHover,
}: EmojiAutocompleteProps) {
  const { t } = useLocalization();
  const generatedId = useId();
  const id = popupId ?? `emoji-${generatedId}`;
  const selected = results[selectedIndex];
  const open = isOpen && results.length > 0;
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!listRef.current) return;
    const selectedEl = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    selectedEl?.scrollIntoView?.({ block: 'nearest' });
  }, [selectedIndex, open]);

  return (
    <>
      <span
        id={`${id}-status`}
        role='status'
        aria-live='polite'
        aria-atomic='true'
        className='sr-only'
      >
        {open && selected
          ? t(
              'Emoji suggestion {index} of {count}: {name}. Use Up and Down to choose, Enter or Tab to insert, Escape to close.',
              {
                index: selectedIndex + 1,
                count: results.length,
                name: selected.name,
              }
            )
          : ''}
      </span>
      {open && (
        <div
          ref={listRef}
          id={id}
          role='listbox'
          aria-label={t('Emoji suggestions')}
          className='absolute z-50 w-64 max-h-56 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md'
          style={{ top: position.top, left: position.left }}
          data-testid='emoji-autocomplete'
        >
          {results.map((emoji, index) => (
            <div
              key={emoji.id}
              id={`${id}-option-${index}`}
              role='option'
              aria-label={t('Emoji {name}', { name: emoji.name })}
              aria-selected={index === selectedIndex}
              className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer text-sm ${
                index === selectedIndex ? 'bg-accent text-accent-foreground' : ''
              }`}
              onMouseDown={e => {
                // Use mousedown instead of click to fire before textarea blur
                e.preventDefault();
                onSelect(emoji);
              }}
              onMouseEnter={() => onHover(index)}
            >
              <span className='text-lg leading-none'>{emoji.native}</span>
              <span className='text-muted-foreground truncate'>:{emoji.id}:</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
