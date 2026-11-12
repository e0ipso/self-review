import { MAX_FIND_QUERY_LENGTH } from '../../shared/find-limits';
import type { DesktopFindAPI } from '../../shared/types';
import React, { useId } from 'react';
import { createPortal } from 'react-dom';
import { Input } from '../../../packages/react/src/components/ui/input';
import { Button } from '../../../packages/react/src/components/ui/button';
import { ChevronUp, ChevronDown, X } from 'lucide-react';
import { useDesktopLocalization } from '../useDesktopLocalization';
import { useNativeFindSession } from '../useNativeFindSession';

interface FindBarProps {
  isOpen: boolean;
  onClose: () => void;
  api?: DesktopFindAPI;
}

export function FindBar({ isOpen, onClose, api = window.electronAPI }: FindBarProps) {
  const { t } = useDesktopLocalization();
  const {
    query,
    setQuery,
    queryRefused,
    searched,
    adjustedTotal,
    adjustedActive,
    inputRef,
    barRef,
    handleKeyDown,
    handleClose,
    findNext,
    findPrevious,
  } = useNativeFindSession(isOpen, onClose, api);
  const statusId = useId();

  if (!isOpen) return null;

  const matchDisplay = queryRefused
    ? t('Search is too long. Use at most {limit} characters.', { limit: MAX_FIND_QUERY_LENGTH })
    : searched
      ? adjustedTotal > 0
        ? t('{active} of {total}', { active: adjustedActive, total: adjustedTotal })
        : t('No results')
      : '';

  return createPortal(
    <div
      ref={barRef}
      className='fixed flex items-center gap-1 rounded-md border bg-background p-1.5 shadow-lg'
      style={{ top: 44, insetInlineEnd: 16, zIndex: 9998 }}
    >
      <Input
        ref={inputRef}
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label={t('Find in page')}
        aria-invalid={queryRefused || undefined}
        aria-describedby={statusId}
        placeholder={t('Find...')}
        className='h-7 w-52 text-sm'
      />
      <span
        id={statusId}
        role='status'
        aria-live='polite'
        aria-atomic='true'
        className='min-w-[5rem] px-1.5 text-center text-xs text-muted-foreground'
      >
        {matchDisplay}
      </span>
      <Button
        variant='ghost'
        size='icon'
        className='h-7 w-7'
        onClick={findPrevious}
        disabled={!query || queryRefused || adjustedTotal === 0}
        aria-label={t('Previous match')}
        title={t('Previous match (Shift+Enter)')}
      >
        <ChevronUp className='h-4 w-4' />
      </Button>
      <Button
        variant='ghost'
        size='icon'
        className='h-7 w-7'
        onClick={findNext}
        disabled={!query || queryRefused || adjustedTotal === 0}
        aria-label={t('Next match')}
        title={t('Next match (Enter)')}
      >
        <ChevronDown className='h-4 w-4' />
      </Button>
      <Button
        variant='ghost'
        size='icon'
        className='h-7 w-7'
        onClick={handleClose}
        aria-label={t('Close find bar')}
        title={t('Close (Escape)')}
      >
        <X className='h-4 w-4' />
      </Button>
    </div>,
    document.body
  );
}
