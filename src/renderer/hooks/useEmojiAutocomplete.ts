import { useState, useCallback, useEffect, useRef } from 'react';
import { searchEmojis, type EmojiMatch } from '../utils/emoji-data';

export interface EmojiAutocompleteState {
  isOpen: boolean;
  results: EmojiMatch[];
  selectedIndex: number;
  position: { top: number; left: number };
}

const TRIGGER_REGEX = /:(\w{2,})$/;

function getCaretPosition(
  textarea: HTMLTextAreaElement,
  cursorPos: number,
): { top: number; left: number } {
  const mirror = document.createElement('div');
  const style = window.getComputedStyle(textarea);

  // Copy relevant styles to mirror
  const stylesToCopy = [
    'font-family', 'font-size', 'font-weight', 'font-style',
    'letter-spacing', 'line-height', 'text-transform', 'word-spacing',
    'text-indent', 'white-space', 'word-wrap', 'overflow-wrap',
    'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
    'box-sizing', 'width',
  ];

  for (const prop of stylesToCopy) {
    mirror.style.setProperty(prop, style.getPropertyValue(prop));
  }

  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.overflow = 'hidden';
  mirror.style.height = 'auto';
  mirror.style.whiteSpace = 'pre-wrap';

  const textBeforeCursor = textarea.value.substring(0, cursorPos);
  const span = document.createElement('span');
  mirror.textContent = textBeforeCursor;
  span.textContent = '\u200b'; // zero-width space as marker
  mirror.appendChild(span);

  document.body.appendChild(mirror);
  const spanRect = span.getBoundingClientRect();
  const mirrorRect = mirror.getBoundingClientRect();
  document.body.removeChild(mirror);

  return {
    top: spanRect.top - mirrorRect.top - textarea.scrollTop,
    left: spanRect.left - mirrorRect.left - textarea.scrollLeft,
  };
}

export interface UseEmojiAutocompleteReturn {
  isOpen: boolean;
  results: EmojiMatch[];
  selectedIndex: number;
  position: { top: number; left: number };
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => boolean;
  selectEmoji: (emoji: EmojiMatch) => void;
  setSelectedIndex: (index: number) => void;
}

export function useEmojiAutocomplete(
  body: string,
  setBody: (value: string) => void,
  containerRef: React.RefObject<HTMLDivElement | null>,
): UseEmojiAutocompleteReturn {
  const [state, setState] = useState<EmojiAutocompleteState>({
    isOpen: false,
    results: [],
    selectedIndex: 0,
    position: { top: 0, left: 0 },
  });

  // Track the colon position for replacement
  const colonPosRef = useRef<number>(-1);

  useEffect(() => {
    const textarea = containerRef.current?.querySelector<HTMLTextAreaElement>(
      '.w-md-editor-text-input',
    );
    if (!textarea) {
      if (state.isOpen) {
        setState((prev) => ({ ...prev, isOpen: false, results: [] }));
      }
      return;
    }

    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = body.substring(0, cursorPos);
    const match = TRIGGER_REGEX.exec(textBeforeCursor);

    if (match) {
      const query = match[1];
      const results = searchEmojis(query);
      if (results.length > 0) {
        const colonIndex = cursorPos - match[0].length;
        colonPosRef.current = colonIndex;

        const caretPos = getCaretPosition(textarea, colonIndex);
        const textareaRect = textarea.getBoundingClientRect();
        const containerRect = containerRef.current!.getBoundingClientRect();

        setState({
          isOpen: true,
          results,
          selectedIndex: 0,
          position: {
            top: caretPos.top + (textareaRect.top - containerRect.top) + parseFloat(getComputedStyle(textarea).lineHeight || '20'),
            left: caretPos.left + (textareaRect.left - containerRect.left),
          },
        });
      } else {
        setState((prev) => ({ ...prev, isOpen: false, results: [] }));
      }
    } else {
      if (state.isOpen) {
        setState((prev) => ({ ...prev, isOpen: false, results: [] }));
      }
    }
  }, [body, containerRef]);

  const selectEmoji = useCallback(
    (emoji: EmojiMatch) => {
      const textarea = containerRef.current?.querySelector<HTMLTextAreaElement>(
        '.w-md-editor-text-input',
      );
      if (!textarea) return;

      const cursorPos = textarea.selectionStart;
      const colonIndex = colonPosRef.current;
      if (colonIndex < 0) return;

      const before = body.substring(0, colonIndex);
      const after = body.substring(cursorPos);
      const newBody = before + emoji.native + after;
      setBody(newBody);

      // Restore cursor position after the emoji
      const newCursorPos = colonIndex + emoji.native.length;
      requestAnimationFrame(() => {
        const ta = containerRef.current?.querySelector<HTMLTextAreaElement>(
          '.w-md-editor-text-input',
        );
        if (ta) {
          ta.selectionStart = newCursorPos;
          ta.selectionEnd = newCursorPos;
          ta.focus();
        }
      });

      setState((prev) => ({ ...prev, isOpen: false, results: [] }));
    },
    [body, setBody, containerRef],
  );

  const setSelectedIndex = useCallback((index: number) => {
    setState((prev) => ({ ...prev, selectedIndex: index }));
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (!state.isOpen) return false;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setState((prev) => ({
          ...prev,
          selectedIndex: (prev.selectedIndex + 1) % prev.results.length,
        }));
        return true;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setState((prev) => ({
          ...prev,
          selectedIndex:
            (prev.selectedIndex - 1 + prev.results.length) %
            prev.results.length,
        }));
        return true;
      }

      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (state.results[state.selectedIndex]) {
          selectEmoji(state.results[state.selectedIndex]);
        }
        return true;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        setState((prev) => ({ ...prev, isOpen: false, results: [] }));
        return true;
      }

      return false;
    },
    [state.isOpen, state.results, state.selectedIndex, selectEmoji],
  );

  return {
    isOpen: state.isOpen,
    results: state.results,
    selectedIndex: state.selectedIndex,
    position: state.position,
    onKeyDown,
    selectEmoji,
    setSelectedIndex,
  };
}
