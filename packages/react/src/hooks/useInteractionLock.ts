import { useLayoutEffect, type RefObject } from 'react';

/** Capture blocks shortcuts and edits before React can commit inert to the review subtree. */
export function useInteractionLock(pending: RefObject<boolean>, enabled = true): void {
  useLayoutEffect(() => {
    if (!enabled) return;
    const block = (event: Event) => {
      if (
        !pending.current ||
        (event.target instanceof Element && event.target.closest('[data-save-recovery]'))
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const names = [
      'keydown',
      'click',
      'beforeinput',
      'input',
      'change',
      'submit',
      'trigger-line-comment',
    ];
    names.forEach(name => window.addEventListener(name, block, true));
    return () => names.forEach(name => window.removeEventListener(name, block, true));
  }, [enabled, pending]);
}
