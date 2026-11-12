import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SPANISH_REVIEW } from '../../../../src/shared/spanish-review';
import { ReviewProviders } from '../ReviewProviders';
import { ReviewPanel } from '../ReviewPanel';
import Toolbar from '../components/Toolbar';
import { KeyboardNavigationManager } from '../components/KeyboardNavigationManager';
import { ReviewShortcutToggle } from '../components/ReviewShortcutToggle';
import { LocalizationProvider } from '../localization/LocalizationContext';
import { useKeyboardNavigation } from './useKeyboardNavigation';
import { installBrowserApiStubs } from '../test-helpers';
installBrowserApiStubs();
afterEach(cleanup);
const files = [
  { oldPath: 'a.ts', newPath: 'a.ts', changeType: 'modified' as const, isBinary: false, hunks: [] },
];
const source = { type: 'directory' as const, sourcePath: '/review' };
const adapter = { loadDiff: async () => ({ files, source }) };
function Scope({
  name,
  initialCharacterShortcuts = true,
}: {
  name: string;
  initialCharacterShortcuts?: boolean;
}) {
  return (
    <ReviewProviders
      adapter={adapter}
      initialFiles={files}
      initialSource={source}
      initialCharacterShortcuts={initialCharacterShortcuts}
    >
      <section aria-label={name}>
        <KeyboardNavigationManager />
        <ReviewShortcutToggle />
        <div data-scroll-container='diff' data-testid={`${name}-scroll`} />
      </section>
    </ReviewProviders>
  );
}

it('toggles character shortcuts for only the selected review using localized accessible UI', () => {
  render(
    <LocalizationProvider locale='es' direction='rtl' messages={SPANISH_REVIEW}>
      <Scope name='first' />
      <Scope name='second' />
    </LocalizationProvider>
  );
  const a = within(screen.getByRole('region', { name: 'first' }));
  const b = within(screen.getByRole('region', { name: 'second' }));
  const firstScroll = screen.getByTestId('first-scroll');
  const secondScroll = screen.getByTestId('second-scroll');
  firstScroll.scrollBy = vi.fn();
  secondScroll.scrollBy = vi.fn();
  const toggle = b.getByRole('button', { name: 'Atajos de teclado (f, g, j, k)' });
  fireEvent.pointerDown(toggle);
  fireEvent.click(toggle);
  expect(toggle.getAttribute('aria-pressed')).toBe('false');
  expect(a.getByRole('button').getAttribute('aria-pressed')).toBe('true');
  fireEvent.pointerDown(secondScroll);
  fireEvent.keyDown(document, { key: 'j' });
  expect(secondScroll.scrollBy).not.toHaveBeenCalled();
  fireEvent.pointerDown(firstScroll);
  fireEvent.keyDown(document, { key: 'j' });
  expect(firstScroll.scrollBy).toHaveBeenCalledOnce();
  fireEvent.pointerDown(toggle);
  fireEvent.click(toggle);
  fireEvent.pointerDown(secondScroll);
  fireEvent.keyDown(document, { key: 'k' });
  expect(secondScroll.scrollBy).toHaveBeenCalledOnce();
  expect(firstScroll.scrollBy).toHaveBeenCalledOnce();
});

it('exposes the same opt-out through the first-party Toolbar without host changes', async () => {
  render(
    <ReviewPanel adapter={adapter}>
      <Toolbar />
    </ReviewPanel>
  );
  const toggle = await screen.findByRole('button', { name: 'Keyboard shortcuts (f, g, j, k)' });
  fireEvent.click(toggle);
  expect(toggle.getAttribute('aria-pressed')).toBe('false');
  const scroll = document.querySelector<HTMLElement>('[data-scroll-container="diff"]')!;
  scroll.scrollBy = vi.fn();
  fireEvent.pointerDown(scroll);
  fireEvent.keyDown(document, { key: 'j' });
  expect(scroll.scrollBy).not.toHaveBeenCalled();
});

it('supports an initially disabled embedded review without changing other keyboard events', () => {
  render(<Scope name='embedded' initialCharacterShortcuts={false} />);
  const scroll = screen.getByTestId('embedded-scroll');
  scroll.scrollBy = vi.fn();
  fireEvent.pointerDown(scroll);
  for (const key of ['f', 'g', 'j', 'k', 'Enter', ' ']) {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    fireEvent(document, event);
    expect(event.defaultPrevented).toBe(false);
  }
  expect(scroll.scrollBy).not.toHaveBeenCalled();
});

it.each([
  'handled',
  'composing',
  'composition-event',
  'ime-key',
  'alt',
  'editable',
  'select',
  'button',
  'focused-button',
  'aria-control',
] as const)('leaves %s events to their owner', kind => {
  render(<Scope name='review' />);
  const scroll = screen.getByTestId('review-scroll');
  scroll.scrollBy = vi.fn();
  fireEvent.pointerDown(scroll);
  const target = document.createElement(
    kind === 'select' ? 'select' : kind.includes('button') ? 'button' : 'div'
  );
  scroll.appendChild(target);
  if (kind === 'editable') target.setAttribute('contenteditable', 'plaintext-only');
  if (kind === 'aria-control') target.setAttribute('role', 'listbox');
  if (kind === 'focused-button') target.focus();
  const event = new KeyboardEvent('keydown', {
    key: 'j',
    bubbles: true,
    cancelable: true,
    isComposing: kind === 'composing',
    keyCode: kind === 'ime-key' ? 229 : 0,
    altKey: kind === 'alt',
  });
  if (kind === 'handled') event.preventDefault();
  if (kind === 'composition-event') fireEvent.compositionStart(target);
  fireEvent(kind === 'focused-button' ? document : target, event);
  expect(scroll.scrollBy).not.toHaveBeenCalled();
  if (kind !== 'handled') expect(event.defaultPrevented).toBe(false);
  if (kind === 'composition-event') {
    fireEvent.compositionEnd(target);
    fireEvent.keyDown(target, { key: 'j' });
    expect(scroll.scrollBy).toHaveBeenCalledOnce();
  }
});

it('clears active hints on opt-out and restores scoped hint discovery on opt-in', () => {
  let hints = 0;
  function Navigation() {
    hints = useKeyboardNavigation().hints.length;
    return null;
  }
  const click = vi.fn();
  const view = render(
    <ReviewProviders adapter={adapter} initialFiles={files} initialSource={source}>
      <Navigation />
      <ReviewShortcutToggle />
      <button data-hint-action='custom' onClick={click}>
        Action
      </button>
    </ReviewProviders>
  );
  const action = screen.getByRole('button', { name: 'Action' });
  action.getBoundingClientRect = () => new DOMRect(10, 10, 100, 20);
  // The toggle also occupies a hint only if it has a real visible rectangle.
  fireEvent.keyDown(document, { key: 'f' });
  expect(hints).toBe(1);
  fireEvent.click(screen.getByRole('button', { name: 'Keyboard shortcuts (f, g, j, k)' }));
  expect(hints).toBe(0);
  fireEvent.keyDown(document, { key: 'a' });
  expect(click).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Keyboard shortcuts (f, g, j, k)' }));
  fireEvent.keyDown(document, { key: 'f' });
  expect(hints).toBe(1);
  fireEvent.keyDown(document, { key: 'a' });
  expect(click).toHaveBeenCalledOnce();
  act(() => view.unmount());
});
