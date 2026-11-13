import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { FindBar } from './FindBar';

it('names every control and supports find and close by keyboard', () => {
  const api = { findInPage: vi.fn(), stopFindInPage: vi.fn(), onFindResult: vi.fn(() => () => {}) };
  const onClose = vi.fn();
  const mounted = render(<FindBar isOpen onClose={onClose} api={api} />);
  const input = screen.getByRole('textbox', { name: 'Find in page' });
  expect(document.activeElement).toBe(input);
  for (const name of ['Previous match', 'Next match', 'Close find bar'])
    expect(screen.getByRole('button', { name })).toBeTruthy();
  fireEvent.change(input, { target: { value: 'hello' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(api.findInPage).toHaveBeenCalledWith({ text: 'hello', forward: true, findNext: true });
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(onClose).toHaveBeenCalledOnce();
  expect(api.stopFindInPage).toHaveBeenCalledWith('clearSelection');
  const off = api.onFindResult.mock.results[0].value;
  mounted.unmount();
  expect(typeof off).toBe('function');
});

import { act } from '@testing-library/react';
import { MAX_FIND_QUERY_LENGTH } from '../../shared/find-limits';
import type { FindInPageResult } from '../../shared/types';

function focusFixture() {
  const callbacks = new Set<(result: FindInPageResult) => void>();
  const api = {
    findInPage: vi.fn(),
    stopFindInPage: vi.fn(),
    onFindResult: vi.fn((callback: (result: FindInPageResult) => void) => {
      callbacks.add(callback);
      return () => {
        callbacks.delete(callback);
      };
    }),
  };
  const prior = document.createElement('button');
  document.body.append(prior);
  prior.focus();
  return {
    api,
    callbacks,
    prior,
    result: (matches: number, activeMatchOrdinal = 1) => {
      act(() => {
        for (const callback of callbacks)
          callback({ matches, activeMatchOrdinal, finalUpdate: true });
      });
    },
  };
}
it.each(['button', 'input-escape', 'global-escape', 'prop', 'unmount'] as const)(
  'restores the live prior target when closed through %s',
  mode => {
    const f = focusFixture();
    const onClose = vi.fn();
    const mounted = render(<FindBar isOpen onClose={onClose} api={f.api} />);
    const input = screen.getByRole('textbox', { name: 'Find in page' });
    expect(document.activeElement).toBe(input);
    if (mode === 'button') fireEvent.click(screen.getByRole('button', { name: 'Close find bar' }));
    if (mode === 'input-escape') fireEvent.keyDown(input, { key: 'Escape' });
    if (mode === 'global-escape') {
      fireEvent.change(input, { target: { value: 'code' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(document.activeElement).toBe(document.body);
      fireEvent.keyDown(document.body, { key: 'Escape' });
    }
    if (mode === 'prop') mounted.rerender(<FindBar isOpen={false} onClose={onClose} api={f.api} />);
    if (mode === 'unmount') mounted.unmount();
    expect(document.activeElement).toBe(f.prior);
    mounted.unmount();
    expect(f.callbacks.size).toBe(0);
    f.prior.remove();
  }
);
it('keeps a user-selected external control focused and never restores a disconnected review target', () => {
  const f = focusFixture();
  const onClose = vi.fn();
  const mounted = render(<FindBar isOpen onClose={onClose} api={f.api} />);
  const other = document.createElement('button');
  document.body.append(other);
  other.focus();
  mounted.rerender(<FindBar isOpen={false} onClose={onClose} api={f.api} />);
  expect(document.activeElement).toBe(other);
  other.remove();
  f.prior.focus();
  mounted.rerender(<FindBar isOpen onClose={onClose} api={f.api} />);
  const focus = vi.spyOn(f.prior, 'focus');
  f.prior.remove();
  fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
  expect(focus).not.toHaveBeenCalled();
  mounted.unmount();
});
it('does not return focus to an old owner after the bridge is replaced', () => {
  const f = focusFixture();
  const onClose = vi.fn();
  const mounted = render(<FindBar isOpen onClose={onClose} api={f.api} />);
  const focus = vi.spyOn(f.prior, 'focus');
  const replacement = { ...f.api };
  mounted.rerender(<FindBar isOpen onClose={onClose} api={replacement} />);
  mounted.rerender(<FindBar isOpen={false} onClose={onClose} api={replacement} />);
  expect(focus).not.toHaveBeenCalled();
  mounted.unmount();
  f.prior.remove();
});
it('announces result changes and refuses oversized queries visibly without truncating or invoking native Find', () => {
  const f = focusFixture();
  const mounted = render(<FindBar isOpen onClose={vi.fn()} api={f.api} />);
  const input = screen.getByRole('textbox', { name: 'Find in page' }) as HTMLInputElement;
  const status = screen.getByRole('status');
  expect(status.getAttribute('aria-live')).toBe('polite');
  expect(status.getAttribute('aria-atomic')).toBe('true');
  fireEvent.change(input, { target: { value: 'code' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  f.result(4, 2);
  expect(status.textContent).toBe('2 of 3');
  f.result(1, 0);
  expect(status.textContent).toBe('No results');
  const text = 'x'.repeat(MAX_FIND_QUERY_LENGTH + 1);
  fireEvent.change(input, { target: { value: text } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(input.value).toBe(text);
  expect(input.getAttribute('aria-invalid')).toBe('true');
  expect(input.getAttribute('aria-describedby')).toBe(status.id);
  expect(status.textContent).toContain('Search is too long');
  expect(f.api.findInPage).toHaveBeenCalledOnce();
  expect(f.api.stopFindInPage).toHaveBeenCalledWith('clearSelection');
  fireEvent.change(input, { target: { value: 'code' } });
  fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
  expect(f.api.findInPage).toHaveBeenLastCalledWith({
    text: 'code',
    forward: false,
    findNext: true,
  });
  mounted.unmount();
  f.prior.remove();
});

it.each(['button', 'link', 'select', 'custom-button', 'custom-menuitem'])(
  'leaves Enter activation available to a focused %s during a native search',
  kind => {
    const f = focusFixture();
    const mounted = render(<FindBar isOpen onClose={vi.fn()} api={f.api} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'code' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    f.result(4);
    const target = document.createElement(
      kind === 'link' ? 'a' : kind.startsWith('custom-') ? 'div' : kind
    );
    if (kind === 'link') target.setAttribute('href', '#reviewed-line');
    if (kind.startsWith('custom-')) {
      target.setAttribute('role', kind.slice('custom-'.length));
      target.tabIndex = 0;
    }
    document.body.append(target);
    target.focus();
    expect(document.activeElement).toBe(target);
    const activated = vi.fn();
    // Custom controls handle Enter after the bubbling event reaches document.
    // Native activation likewise requires an uncancelled keydown.
    target.addEventListener('keyup', activated);
    for (const shiftKey of [false, true]) {
      expect(fireEvent.keyDown(document.activeElement!, { key: 'Enter', shiftKey })).toBe(true);
      fireEvent.keyUp(document.activeElement!, { key: 'Enter', shiftKey });
    }
    expect(activated).toHaveBeenCalledTimes(2);
    expect(f.api.findInPage).toHaveBeenCalledOnce();
    target.remove();
    mounted.unmount();
    f.prior.remove();
  }
);

it('cycles from native document focus, while respecting a consumed keyboard event', () => {
  const f = focusFixture();
  const mounted = render(<FindBar isOpen onClose={vi.fn()} api={f.api} />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'code' } });
  fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
  expect(document.activeElement).toBe(document.body);
  expect(fireEvent.keyDown(document.body, { key: 'Enter' })).toBe(false);
  expect(f.api.findInPage).toHaveBeenLastCalledWith({
    text: 'code',
    forward: true,
    findNext: false,
  });
  expect(fireEvent.keyDown(document, { key: 'Enter', shiftKey: true })).toBe(false);
  expect(f.api.findInPage).toHaveBeenLastCalledWith({
    text: 'code',
    forward: false,
    findNext: false,
  });
  const consumed = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  consumed.preventDefault();
  document.body.dispatchEvent(consumed);
  expect(f.api.findInPage).toHaveBeenCalledTimes(3);
  mounted.unmount();
  f.prior.remove();
});

it('uses the default desktop bridge and keeps one subscription across query changes', () => {
  const f = focusFixture();
  const off = vi.fn();
  f.api.onFindResult.mockImplementation(callback => {
    f.callbacks.add(callback);
    return () => {
      f.callbacks.delete(callback);
      off();
    };
  });
  vi.stubGlobal('electronAPI', f.api);
  const mounted = render(<FindBar isOpen onClose={vi.fn()} />);
  try {
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'first' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    f.result(5, 2);
    expect(screen.getByRole('status').textContent).toBe('2 of 4');
    fireEvent.change(input, { target: { value: 'second' } });
    expect(screen.getByRole('status').textContent).toBe('');
    expect(f.api.findInPage).toHaveBeenCalledOnce();
    expect(f.api.onFindResult).toHaveBeenCalledOnce();
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(f.api.findInPage).toHaveBeenLastCalledWith({
      text: 'second',
      forward: false,
      findNext: true,
    });
    f.result(3, 2);
    expect(screen.getByRole('status').textContent).toBe('2 of 2');
    fireEvent.click(screen.getByRole('button', { name: 'Next match' }));
    expect(f.api.findInPage).toHaveBeenLastCalledWith({
      text: 'second',
      forward: true,
      findNext: false,
    });
    mounted.unmount();
    expect(off).toHaveBeenCalledOnce();
    expect(f.callbacks.size).toBe(0);
  } finally {
    mounted.unmount();
    f.prior.remove();
    vi.unstubAllGlobals();
  }
});

it('releases the replaced bridge subscription and accepts final results only from the current bridge', () => {
  const f = focusFixture();
  const replacement = focusFixture();
  const mounted = render(<FindBar isOpen onClose={vi.fn()} api={f.api} />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'code' } });
  fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
  f.result(5, 2);
  expect(screen.getByRole('status').textContent).toBe('2 of 4');
  mounted.rerender(<FindBar isOpen onClose={vi.fn()} api={replacement.api} />);
  expect(f.callbacks.size).toBe(0);
  expect(replacement.callbacks.size).toBe(1);
  expect(f.api.stopFindInPage).toHaveBeenCalledWith('clearSelection');
  act(() => {
    for (const callback of replacement.callbacks)
      callback({ matches: 50, activeMatchOrdinal: 20, finalUpdate: false });
  });
  expect(screen.getByRole('status').textContent).toBe('2 of 4');
  replacement.result(4, 3);
  expect(screen.getByRole('status').textContent).toBe('3 of 3');
  mounted.rerender(<FindBar isOpen={false} onClose={vi.fn()} api={replacement.api} />);
  expect(replacement.callbacks.size).toBe(0);
  mounted.rerender(<FindBar isOpen onClose={vi.fn()} api={replacement.api} />);
  expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('');
  expect(screen.getByRole('status').textContent).toBe('');
  mounted.unmount();
  f.prior.remove();
  replacement.prior.remove();
});
