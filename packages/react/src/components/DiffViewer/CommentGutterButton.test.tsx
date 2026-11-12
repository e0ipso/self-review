import React from 'react';
import { it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CommentGutterButton } from './CommentGutterButton';

it.each(['Enter', ' '])('activates once on %s and forwards focus and ARIA props', key => {
  const activate = vi.fn();
  const focus = vi.fn();
  render(
    <>
      <span id='help'>Context</span>
      <CommentGutterButton
        label='Comment on line 1'
        onActivate={activate}
        className='custom'
        onFocus={focus}
        aria-describedby='help'
      />
    </>
  );
  const button = screen.getByRole('button', { name: 'Comment on line 1' });
  fireEvent.focus(button);
  fireEvent.keyDown(button, { key });
  expect(activate).toHaveBeenCalledTimes(1);
  expect(focus).toHaveBeenCalledTimes(1);
  expect(button.className).toContain('custom');
  expect(button.getAttribute('aria-describedby')).toBe('help');
});
it('starts one pointer drag without a second activation from its click', () => {
  const start = vi.fn();
  const activate = vi.fn();
  render(<CommentGutterButton label='Comment' onActivate={activate} onStartDrag={start} />);
  const button = screen.getByRole('button');
  fireEvent.mouseDown(button, { button: 0 });
  fireEvent.mouseUp(button);
  fireEvent.click(button, { detail: 1 });
  expect(start).toHaveBeenCalledTimes(1);
  expect(activate).not.toHaveBeenCalled();
});
it('preserves disabled behavior and lets a caller consume a key', () => {
  const activate = vi.fn();
  const view = render(<CommentGutterButton label='Comment' onActivate={activate} disabled />);
  const button = screen.getByRole('button');
  button.focus();
  expect(document.activeElement).not.toBe(button);
  fireEvent.click(button);
  expect(activate).not.toHaveBeenCalled();
  view.rerender(
    <CommentGutterButton
      label='Comment'
      onActivate={activate}
      onKeyDown={event => event.preventDefault()}
    />
  );
  fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
  expect(activate).not.toHaveBeenCalled();
});

it('ignores secondary pointer buttons and uses replacement callbacks', () => {
  const first = vi.fn();
  const latest = vi.fn();
  const start = vi.fn();
  const view = render(<CommentGutterButton label='First' onActivate={first} onStartDrag={start} />);
  fireEvent.mouseDown(screen.getByRole('button'), { button: 2 });
  expect(start).not.toHaveBeenCalled();
  expect(first).not.toHaveBeenCalled();
  view.rerender(<CommentGutterButton label='Latest' onActivate={latest} />);
  const button = screen.getByRole('button', { name: 'Latest' });
  (button as HTMLButtonElement).click();
  expect(latest).toHaveBeenCalledTimes(1);
  fireEvent.mouseDown(button, { button: 0 });
  expect(latest).toHaveBeenCalledTimes(2);
  expect(first).not.toHaveBeenCalled();
  view.rerender(
    <CommentGutterButton label='Disabled' onActivate={latest} onStartDrag={start} disabled />
  );
  const disabled = screen.getByRole('button', { name: 'Disabled' });
  fireEvent.mouseDown(disabled, { button: 0 });
  fireEvent.keyDown(disabled, { key: 'Enter' });
  (disabled as HTMLButtonElement).click();
  expect(start).not.toHaveBeenCalled();
  expect(latest).toHaveBeenCalledTimes(2);
});
