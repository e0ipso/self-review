import React, { useRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useInteractionLock } from './useInteractionLock';

it('blocks exactly the existing capture scope, permits recovery, and cleans up when disabled', () => {
  function Lock({ enabled }: { enabled: boolean }) {
    const pending = useRef(true);
    useInteractionLock(pending, enabled);
    return (
      <>
        <input aria-label='Editor' />
        <div data-save-recovery>
          <button>Recovery</button>
        </div>
      </>
    );
  }
  const f = render(<Lock enabled />);
  const listener = vi.fn();
  const names = [
    'keydown',
    'click',
    'beforeinput',
    'input',
    'change',
    'submit',
    'trigger-line-comment',
  ];
  names.forEach(name => document.addEventListener(name, listener));
  document.addEventListener('keyup', listener);
  try {
    for (const name of names) {
      const event = new Event(name, { bubbles: true, cancelable: true });
      fireEvent(screen.getByLabelText('Editor'), event);
      expect(event.defaultPrevented).toBe(true);
    }
    expect(listener).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Recovery'));
    fireEvent.keyUp(document, { key: 'f' });
    expect(listener).toHaveBeenCalledTimes(2);
    f.rerender(<Lock enabled={false} />);
    fireEvent.keyDown(document, { key: 'f' });
    expect(listener).toHaveBeenCalledTimes(3);
    f.unmount();
    fireEvent.click(document);
    expect(listener).toHaveBeenCalledTimes(4);
  } finally {
    names.forEach(name => document.removeEventListener(name, listener));
    document.removeEventListener('keyup', listener);
  }
});
