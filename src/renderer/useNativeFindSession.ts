import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import type React from 'react';
import { MAX_FIND_QUERY_LENGTH } from '../shared/find-limits';
import type { DesktopFindAPI, FindInPageResult } from '../shared/types';

/** Owns native Find, subscriptions and focus for one open bar and bridge. */
export function useNativeFindSession(isOpen: boolean, onClose: () => void, api: DesktopFindAPI) {
  const [query, setQuery] = useState('');
  const [activeMatch, setActiveMatch] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const lastSearchedQueryRef = useRef('');
  const inputRef = useRef<HTMLInputElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef(() => {});
  const latestApi = useRef(api);
  latestApi.current = api;
  const queryRefused = query.length > MAX_FIND_QUERY_LENGTH;

  const find = useCallback(
    (forward: boolean) => {
      if (!query || queryRefused) return;
      const isNewSearch = query !== lastSearchedQueryRef.current;
      // Chromium otherwise starts at the query input and counts its text as a match.
      // Blurring a new search starts the native session in the document.
      if (isNewSearch) inputRef.current?.blur();
      api.findInPage({ text: query, forward, findNext: isNewSearch });
      lastSearchedQueryRef.current = query;
    },
    [query, queryRefused, api]
  );
  const findNext = useCallback(() => find(true), [find]);
  const findPrevious = useCallback(() => find(false), [find]);

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

      // Native Find can leave focus on the document. A focused control owns
      // its own Enter behavior, including controls with custom ARIA roles.
      if (
        e.target !== document &&
        e.target !== document.body &&
        e.target !== document.documentElement
      )
        return;

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

  // Chromium's findInPage searches the entire DOM including the find bar's
  // own input, so the query text in the input always counts as one extra match.
  // Subtract 1 from the total and cap the active ordinal accordingly.
  const adjustedTotal = Math.max(0, totalMatches - 1);
  const adjustedActive = Math.min(activeMatch, adjustedTotal);
  const searched = !!query && lastSearchedQueryRef.current === query;
  return {
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
  };
}
