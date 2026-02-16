import { useState, useEffect, useRef, useCallback } from 'react';
import { useDiffNavigationContext } from '../context/DiffNavigationContext';

export type HintMode = 'normal' | 'hint-diff' | 'hint-file';

export interface HintItem {
  label: string;
  element: HTMLElement;
  rect: DOMRect;
}

const HINT_CHARS = 'asdfjklhgqwertuiop'.split('');
const SCROLL_AMOUNT = 80;

export function generateLabels(count: number): string[] {
  if (count <= HINT_CHARS.length) return HINT_CHARS.slice(0, count);
  const labels: string[] = [];
  for (const a of HINT_CHARS) {
    for (const b of HINT_CHARS) {
      labels.push(a + b);
      if (labels.length >= count) return labels;
    }
  }
  return labels;
}

export function isTextInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea') return true;
  if (el.getAttribute('contenteditable') === 'true') return true;
  if (el.closest('[class*="md-editor"]') || el.closest('[data-color-mode]'))
    return true;
  return false;
}

function scrollDiff(direction: 1 | -1): void {
  const container = document.querySelector('[data-scroll-container="diff"]');
  if (container) {
    container.scrollBy({ top: direction * SCROLL_AMOUNT, behavior: 'instant' });
  }
}

export function useKeyboardNavigation() {
  const [mode, setMode] = useState<HintMode>('normal');
  const [hints, setHints] = useState<HintItem[]>([]);
  const [inputBuffer, setInputBuffer] = useState('');

  const { scrollToFile } = useDiffNavigationContext();

  const modeRef = useRef(mode);
  const hintsRef = useRef(hints);
  const inputBufferRef = useRef(inputBuffer);

  modeRef.current = mode;
  hintsRef.current = hints;
  inputBufferRef.current = inputBuffer;

  const clearHints = useCallback(() => {
    setMode('normal');
    setHints([]);
    setInputBuffer('');
  }, []);

  const clearHintsRef = useRef(clearHints);
  clearHintsRef.current = clearHints;

  const activateHint = useCallback(
    (hint: HintItem) => {
      if (modeRef.current === 'hint-diff') {
        const lineNumber = hint.element.getAttribute('data-line-number');
        const side = hint.element.getAttribute('data-line-side');
        let filePath: string | null = null;

        let ancestor: HTMLElement | null = hint.element;
        while (ancestor) {
          const fp = ancestor.getAttribute('data-file-path');
          if (fp) {
            filePath = fp;
            break;
          }
          ancestor = ancestor.parentElement;
        }

        if (filePath && lineNumber && side) {
          document.dispatchEvent(
            new CustomEvent('trigger-line-comment', {
              bubbles: true,
              detail: {
                filePath,
                lineNumber: parseInt(lineNumber, 10),
                side,
              },
            })
          );
        }
      } else if (modeRef.current === 'hint-file') {
        const filePath = hint.element.getAttribute('data-file-path');
        if (filePath) {
          scrollToFile(filePath);
        }
      }

      clearHintsRef.current();
    },
    [scrollToFile]
  );

  const enterHintMode = useCallback((newMode: 'hint-diff' | 'hint-file') => {
    let selector: string;
    if (newMode === 'hint-diff') {
      selector =
        '[data-line-type="addition"][data-line-number][data-line-side], [data-line-type="deletion"][data-line-number][data-line-side]';
    } else {
      selector =
        '.file-tree [data-file-path], [data-testid="file-tree"] [data-file-path], button[data-file-path]';
    }

    const elements = document.querySelectorAll<HTMLElement>(selector);
    const visible: { element: HTMLElement; rect: DOMRect }[] = [];

    elements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= window.innerHeight &&
        rect.right <= window.innerWidth &&
        rect.width > 0 &&
        rect.height > 0
      ) {
        visible.push({ element: el, rect });
      }
    });

    if (visible.length === 0) return;

    const labels = generateLabels(visible.length);
    const hintItems: HintItem[] = visible.map((v, i) => ({
      label: labels[i],
      element: v.element,
      rect: v.rect,
    }));

    setMode(newMode);
    setHints(hintItems);
    setInputBuffer('');
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isTextInputFocused()) return;

      const currentMode = modeRef.current;
      const currentHints = hintsRef.current;
      const currentBuffer = inputBufferRef.current;

      if (currentMode === 'normal') {
        switch (e.key) {
          case 'f':
            e.preventDefault();
            enterHintMode('hint-diff');
            return;
          case 'g':
            e.preventDefault();
            enterHintMode('hint-file');
            return;
          case 'j':
            e.preventDefault();
            scrollDiff(1);
            return;
          case 'k':
            e.preventDefault();
            scrollDiff(-1);
            return;
          default:
            return;
        }
      }

      // In hint mode
      if (e.key === 'Escape') {
        e.preventDefault();
        clearHintsRef.current();
        return;
      }

      if (/^[a-z0-9]$/i.test(e.key)) {
        e.preventDefault();
        const newBuffer = currentBuffer + e.key.toLowerCase();

        // Check for exact match
        const exactMatch = currentHints.find((h) => h.label === newBuffer);
        if (exactMatch) {
          activateHint(exactMatch);
          return;
        }

        // Check for partial prefix match
        const hasPrefix = currentHints.some((h) =>
          h.label.startsWith(newBuffer)
        );
        if (hasPrefix) {
          setInputBuffer(newBuffer);
        } else {
          // No match at all — dismiss
          clearHintsRef.current();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enterHintMode, activateHint]);

  // Dismiss hints on scroll
  useEffect(() => {
    if (mode === 'normal') return;

    const container = document.querySelector('[data-scroll-container="diff"]');
    if (!container) return;

    function handleScroll() {
      clearHintsRef.current();
    }

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [mode]);

  return { mode, hints, inputBuffer, clearHints };
}
