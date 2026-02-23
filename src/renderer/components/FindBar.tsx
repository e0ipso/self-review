import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { ChevronUp, ChevronDown, X } from 'lucide-react';
import { FindInPageResult } from '../../shared/types';

interface FindBarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FindBar({ isOpen, onClose }: FindBarProps) {
  const [query, setQuery] = useState('');
  const [activeMatch, setActiveMatch] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const lastSearchedQueryRef = useRef('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Declare all callbacks first
  const findNext = useCallback(() => {
    if (!query) return;

    // Check if this is a new search or cycling through existing results
    const isNewSearch = query !== lastSearchedQueryRef.current;
    window.electronAPI.findInPage({ text: query, forward: true, findNext: !isNewSearch });

    // Update the last searched query after initiating search
    lastSearchedQueryRef.current = query;
  }, [query]);

  const findPrevious = useCallback(() => {
    if (!query) return;

    // Check if this is a new search or cycling through existing results
    const isNewSearch = query !== lastSearchedQueryRef.current;
    window.electronAPI.findInPage({ text: query, forward: false, findNext: !isNewSearch });

    // Update the last searched query after initiating search
    lastSearchedQueryRef.current = query;
  }, [query]);

  const handleClose = useCallback(() => {
    window.electronAPI.stopFindInPage('clearSelection');
    onClose();
  }, [onClose]);

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

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isOpen]);

  // Subscribe to find results from main process
  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = window.electronAPI.onFindResult((result: FindInPageResult) => {
      if (result.finalUpdate) {
        setActiveMatch(result.activeMatchOrdinal);
        setTotalMatches(result.matches);
        // Don't refocus - let the global Enter handler work without input focus
      }
    });

    return unsubscribe;
  }, [isOpen]);

  // Global keydown listener to handle Enter even when input loses focus
  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Only handle if target is not a text input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
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
  }, [isOpen, query, findNext, findPrevious]);

  // Clear highlights when closing
  useEffect(() => {
    if (!isOpen) {
      window.electronAPI.stopFindInPage('clearSelection');
      setActiveMatch(0);
      setTotalMatches(0);
      setQuery('');
      lastSearchedQueryRef.current = '';
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const matchDisplay = query
    ? totalMatches > 0
      ? `${activeMatch} of ${totalMatches}`
      : 'No results'
    : '';

  return createPortal(
    <div
      className="fixed flex items-center gap-1 rounded-md border bg-background p-1.5 shadow-lg"
      style={{ top: 44, right: 16, zIndex: 9998 }}
    >
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Find..."
        className="h-7 w-52 text-sm"
      />
      <span className="min-w-[5rem] px-1.5 text-center text-xs text-muted-foreground">
        {matchDisplay}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={findPrevious}
        disabled={!query || totalMatches === 0}
        title="Previous match (Shift+Enter)"
      >
        <ChevronUp className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={findNext}
        disabled={!query || totalMatches === 0}
        title="Next match (Enter)"
      >
        <ChevronDown className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={handleClose}
        title="Close (Escape)"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>,
    document.body
  );
}
