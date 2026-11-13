import React, { StrictMode } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useInteractionLock } from './useInteractionLock';
afterEach(cleanup);
it('reads the pending ref synchronously through StrictMode replay and releases capture on disposal', () => {
  const pending = { current: false };
  const listener = vi.fn();
  function Lock() {
    useInteractionLock(pending);
    return <input onClick={listener} />;
  }
  const view = render(
    <StrictMode>
      <Lock />
    </StrictMode>
  );
  const input = view.container.querySelector('input')!;
  fireEvent.click(input);
  expect(listener).toHaveBeenCalledOnce();
  pending.current = true;
  const blocked = new Event('click', { bubbles: true, cancelable: true });
  fireEvent(input, blocked);
  expect(blocked.defaultPrevented).toBe(true);
  expect(listener).toHaveBeenCalledOnce();
  pending.current = false;
  fireEvent.click(input);
  expect(listener).toHaveBeenCalledTimes(2);
  view.unmount();
  pending.current = true;
  const disposed = new Event('click', { bubbles: true, cancelable: true });
  window.dispatchEvent(disposed);
  expect(disposed.defaultPrevented).toBe(false);
});
