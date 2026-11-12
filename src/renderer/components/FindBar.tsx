import { MAX_FIND_QUERY_LENGTH } from '../../shared/find-limits';
import type { DesktopFindAPI } from '../../shared/types';
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { Input } from '../../../packages/react/src/components/ui/input';
import { Button } from '../../../packages/react/src/components/ui/button';
import { ChevronUp, ChevronDown, X } from 'lucide-react';
import { useDesktopLocalization } from '../useDesktopLocalization';
import { FindInPageResult } from '../../shared/types';

interface FindBarProps {
  isOpen: boolean;
  onClose: () => void;
  api?: DesktopFindAPI;
}

export function FindBar({ isOpen, onClose, api = window.electronAPI }: FindBarProps) {
  const { t } = useDesktopLocalization();
  const [query, setQuery] = useState('');
  const [activeMatch, setActiveMatch] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const lastSearchedQueryRef = useRef('');
  const inputRef = useRef<HTMLInputElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef(() => {});
  const latestApi = useRef(api);
  latestApi.current = api;
  const statusId = useId();
  const queryRefused = query.length > MAX_FIND_QUERY_LENGTH;

  // Declare all callbacks first
  const findNext = useCallback(() => {
    if (!query || queryRefused) return;

    // Check if this is a new search or cycling through existing results
    const isNewSearch = query !== lastSearchedQueryRef.current;

    // Chromium starts at the focused element and matches the query text in this very input (ordinal 0,
    // counter "0 of N" on Chromium 152). Blurring first starts the session in the document.
    if (isNewSearch) inputRef.current?.blur();
    api.findInPage({ text: query, forward: true, findNext: isNewSearch });

    // Update the last searched query after initiating search
    lastSearchedQueryRef.current = query;
  }, [query, queryRefused, api]);

  const findPrevious = useCallback(() => {
    if (!query || queryRefused) return;

    // Check if this is a new search or cycling through existing results
    const isNewSearch = query !== lastSearchedQueryRef.current;

    // Blur first, as above.
    if (isNewSearch) inputRef.current?.blur();
    api.findInPage({ text: query, forward: false, findNext: isNewSearch });

    // Update the last searched query after initiating search
    lastSearchedQueryRef.current = query;
  }, [query, queryRefused, api]);

  const handleClose = useCallback(() => {
    api.stopFindInPage('clearSelection');
    restoreFocusRef.current();
    onClose();
  }, [onClose, api]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          findPrevious();
        } else {
          findNext();
        }
      }
    },
    [handleClose, findNext, findPrevious]
  );

  // Capture focus before the portal takes it. A connected external target selected later
  // becomes the return target; closing must not steal focus from another active control.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const owner = api;
    const bar = barRef.current;
    let prior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (prior === document.body || bar?.contains(prior)) prior = null;
    const remember = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target !== document.body && !bar?.contains(target))
        prior = target;
    };
    const restore = () => {
      if (latestApi.current !== owner || !prior?.isConnected) return;
      const active = document.activeElement;
      if (active !== document.body && active !== null && !bar?.contains(active)) return;
      if (prior.closest('[inert], [hidden], [aria-hidden="true"]') || prior.matches(':disabled'))
        return;
      prior.focus({ preventScroll: true });
    };
    restoreFocusRef.current = restore;
    document.addEventListener('focusin', remember);
    inputRef.current?.focus();
    inputRef.current?.select();
    return () => {
      document.removeEventListener('focusin', remember);
      owner.stopFindInPage('clearSelection');
      restore();
      restoreFocusRef.current = () => {};
    };
  }, [isOpen, api]);

  // Subscribe to find results from main process
  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = api.onFindResult((result: FindInPageResult) => {
      if (result.finalUpdate) {
        setActiveMatch(result.activeMatchOrdinal);
        setTotalMatches(result.matches);
        // Don't refocus — Chromium's findInPage steals focus to highlight
        // matches, and refocusing invalidates the find session, breaking
        // Enter/button cycling. The global keydown handler catches Enter
        // when input doesn't have focus.
      }
    });

    return unsubscribe;
  }, [isOpen, api]);

  // Global keydown listener to handle Escape and Enter even when input loses focus
  // (Chromium's findInPage can steal focus from the input)
  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
        return;
      }

      // Only handle Enter if target is not a text input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.key === 'Enter' && query) {
        e.preventDefault();
        if (e.shiftKey) {
          findPrevious();
        } else {
          findNext();
        }
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen, query, findNext, findPrevious, handleClose]);

  // Clear highlights when query is emptied
  useEffect(() => {
    if ((!query || queryRefused) && lastSearchedQueryRef.current) {
      api.stopFindInPage('clearSelection');
      setActiveMatch(0);
      setTotalMatches(0);
      lastSearchedQueryRef.current = '';
    }
  }, [query, queryRefused, api]);

  // Clear highlights when closing
  useEffect(() => {
    if (!isOpen) {
      api.stopFindInPage('clearSelection');
      setActiveMatch(0);
      setTotalMatches(0);
      setQuery('');
      lastSearchedQueryRef.current = '';
    }
  }, [isOpen, api]);

  if (!isOpen) return null;

  // Chromium's findInPage searches the entire DOM including the find bar's
  // own input, so the query text in the input always counts as one extra match.
  // Subtract 1 from the total and cap the active ordinal accordingly.
  const adjustedTotal = Math.max(0, totalMatches - 1);
  const adjustedActive = Math.min(activeMatch, adjustedTotal);
  const searched = query && lastSearchedQueryRef.current === query;
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
