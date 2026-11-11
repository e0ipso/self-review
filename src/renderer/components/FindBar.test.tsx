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
