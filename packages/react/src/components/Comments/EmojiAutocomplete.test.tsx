import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import axe from 'axe-core';
import { ConfigProvider } from '../../context/ConfigContext';
import { ReviewProvider } from '../../context/ReviewContext';
import { LocalizationProvider } from '../../localization/LocalizationContext';
import { installBrowserApiStubs } from '../../test-helpers';
import CommentInput from './CommentInput';
import ReplyInput from './ReplyInput';

installBrowserApiStubs();
const comment = {
  id: 'comment',
  filePath: 'a.ts',
  lineRange: null,
  body: 'Existing text',
  category: 'bug',
  suggestion: null,
};
const reply = { id: 'reply', body: 'Existing reply' };
function Composer({ kind = 'comment' }: { kind?: string }) {
  return (
    <ConfigProvider>
      <ReviewProvider initialFiles={[]}>
        {kind.includes('reply') ? (
          <ReplyInput
            commentId='comment'
            existingReply={kind === 'edit-reply' ? reply : undefined}
            onCancel={vi.fn()}
          />
        ) : (
          <CommentInput
            filePath='a.ts'
            lineRange={null}
            existingComment={kind === 'edit-comment' ? comment : undefined}
            onCancel={vi.fn()}
          />
        )}
      </ReviewProvider>
    </ConfigProvider>
  );
}
function typeQuery(textarea: HTMLTextAreaElement, value = ':sm') {
  act(() => textarea.focus());
  fireEvent.change(textarea, {
    target: { value, selectionStart: value.length, selectionEnd: value.length },
  });
}

it.each(['comment', 'edit-comment', 'reply', 'edit-reply'])(
  'links the actual focused %s textarea to named, selected emoji options',
  kind => {
    render(<Composer kind={kind} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    typeQuery(textarea);
    const list = screen.getByRole('listbox', { name: 'Emoji suggestions' });
    expect(document.activeElement).toBe(textarea);
    expect(textarea.getAttribute('role')).toBeNull();
    expect(textarea.getAttribute('aria-autocomplete')).toBe('list');
    expect(textarea.getAttribute('aria-controls')).toBe(list.id);
    const first = within(list).getAllByRole('option')[0];
    expect(first.getAttribute('aria-label')).toMatch(/^Emoji /);
    expect(first.getAttribute('aria-selected')).toBe('true');
    expect(textarea.getAttribute('aria-activedescendant')).toBe(first.id);
    fireEvent.keyDown(textarea, { key: 'ArrowDown' });
    const second = within(list).getAllByRole('option')[1];
    expect(second.getAttribute('aria-selected')).toBe('true');
    expect(textarea.getAttribute('aria-activedescendant')).toBe(second.id);
    expect(screen.getByRole('status').textContent).toMatch(/2 of/);
    fireEvent.keyDown(textarea, { key: 'Escape' });
    fireEvent.keyUp(textarea, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(textarea.hasAttribute('aria-activedescendant')).toBe(false);
    expect(document.activeElement).toBe(textarea);
  }
);

it.each(['Enter', 'Tab', 'pointer'])(
  'inserts at the caret through %s and preserves following text',
  async method => {
    render(<Composer />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    typeQuery(textarea, 'before :sm after');
    act(() => textarea.setSelectionRange(10, 10));
    fireEvent.select(textarea);
    const first = screen.getAllByRole('option')[0];
    const native = first.querySelector('span')!.textContent!;
    if (method === 'pointer') fireEvent.mouseDown(first);
    else fireEvent.keyDown(textarea, { key: method });
    await act(async () => {
      await new Promise(resolve => requestAnimationFrame(resolve));
    });
    expect(textarea.value).toBe(`before ${native} after`);
    expect(textarea.selectionStart).toBe(7 + native.length);
    expect(textarea.selectionEnd).toBe(textarea.selectionStart);
    expect(document.activeElement).toBe(textarea);
    expect(screen.queryByRole('listbox')).toBeNull();
  }
);

it('closes for a moved caret, selection, blur and IME without consuming composition Enter', () => {
  render(<Composer />);
  const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
  typeQuery(textarea);
  act(() => textarea.setSelectionRange(0, 0));
  fireEvent.select(textarea);
  expect(screen.queryByRole('listbox')).toBeNull();
  act(() => textarea.setSelectionRange(3, 3));
  fireEvent.select(textarea);
  expect(screen.getByRole('listbox')).toBeTruthy();
  fireEvent.compositionStart(textarea);
  expect(screen.queryByRole('listbox')).toBeNull();
  expect(fireEvent.keyDown(textarea, { key: 'Enter', isComposing: true, keyCode: 229 })).toBe(true);
  expect(textarea.value).toBe(':sm');
  fireEvent.compositionEnd(textarea);
  expect(screen.getByRole('listbox')).toBeTruthy();
  act(() => textarea.setSelectionRange(1, 3));
  fireEvent.select(textarea);
  expect(screen.queryByRole('listbox')).toBeNull();
  act(() => textarea.setSelectionRange(3, 3));
  fireEvent.select(textarea);
  act(() => textarea.blur());
  expect(screen.queryByRole('listbox')).toBeNull();
});

it('scopes multiple mounted reviews and localizes the popup and announcements', () => {
  render(
    <>
      <LocalizationProvider
        messages={{
          'Emoji suggestions': 'Choose an emoji',
          'Emoji suggestion {index} of {count}: {name}. Use Up and Down to choose, Enter or Tab to insert, Escape to close.':
            'Match {index} of {count}: {name}',
        }}
      >
        <Composer />
      </LocalizationProvider>
      <Composer kind='reply' />
    </>
  );
  const [first, second] = screen.getAllByRole('textbox') as HTMLTextAreaElement[];
  typeQuery(first);
  const firstList = screen.getByRole('listbox', { name: 'Choose an emoji' });
  const firstId = firstList.id;
  expect(
    screen.getAllByRole('status').some(status => status.textContent?.startsWith('Match 1 of'))
  ).toBe(true);
  typeQuery(second);
  const secondList = screen.getByRole('listbox', { name: 'Emoji suggestions' });
  expect(firstId).not.toBe(secondList.id);
  expect(first.hasAttribute('aria-controls')).toBe(false);
  expect(second.getAttribute('aria-controls')).toBe(secondList.id);
  const ids = Array.from(document.querySelectorAll('[id]'), element => element.id);
  expect(new Set(ids).size).toBe(ids.length);
});

it('passes structural accessibility rules with the multiline popup open', async () => {
  const { container } = render(
    <main>
      <Composer />
    </main>
  );
  typeQuery(screen.getByRole('textbox') as HTMLTextAreaElement);
  let result!: axe.AxeResults;
  await act(async () => {
    result = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  });
  expect(
    result.violations.map(violation => ({
      id: violation.id,
      nodes: violation.nodes.map(node => node.html),
    }))
  ).toEqual([]);
});
