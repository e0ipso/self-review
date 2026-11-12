import React, { useState } from 'react';
import type { Attachment } from '@self-review/types';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import axe from 'axe-core';
import { ComposerCore } from './ComposerCore';
import CommentDisplay from './CommentDisplay';
import { ReviewProviders } from '../../ReviewProviders';
import { ConfigProvider } from '../../context/ConfigContext';
import { LocalizationProvider, type MessageKey } from '../../localization/LocalizationContext';
import { installBrowserApiStubs } from '../../test-helpers';

installBrowserApiStubs();

const labels = [
  'Add bold text (ctrl + b)',
  'Add italic text (ctrl + i)',
  'Insert a quote (ctrl + q)',
  'Insert code (ctrl + j)',
  'Add a link (ctrl + l)',
  'Add unordered list (ctrl + shift + u)',
  'Add ordered list (ctrl + shift + o)',
  'Add checked list (ctrl + shift + c)',
] as const satisfies readonly MessageKey[];

it('localizes actual toolbar names and tooltips while retaining native editing and IME submission', async () => {
  const submit = vi.fn();
  function Editor() {
    const [body, setBody] = useState('hello');
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    return (
      <ComposerCore
        body={body}
        onBodyChange={setBody}
        attachments={attachments}
        setAttachments={setAttachments}
        placeholder='Write'
        testId='composer'
        onSubmit={submit}
      />
    );
  }
  const messages = Object.fromEntries(labels.map((label, index) => [label, `Action ${index}`]));
  const { container, rerender } = render(
    <LocalizationProvider messages={messages}>
      <ConfigProvider>
        <Editor />
      </ConfigProvider>
    </LocalizationProvider>
  );
  labels.forEach((_, index) => {
    const button = screen.getByRole('button', { name: `Action ${index}` });
    expect(button.title).toBe(`Action ${index}`);
    expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
  const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
  textarea.focus();
  textarea.setSelectionRange(0, 5);
  fireEvent.click(screen.getByRole('button', { name: 'Action 0' }));
  expect(textarea.value).toBe('**hello**');
  fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true, isComposing: true });
  expect(submit).not.toHaveBeenCalled();
  fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
  expect(submit).toHaveBeenCalledTimes(1);
  const result = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  expect(result.violations).toEqual([]);
  rerender(
    <ConfigProvider>
      <Editor />
    </ConfigProvider>
  );
  for (const label of labels) expect(screen.getByRole('button', { name: label }).title).toBe(label);
});

it('keeps unique controlled regions through collapse, bulk commands and a reply draft', async () => {
  const comment = {
    id: 'same-id',
    filePath: 'a.txt',
    lineRange: null,
    body: 'Root',
    category: 'note',
    suggestion: null,
  };
  const adapter = {
    loadDiff: async () => ({
      files: [],
      source: { type: 'directory' as const, sourcePath: '/empty' },
    }),
  };
  const { container } = render(
    <>
      {[1, 2].map(index => (
        <ReviewProviders key={index} adapter={adapter} initialFiles={[]}>
          <CommentDisplay comment={comment} />
        </ReviewProviders>
      ))}
    </>
  );
  const toggles = screen.getAllByRole('button', { name: 'Collapse' });
  const ids = toggles.map(button => button.getAttribute('aria-controls'));
  expect(new Set(ids).size).toBe(2);
  const region = document.getElementById(ids[0]!);
  expect(region).not.toBeNull();
  expect(region!.hidden).toBe(false);
  fireEvent.click(within(region!).getByRole('button', { name: 'Reply' }));
  const textarea = within(region!).getByRole('textbox') as HTMLTextAreaElement;
  fireEvent.change(textarea, { target: { value: 'Keep this draft :smile:' } });
  fireEvent.click(toggles[0]);
  expect(toggles[0].getAttribute('aria-expanded')).toBe('false');
  expect(document.getElementById(ids[0]!)).toBe(region);
  expect(region!.hidden).toBe(true);
  expect(within(region!).queryByRole('textbox')).toBeNull();
  const collapsedResult = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false } },
  });
  expect(collapsedResult.violations).toEqual([]);
  fireEvent.click(toggles[0]);
  expect(toggles[0].getAttribute('aria-expanded')).toBe('true');
  expect(within(region!).getByRole('textbox')).toBe(textarea);
  expect(textarea.value).toBe('Keep this draft :smile:');
  const scope = toggles[0].closest('.self-review')!;
  fireEvent(scope, new CustomEvent('toggle-all-comments', { detail: { collapsed: true } }));
  expect(region!.hidden).toBe(true);
  expect(toggles[1].getAttribute('aria-expanded')).toBe('true');
  fireEvent(scope, new CustomEvent('toggle-all-comments', { detail: { collapsed: false } }));
  expect(region!.hidden).toBe(false);
  expect(textarea.value).toBe('Keep this draft :smile:');
});
