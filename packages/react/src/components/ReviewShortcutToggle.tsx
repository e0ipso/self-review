import React from 'react';
import { Keyboard, KeyboardOff } from 'lucide-react';
import { useReviewShortcutPolicy } from '../context/ReviewShortcutContext';
import { useLocalization } from '../localization/LocalizationContext';
import { Button } from './ui/button';

/** Hosts with custom chrome can place the same per-review control outside Toolbar. */
export function ReviewShortcutToggle() {
  const policy = useReviewShortcutPolicy();
  const { t } = useLocalization();
  if (!policy) return null;
  const Icon = policy.characterShortcuts ? Keyboard : KeyboardOff;
  const label = `${t('Keyboard shortcuts')} (f, g, j, k)`;
  return (
    <Button
      variant='ghost'
      size='sm'
      data-hint-action='toggle-character-shortcuts'
      aria-label={label}
      aria-pressed={policy.characterShortcuts}
      title={label}
      onClick={() => policy.setCharacterShortcuts(!policy.characterShortcuts)}
    >
      <Icon aria-hidden='true' className='h-3.5 w-3.5' />
      <span className='sr-only'>{label}</span>
    </Button>
  );
}
