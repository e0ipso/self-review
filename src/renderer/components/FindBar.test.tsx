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
