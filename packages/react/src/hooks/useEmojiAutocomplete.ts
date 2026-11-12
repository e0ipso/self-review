import { useState, useCallback, useEffect, useRef, useId } from 'react';
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
  cursorPos: number
): { top: number; left: number } {
  const mirror = document.createElement('div');
  const style = window.getComputedStyle(textarea);

  // Copy relevant styles to mirror
  const stylesToCopy = [
    'font-family',
    'font-size',
    'font-weight',
    'font-style',
    'letter-spacing',
    'line-height',
    'text-transform',
    'word-spacing',
    'text-indent',
    'white-space',
    'word-wrap',
    'overflow-wrap',
    'padding-top',
    'padding-right',
    'padding-bottom',
    'padding-left',
    'border-top-width',
    'border-right-width',
    'border-bottom-width',
    'border-left-width',
    'box-sizing',
    'width',
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
  /** Pass to EmojiAutocomplete to link it to this editor. */
  popupId?: string;
  /** Keep the native multiline textbox role; combobox is a single-line input pattern. */
  textareaProps?: Pick<
    React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    | 'aria-autocomplete'
    | 'aria-controls'
    | 'aria-activedescendant'
    | 'aria-describedby'
    | 'aria-haspopup'
  >;
}

export function useEmojiAutocomplete(
  body: string,
  setBody: (value: string) => void,
  containerRef: React.RefObject<HTMLDivElement | null>
): UseEmojiAutocompleteReturn {
  const [state, setState] = useState<EmojiAutocompleteState>({
    isOpen: false,
    results: [],
    selectedIndex: 0,
    position: { top: 0, left: 0 },
  });

  const popupId = `emoji-${useId()}`;
  const colonPosRef = useRef(-1);
  const composing = useRef(false);
  const dismissed = useRef('');
  const cursorFrame = useRef<number | null>(null);
  const close = useCallback(() => {
    colonPosRef.current = -1;
    setState(previous =>
      previous.isOpen ? { ...previous, isOpen: false, results: [] } : previous
    );
  }, []);

  useEffect(
    () => () => {
      if (cursorFrame.current !== null) cancelAnimationFrame(cursorFrame.current);
    },
    []
  );

  useEffect(() => {
    const textarea =
      containerRef.current?.querySelector<HTMLTextAreaElement>('.w-md-editor-text-input');
    if (!textarea) {
      close();
      return;
    }
    const update = () => {
      const cursor = textarea.selectionStart;
      const signature = `${cursor}:${textarea.value}`;
      const match = TRIGGER_REGEX.exec(textarea.value.substring(0, cursor));
      if (
        document.activeElement !== textarea ||
        composing.current ||
        textarea.selectionEnd !== cursor ||
        !match ||
        dismissed.current === signature
      ) {
        close();
        return;
      }
      const results = searchEmojis(match[1]);
      if (!results.length) {
        close();
        return;
      }
      const colonIndex = cursor - match[0].length;
      const sameTrigger = colonPosRef.current === colonIndex;
      colonPosRef.current = colonIndex;
      const caretPos = getCaretPosition(textarea, colonIndex);
      const textareaRect = textarea.getBoundingClientRect();
      const containerRect = containerRef.current!.getBoundingClientRect();
      setState(previous => ({
        isOpen: true,
        results,
        selectedIndex:
          sameTrigger &&
          previous.results.map(item => item.id).join() === results.map(item => item.id).join()
            ? previous.selectedIndex
            : 0,
        position: {
          top:
            caretPos.top +
            textareaRect.top -
            containerRect.top +
            (parseFloat(getComputedStyle(textarea).lineHeight) || 20),
          left: caretPos.left + textareaRect.left - containerRect.left,
        },
      }));
    };
    const startComposition = () => {
      composing.current = true;
      close();
    };
    const endComposition = () => {
      composing.current = false;
      update();
    };
    const events = ['focus', 'select', 'keyup', 'pointerup', 'scroll', 'input'] as const;
    events.forEach(event => textarea.addEventListener(event, update));
    textarea.addEventListener('blur', close);
    textarea.addEventListener('compositionstart', startComposition);
    textarea.addEventListener('compositionend', endComposition);
    // Keyboard and pointer selection changes may also be reported at the document boundary.
    document.addEventListener('selectionchange', update);
    update();
    return () => {
      events.forEach(event => textarea.removeEventListener(event, update));
      textarea.removeEventListener('blur', close);
      textarea.removeEventListener('compositionstart', startComposition);
      textarea.removeEventListener('compositionend', endComposition);
      document.removeEventListener('selectionchange', update);
    };
  }, [body, containerRef, close]);

  const selectEmoji = useCallback(
    (emoji: EmojiMatch) => {
      const textarea =
        containerRef.current?.querySelector<HTMLTextAreaElement>('.w-md-editor-text-input');
      if (!textarea || document.activeElement !== textarea || composing.current) return;
      const cursor = textarea.selectionStart;
      const match = TRIGGER_REGEX.exec(textarea.value.substring(0, cursor));
      const colon = colonPosRef.current;
      // A pointer selection must still match the live caret, not an earlier query.
      if (
        !match ||
        colon < 0 ||
        cursor - match[0].length !== colon ||
        textarea.selectionEnd !== cursor
      ) {
        close();
        return;
      }
      const nextBody =
        textarea.value.substring(0, colon) + emoji.native + textarea.value.substring(cursor);
      setBody(nextBody);
      dismissed.current = `${colon + emoji.native.length}:${nextBody}`;
      if (cursorFrame.current !== null) cancelAnimationFrame(cursorFrame.current);
      cursorFrame.current = requestAnimationFrame(() => {
        cursorFrame.current = null;
        if (
          textarea.isConnected &&
          document.activeElement === textarea &&
          textarea.value === nextBody
        ) {
          textarea.setSelectionRange(colon + emoji.native.length, colon + emoji.native.length);
        }
      });
      close();
    },
    [setBody, containerRef, close]
  );

  const setSelectedIndex = useCallback((index: number) => {
    setState(prev => ({
      ...prev,
      selectedIndex: Math.max(0, Math.min(index, prev.results.length - 1)),
    }));
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (!state.isOpen || composing.current || e.nativeEvent.isComposing || e.keyCode === 229)
        return false;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setState(prev => ({
          ...prev,
          selectedIndex: (prev.selectedIndex + 1) % prev.results.length,
        }));
        return true;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setState(prev => ({
          ...prev,
          selectedIndex: (prev.selectedIndex - 1 + prev.results.length) % prev.results.length,
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
        dismissed.current = `${e.currentTarget.selectionStart}:${e.currentTarget.value}`;
        close();
        return true;
      }

      return false;
    },
    [state.isOpen, state.results, state.selectedIndex, selectEmoji, close]
  );

  return {
    isOpen: state.isOpen,
    results: state.results,
    selectedIndex: state.selectedIndex,
    position: state.position,
    onKeyDown,
    selectEmoji,
    setSelectedIndex,
    popupId,
    textareaProps: {
      'aria-autocomplete': 'list',
      'aria-haspopup': 'listbox',
      'aria-controls': state.isOpen ? popupId : undefined,
      'aria-activedescendant': state.isOpen
        ? `${popupId}-option-${state.selectedIndex}`
        : undefined,
      'aria-describedby': `${popupId}-status`,
    },
  };
}
