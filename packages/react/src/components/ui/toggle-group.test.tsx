import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ToggleGroup, ToggleGroupItem } from './toggle-group';

// This internal scalar wrapper supports single selection only.
// @ts-expect-error A scalar value/callback cannot represent multiple selections.
const unsupported = <ToggleGroup type='multiple' />;
void unsupported;

const items = (
  <>
    <ToggleGroupItem value='one'>One</ToggleGroupItem>
    <ToggleGroupItem value='two'>Two</ToggleGroupItem>
    <ToggleGroupItem value='three' disabled>
      Three
    </ToggleGroupItem>
  </>
);
it('preserves uncontrolled defaults, scalar changes, clear, disabled items and forwarded refs', () => {
  const change = vi.fn();
  const ref = React.createRef<HTMLDivElement>();
  render(
    <ToggleGroup
      ref={ref}
      type='single'
      defaultValue='one'
      onValueChange={change}
      aria-label='Choices'
    >
      {items}
    </ToggleGroup>
  );
  expect(ref.current?.getAttribute('aria-label')).toBe('Choices');
  expect(ref.current?.hasAttribute('type')).toBe(false);
  const one = screen.getByRole('button', { name: 'One' });
  const two = screen.getByRole('button', { name: 'Two' });
  expect(one.getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(two);
  expect(change).toHaveBeenLastCalledWith('two');
  expect(one.getAttribute('aria-pressed')).toBe('false');
  expect(two.getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(two);
  expect(change).toHaveBeenLastCalledWith('');
  expect(two.getAttribute('aria-pressed')).toBe('false');
  fireEvent.click(screen.getByRole('button', { name: 'Three' }));
  expect(change).toHaveBeenCalledTimes(2);
});
it('preserves controlled selection, keyboard focus and group disabling', async () => {
  const change = vi.fn();
  const view = render(
    <ToggleGroup value='one' onValueChange={change}>
      {items}
    </ToggleGroup>
  );
  const one = screen.getByRole('button', { name: 'One' });
  const two = screen.getByRole('button', { name: 'Two' });
  act(() => one.focus());
  fireEvent.keyDown(one, { key: 'ArrowRight' });
  await waitFor(() => expect(document.activeElement).toBe(two));
  // jsdom does not synthesize the browser's native button click after Enter.
  fireEvent.keyDown(two, { key: 'Enter' });
  fireEvent.click(two, { detail: 0 });
  expect(change).toHaveBeenLastCalledWith('two');
  expect(one.getAttribute('aria-pressed')).toBe('true');
  expect(two.getAttribute('aria-pressed')).toBe('false');
  view.rerender(
    <ToggleGroup value='two' onValueChange={change}>
      {items}
    </ToggleGroup>
  );
  expect(two.getAttribute('aria-pressed')).toBe('true');
  view.rerender(
    <ToggleGroup value='' onValueChange={change} disabled>
      {items}
    </ToggleGroup>
  );
  expect(two.getAttribute('aria-pressed')).toBe('false');
  fireEvent.click(one);
  expect(change).toHaveBeenCalledTimes(1);
});
