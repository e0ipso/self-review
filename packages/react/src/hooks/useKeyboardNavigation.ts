import { useState, useEffect, useRef, useCallback } from 'react';
import { reviewElement, reviewElements } from '../utils/review-root';
import { usePortalContainer } from '../context/ConfigContext';
import { useFileTreeExpansion } from '../context/FileTreeExpansionContext';
import { useDiffNavigationContext } from '../context/DiffNavigationContext';

export type HintMode = 'normal' | 'hint-diff' | 'hint-file';

export interface HintItem {
  label: string;
  element: HTMLElement;
  rect: DOMRect;
}

const HINT_CHARS = 'asdfjklhgqwertuiop'.split('');
const SCROLL_AMOUNT = 80;

// Semantic actions click their own controls. Keep the old composer IDs discoverable for hosts
// whose existing custom controls predate the marker; use the same selector for activation.
const CLICK_HINT_SELECTOR =
  '[data-comment-gutter], [data-hint-action], [data-testid="cancel-comment-btn"], [data-testid="add-comment-btn"], [data-testid^="category-option-"]';
const LINE_HINT_SELECTOR = '[data-line-type][data-line-number][data-line-side]';

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
  if (el.closest('[class*="md-editor"]') || el.closest('[data-color-mode]')) return true;
  return false;
}

function scrollDiff(root: HTMLElement | null, direction: 1 | -1): void {
  const container = reviewElement(root, '[data-scroll-container="diff"]');
  if (container) {
    container.scrollBy({ top: direction * SCROLL_AMOUNT, behavior: 'instant' });
  }
}

export function useKeyboardNavigation() {
  const root = usePortalContainer();
  const expansion = useFileTreeExpansion();
  const activeReview = useRef(false);
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
        if (hint.element.matches(CLICK_HINT_SELECTOR)) {
          hint.element.click();
          clearHintsRef.current();
          return;
        }

        // Diff line: trigger comment
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
          // ComposerCore focuses its own editor on mount; a document-wide focus here would steal it.
          hint.element.dispatchEvent(
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

  const enterHintMode = useCallback(
    (newMode: 'hint-diff' | 'hint-file') => {
      let selector: string;
      if (newMode === 'hint-diff') {
        selector = `${CLICK_HINT_SELECTOR}, ${LINE_HINT_SELECTOR}`;
      } else {
        const ready = expansion?.expand();
        if (ready === false) return;
        // Old custom layouts can still acknowledge synchronously through their root listener.
        if (ready === undefined) root?.dispatchEvent(new CustomEvent('expand-file-tree'));
        selector =
          '.file-tree [data-file-path], [data-testid="file-tree"] [data-file-path], button[data-file-path]';
      }

      const elements = reviewElements<HTMLElement>(root, selector);
      const visible: { element: HTMLElement; rect: DOMRect }[] = [];

      elements.forEach(el => {
        if (el.hasAttribute('data-line-type') && el.querySelector('[data-comment-gutter]')) return;
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
    },
    [root, expansion]
  );

  useEffect(() => {
    if (!root) return;
    root.setAttribute('data-review-shortcuts', '');
    const setActive = (active: boolean) => {
      if (!active && activeReview.current) clearHintsRef.current();
      activeReview.current = active;
      root.toggleAttribute('data-review-active', active);
    };
    setActive(document.querySelector('[data-review-shortcuts]') === root);
    const activate = (event: Event) => {
      setActive(
        event.target instanceof Element && event.target.closest('[data-review-shortcuts]') === root
      );
    };
    document.addEventListener('pointerdown', activate, true);
    document.addEventListener('focusin', activate, true);
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target;
      if (!document.querySelector('[data-review-active]'))
        setActive(document.querySelector('[data-review-shortcuts]') === root);
      if (!activeReview.current || isTextInputFocused()) return;
      if (target instanceof Element && target !== document.body && !root?.contains(target)) return;
      const focused = document.activeElement;
      if (focused && focused !== document.body && !root?.contains(focused)) return;

      const currentMode = modeRef.current;
      const currentHints = hintsRef.current;
      const currentBuffer = inputBufferRef.current;

      if (currentMode === 'normal') {
        // Don't handle single-key shortcuts when Ctrl/Cmd is held
        if (e.ctrlKey || e.metaKey) return;

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
            scrollDiff(root, 1);
            return;
          case 'k':
            e.preventDefault();
            scrollDiff(root, -1);
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
        const exactMatch = currentHints.find(h => h.label === newBuffer);
        if (exactMatch) {
          activateHint(exactMatch);
          return;
        }

        // Check for partial prefix match
        const hasPrefix = currentHints.some(h => h.label.startsWith(newBuffer));
        if (hasPrefix) {
          setInputBuffer(newBuffer);
        } else {
          // No match at all — dismiss
          clearHintsRef.current();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', activate, true);
      document.removeEventListener('focusin', activate, true);
      root.removeAttribute('data-review-shortcuts');
      root.removeAttribute('data-review-active');
    };
  }, [enterHintMode, activateHint, root]);

  // Dismiss hints on scroll
  useEffect(() => {
    if (mode === 'normal') return;

    const container = reviewElement(root, '[data-scroll-container="diff"]');
    if (!container) return;

    function handleScroll() {
      clearHintsRef.current();
    }

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [mode, root]);

  return { mode, hints, inputBuffer, clearHints };
}
