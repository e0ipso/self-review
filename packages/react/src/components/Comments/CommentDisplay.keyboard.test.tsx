import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { DiffFile, ReviewComment } from '@self-review/types';
import { ReviewProviders } from '../../ReviewProviders';
import { useReview, type ReviewContextValue } from '../../context/ReviewContext';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import { LocalizationProvider } from '../../localization/LocalizationContext';
import { installBrowserApiStubs } from '../../test-helpers';
import CommentDisplay from './CommentDisplay';
installBrowserApiStubs();

it('reveals focused root and reply actions and preserves native editing, shortcuts and reply drafts', async () => {
  const file: DiffFile = {
    oldPath: 'a.txt',
    newPath: 'a.txt',
    changeType: 'added',
    isBinary: false,
    hunks: [],
  };
  const comment: ReviewComment = {
    id: 'root',
    filePath: 'a.txt',
    lineRange: null,
    body: 'Initial **Markdown**',
    category: 'note',
    suggestion: null,
    replies: [{ id: 'reply', body: 'Initial reply' }],
  };
  const adapter = { loadDiff: vi.fn() };
  let review!: ReviewContextValue;
  let mode = '';
  function Thread() {
    review = useReview();
    mode = useKeyboardNavigation().mode;
    return <CommentDisplay comment={review.files[0].comments[0]} />;
  }
  const { rerender } = render(
    <LocalizationProvider messages={{ Edit: 'Modify finding', 'Edit reply': 'Modify reply' }}>
      <ReviewProviders adapter={adapter} initialFiles={[file]} initialComments={[comment]}>
        <Thread />
      </ReviewProviders>
    </LocalizationProvider>
  );
  expect(screen.getByText('Markdown').tagName).toBe('STRONG');
  const edit = screen.getByRole('button', { name: 'Modify finding' });
  edit.focus();
  expect(document.activeElement).toBe(edit);
  expect(edit.parentElement?.classList.contains('focus-within:opacity-100')).toBe(true);
  const editReply = screen.getAllByRole('button', { name: 'Modify reply' })[0];
  editReply.focus();
  expect(editReply.parentElement?.classList.contains('focus-within:opacity-100')).toBe(true);
  // Native button activation enters the real Markdown editor, which owns keyboard focus.
  fireEvent.click(edit);
  const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
  await waitFor(() => expect(document.activeElement).toBe(textarea));
  fireEvent.change(textarea, { target: { value: 'Edited human **Markdown**' } });
  fireEvent.keyDown(textarea, { key: 'f' });
  expect(mode).toBe('normal');
  fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
  await waitFor(() => expect(review.files[0].comments[0].body).toBe('Edited human **Markdown**'));
  expect(screen.getByText('Markdown').tagName).toBe('STRONG');
  fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
  const draft = screen.getByRole('textbox') as HTMLTextAreaElement;
  fireEvent.change(draft, { target: { value: 'Keep my reply draft' } });
  const collapse = screen.getByRole('button', { name: 'Collapse' });
  fireEvent.click(collapse);
  expect(screen.queryByRole('textbox')).toBeNull();
  fireEvent.click(collapse);
  expect(screen.getByRole('textbox')).toBe(draft);
  expect(draft.value).toBe('Keep my reply draft');
  act(() => review.toggleViewed('a.txt'));
  expect(draft.value).toBe('Keep my reply draft');
  fireEvent.keyDown(draft, { key: 'Enter', ctrlKey: true });
  await waitFor(() =>
    expect(review.files[0].comments[0].replies?.[1].body).toBe('Keep my reply draft')
  );
  fireEvent.click(screen.getAllByRole('button', { name: 'Modify reply' })[0]);
  const replyEditor = screen.getByRole('textbox') as HTMLTextAreaElement;
  fireEvent.change(replyEditor, { target: { value: 'Updated reply' } });
  fireEvent.keyDown(replyEditor, { key: 'Enter', ctrlKey: true });
  await waitFor(() =>
    expect(within(screen.getByTestId('reply-reply')).getByText('Updated reply')).toBeTruthy()
  );
  // Keep the actual provider and thread mounted when a host re-renders its chrome.
  rerender(
    <LocalizationProvider messages={{ Edit: 'Modify finding', 'Edit reply': 'Modify reply' }}>
      <ReviewProviders adapter={adapter} initialFiles={[file]} initialComments={[comment]}>
        <Thread />
      </ReviewProviders>
    </LocalizationProvider>
  );
  expect(review.files[0].comments[0].body).toBe('Edited human **Markdown**');
});
