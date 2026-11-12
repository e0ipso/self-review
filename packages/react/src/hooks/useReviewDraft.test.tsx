import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { Attachment, DiffFile } from '@self-review/types';
import { ReviewProviders } from '../ReviewProviders';
import { useReviewSaveTransaction } from '../context/ReviewContext';
import { useReviewDraft, useReviewDraftWork } from './useReviewDraft';
import { useImageAttachments } from './useImageAttachments';
import { emptyDraftContent } from '../context/review-drafts';
import { installBrowserApiStubs } from '../test-helpers';
installBrowserApiStubs();
afterEach(cleanup);
const files: DiffFile[] = [
  { oldPath: 'a.ts', newPath: 'a.ts', changeType: 'added', isBinary: false, hunks: [] },
];
const source = { type: 'directory' as const, sourcePath: '/a' };
const adapter = { loadDiff: async () => ({ files, source }) };
const attachment: Attachment = {
  id: 'image',
  fileName: 'proof.png',
  mediaType: 'image/png',
  data: new ArrayBuffer(4),
};

it('aborts pending draft work on disclosure and refuses late results after cancel or session replacement', async () => {
  let complete!: (value: Attachment) => void;
  let signal!: AbortSignal;
  const process = vi.fn((_input: File | Blob, inputSignal?: AbortSignal) => {
    signal = inputSignal!;
    return new Promise<Attachment>(resolve => {
      complete = resolve;
    });
  });
  let capture!: () => unknown;
  function Status() {
    const work = useReviewDraftWork();
    const save = useReviewSaveTransaction();
    capture = save.begin;
    return <output data-testid='work'>{String(work)}</output>;
  }
  function Composer() {
    const editor = useReviewDraft({ filePath: 'a.ts', lineRange: null }, emptyDraftContent());
    const ingestion = useImageAttachments({
      owner: editor.draft.key,
      signal: editor.draft.controller.signal,
      process,
      attachments: editor.content.attachments,
      onAttach: images => editor.setAttachments(previous => [...previous, ...images]),
      onWorkChange: editor.onProcessingChange,
      onAbort: editor.onAttachmentsAborted,
    });
    return (
      <>
        <button onClick={() => ingestion.enqueue([new File(['bytes'], 'proof.png')])}>
          Attach
        </button>
        <button onClick={editor.clear}>Cancel</button>
        <output data-testid='attached'>{editor.content.attachments.length}</output>
        <output data-testid='interrupted'>{String(editor.draft.interrupted)}</output>
      </>
    );
  }
  function Fixture({ open = true, host = adapter }) {
    return (
      <ReviewProviders adapter={host} initialFiles={files} initialSource={source}>
        <Status />
        {open && <Composer />}
      </ReviewProviders>
    );
  }
  const view = render(<Fixture />);
  fireEvent.click(screen.getByText('Attach'));
  expect(screen.getByTestId('work').textContent).toBe('true');
  expect(() => capture()).toThrow('Finish or cancel');
  view.rerender(<Fixture open={false} />);
  expect(signal.aborted).toBe(true);
  await act(async () => complete(attachment));
  view.rerender(<Fixture />);
  expect(screen.getByTestId('attached').textContent).toBe('0');
  expect(screen.getByTestId('interrupted').textContent).toBe('true');
  expect(() => capture()).toThrow('Finish or cancel');
  fireEvent.click(screen.getByText('Cancel'));
  fireEvent.click(screen.getByText('Attach'));
  // The cleared owner's callback cannot re-open its cancelled draft.
  expect(process).toHaveBeenCalledTimes(1);
  view.rerender(<Fixture open={false} />);
  view.rerender(<Fixture />);
  fireEvent.click(screen.getByText('Attach'));
  fireEvent.click(screen.getByText('Cancel'));
  expect(signal.aborted).toBe(true);
  await act(async () => complete(attachment));
  expect(screen.getByTestId('attached').textContent).toBe('0');
  view.rerender(<Fixture open={false} />);
  view.rerender(<Fixture />);
  fireEvent.click(screen.getByText('Attach'));
  view.rerender(<Fixture host={{ ...adapter }} />);
  expect(signal.aborted).toBe(true);
  await act(async () => complete(attachment));
  expect(screen.getByTestId('work').textContent).toBe('false');
  expect(screen.getByTestId('attached').textContent).toBe('0');
  const saved = capture() as { unlock: () => void };
  saved.unlock();
});
