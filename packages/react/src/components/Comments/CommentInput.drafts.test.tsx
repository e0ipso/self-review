import React from 'react';
import { act, fireEvent, render, screen, within, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { DiffFile, DiffLoadPayload, ReviewComment } from '@self-review/types';
import { ReviewPanel } from '../../ReviewPanel';
import { ReviewProviders } from '../../ReviewProviders';
import type { ReviewAdapter } from '../../adapter';
import { useReview, useReviewSaveTransaction } from '../../context/ReviewContext';
import { useReviewDraftWork } from '../../hooks/useReviewDraft';
import { installBrowserApiStubs } from '../../test-helpers';
import CommentInput from './CommentInput';
import { SuggestionPanel } from './SuggestionPanel';
import { LocalizationProvider } from '../../localization/LocalizationContext';
import { resolveDesktopCatalog } from '../../../../../src/shared/localization';

installBrowserApiStubs();
afterEach(cleanup);
const range = { start: 1, end: 1, side: 'new' as const };
function file(text = '# First'): DiffFile {
  return {
    oldPath: 'note.md',
    newPath: 'note.md',
    changeType: 'added',
    isBinary: false,
    hunks: [
      {
        header: '@@ -0,0 +1 @@',
        oldStart: 0,
        oldLines: 0,
        newStart: 1,
        newLines: 1,
        lines: [{ type: 'addition', content: text, oldLineNumber: null, newLineNumber: 1 }],
      },
    ],
  };
}
const source = { type: 'directory' as const, sourcePath: '/review' };
const adapter: ReviewAdapter = { loadDiff: async () => ({ files: [file()], source }) };
function Probe() {
  const { files } = useReview();
  const dirty = useReviewDraftWork();
  const transaction = useReviewSaveTransaction();
  const [result, setResult] = React.useState('');
  return (
    <>
      <output data-testid='state'>{JSON.stringify(files)}</output>
      <output data-testid='dirty'>{String(dirty)}</output>
      <output data-testid='save-result'>{result}</output>
      <button
        onClick={() => {
          try {
            const capture = transaction.begin();
            capture.unlock();
            setResult('saved');
          } catch (error) {
            setResult((error as Error).message);
          }
        }}
      >
        Capture
      </button>
    </>
  );
}
function body() {
  return screen.getByTestId('comment-input').querySelector('textarea')!;
}
function write(value: string) {
  fireEvent.change(body(), { target: { value } });
}

it('keeps comment text through collapse and raw/rendered switching, and cancel clears only that draft', async () => {
  render(
    <ReviewPanel adapter={{ loadDiff: async () => ({ files: [file()], source }) }}>
      <Probe />
    </ReviewPanel>
  );
  await screen.findByTestId('add-file-comment-note.md');
  fireEvent.click(screen.getByTestId('add-file-comment-note.md'));
  write('Keep this draft');
  fireEvent.click(screen.getByRole('button', { name: 'Collapse note.md' }));
  expect(screen.queryByTestId('comment-input')).toBeNull();
  fireEvent.click(screen.getByText('Capture'));
  expect(screen.getByTestId('save-result').textContent).toContain('Finish or cancel');
  fireEvent.click(screen.getByRole('button', { name: 'Expand note.md' }));
  expect(body().value).toBe('Keep this draft');
  fireEvent.click(screen.getByRole('button', { name: 'Raw view' }));
  expect(body().value).toBe('Keep this draft');
  fireEvent.click(screen.getByRole('button', { name: 'Rendered view' }));
  expect(body().value).toBe('Keep this draft');
  fireEvent.click(screen.getByTestId('cancel-comment-btn'));
  expect(screen.getByTestId('dirty').textContent).toBe('false');
  fireEvent.click(screen.getByText('Capture'));
  expect(screen.getByTestId('save-result').textContent).toBe('saved');
});

it('keeps a line suggestion across view unmounts and submits its exact source anchor', async () => {
  render(
    <ReviewPanel adapter={{ loadDiff: async () => ({ files: [file()], source }) }}>
      <Probe />
    </ReviewPanel>
  );
  await screen.findByTestId('file-section-note.md');
  fireEvent.click(screen.getByRole('button', { name: 'Raw view' }));
  act(() =>
    screen.getByTestId('file-section-note.md').dispatchEvent(
      new CustomEvent('trigger-line-comment', {
        detail: { filePath: 'note.md', lineNumber: 1, side: 'new' },
      })
    )
  );
  await screen.findByTestId('comment-input');
  write('Change the heading');
  fireEvent.click(screen.getByTestId('add-suggestion-btn'));
  fireEvent.change(screen.getByLabelText('Suggested'), { target: { value: '# Revised' } });
  fireEvent.click(screen.getByRole('button', { name: 'Rendered view' }));
  fireEvent.click(screen.getByRole('button', { name: 'Raw view' }));
  expect(body().value).toBe('Change the heading');
  expect((screen.getByLabelText('Suggested') as HTMLTextAreaElement).value).toBe('# Revised');
  fireEvent.click(screen.getByTestId('add-comment-btn'));
  expect(JSON.parse(screen.getByTestId('state').textContent!)[0].comments[0]).toMatchObject({
    body: 'Change the heading',
    lineRange: range,
    suggestion: { originalCode: '# First', proposedCode: '# Revised' },
  });
  expect(screen.getByTestId('dirty').textContent).toBe('false');
});

it('initializes a real edit once, retains edits and attachments on remount, and ignores prop rerenders', () => {
  const comment: ReviewComment = {
    id: 'edit',
    filePath: 'note.md',
    lineRange: range,
    body: 'Original comment',
    category: 'bug',
    suggestion: { originalCode: '# First', proposedCode: '# Old proposal' },
    attachments: [{ id: 'picture', fileName: 'proof.png', mediaType: 'image/png' }],
  };
  // Keep the same files reference: a new static diff intentionally requires draft confirmation.
  const files = [file()];
  function Stable({ open = true, revision = 0 }) {
    return (
      <ReviewProviders
        adapter={adapter}
        initialFiles={files}
        initialSource={source}
        initialComments={[comment]}
      >
        <Probe />
        {open && (
          <CommentInput
            filePath='note.md'
            lineRange={range}
            originalCode='# First'
            existingComment={{ ...comment, body: revision ? 'Changed prop' : comment.body }}
            onCancel={() => {}}
          />
        )}
      </ReviewProviders>
    );
  }
  const view = render(<Stable />);
  expect(body().value).toBe('Original comment');
  write('Edited draft');
  view.rerender(<Stable revision={1} />);
  expect(body().value).toBe('Edited draft');
  view.rerender(<Stable open={false} />);
  view.rerender(<Stable />);
  expect(body().value).toBe('Edited draft');
  expect(screen.getByRole('button', { name: 'Remove attachment' })).toBeTruthy();
  expect((screen.getByLabelText('Suggested') as HTMLTextAreaElement).value).toBe('# Old proposal');
  fireEvent.click(screen.getByTestId('add-comment-btn'));
  expect(JSON.parse(screen.getByTestId('state').textContent!)[0].comments[0].body).toBe(
    'Edited draft'
  );
});

it('keeps recoverable text but requires current-anchor confirmation after same-PR refresh', async () => {
  let push!: (payload: DiffLoadPayload) => void;
  const remote = {
    remoteUrl: 'https://github.com/a/b/pull/1',
    remoteForge: 'github' as const,
    remoteBaseSha: 'base',
    remoteHeadSha: 'old',
    threadSyncAvailable: true,
    temporaryClone: false,
  };
  const host: ReviewAdapter = {
    loadDiff: async () => ({ files: [file()], source, remote }),
    onDiffLoad: cb => {
      push = cb;
      return () => {};
    },
  };
  function Editor() {
    const { diffFiles } = useReview();
    return diffFiles.length ? (
      <CommentInput
        filePath='note.md'
        lineRange={range}
        originalCode={diffFiles[0].hunks[0].lines[0].content}
        onCancel={() => {}}
      />
    ) : null;
  }
  render(
    <ReviewProviders adapter={host}>
      <Probe />
      <Editor />
    </ReviewProviders>
  );
  await screen.findByTestId('comment-input');
  write('Retain my reasoning');
  fireEvent.click(screen.getByTestId('add-suggestion-btn'));
  fireEvent.change(screen.getByLabelText('Suggested'), { target: { value: '# Mine' } });
  act(() =>
    push({ files: [file('# New head')], source, remote: { ...remote, remoteHeadSha: 'new' } })
  );
  expect(body().value).toBe('Retain my reasoning');
  expect((screen.getByTestId('add-comment-btn') as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByText('Use current location'));
  expect((screen.getByLabelText('Original') as HTMLTextAreaElement).value).toBe('# New head');
  fireEvent.click(screen.getByTestId('add-comment-btn'));
  expect(JSON.parse(screen.getByTestId('state').textContent!)[0].comments[0].suggestion).toEqual({
    originalCode: '# New head',
    proposedCode: '# Mine',
  });
});

it('offers off-diff draft recovery and never leaks a draft to a replacement adapter', async () => {
  let push!: (payload: DiffLoadPayload) => void;
  const host: ReviewAdapter = {
    loadDiff: async () => ({ files: [file()], source }),
    onDiffLoad: cb => {
      push = cb;
      return () => {};
    },
  };
  const view = render(
    <ReviewPanel adapter={host}>
      <Probe />
    </ReviewPanel>
  );
  await screen.findByTestId('add-file-comment-note.md');
  fireEvent.click(screen.getByTestId('add-file-comment-note.md'));
  write('Off-diff text');
  act(() => push({ files: [], source }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue draft' }));
  expect(body().value).toBe('Off-diff text');
  expect(screen.queryByText('Use current location')).toBeNull();
  expect((screen.getByTestId('add-comment-btn') as HTMLButtonElement).disabled).toBe(true);
  view.rerender(
    <ReviewPanel adapter={{ loadDiff: async () => ({ files: [file()], source }) }}>
      <Probe />
    </ReviewPanel>
  );
  await screen.findByTestId('add-file-comment-note.md');
  expect(screen.queryByDisplayValue('Off-diff text')).toBeNull();
  expect(screen.getByTestId('dirty').textContent).toBe('false');
});

it('uses localized suggestion labels with distinct associated control IDs', () => {
  render(
    <LocalizationProvider locale='es' messages={resolveDesktopCatalog('es')}>
      <SuggestionPanel
        originalCode='one'
        proposedCode='two'
        onProposedChange={() => {}}
        onSubmit={() => {}}
      />
      <SuggestionPanel
        originalCode='three'
        proposedCode='four'
        onProposedChange={() => {}}
        onSubmit={() => {}}
      />
    </LocalizationProvider>
  );
  const originals = screen.getAllByLabelText('Original');
  const proposed = screen.getAllByLabelText('Propuesto');
  expect(new Set([...originals, ...proposed].map(element => element.id)).size).toBe(4);
  expect(screen.getAllByPlaceholderText('Escribe el código propuesto...')).toHaveLength(2);
});

it('retains prepared image bytes through collapse and view changes', async () => {
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ width: 1, height: 1, close: vi.fn() }))
  );
  const createUrl = vi.fn(() => 'blob:fixture');
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  URL.createObjectURL = createUrl;
  URL.revokeObjectURL = vi.fn();
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  new DataView(bytes.buffer).setUint32(16, 1);
  new DataView(bytes.buffer).setUint32(20, 1);
  const png = new File([bytes], 'proof.png', { type: 'image/png' });
  Object.defineProperties(png, {
    slice: { value: () => ({ arrayBuffer: async () => bytes.buffer }) },
    arrayBuffer: { value: async () => bytes.buffer },
  });
  let savedBytes: ArrayBuffer | undefined;
  function Bytes() {
    const { files } = useReview();
    savedBytes = files[0]?.comments[0]?.attachments?.[0]?.data;
    return null;
  }
  try {
    render(
      <ReviewPanel adapter={{ loadDiff: async () => ({ files: [file()], source }) }}>
        <Probe />
        <Bytes />
      </ReviewPanel>
    );
    await screen.findByTestId('add-file-comment-note.md');
    fireEvent.click(screen.getByRole('button', { name: 'Raw view' }));
    act(() =>
      screen.getByTestId('file-section-note.md').dispatchEvent(
        new CustomEvent('trigger-line-comment', {
          detail: { filePath: 'note.md', lineNumber: 1, side: 'new' },
        })
      )
    );
    const picker = screen.getByTestId('comment-input').querySelector('input[type="file"]')!;
    fireEvent.change(picker, { target: { files: [png] } });
    await screen.findByAltText('Attachment preview');
    fireEvent.click(screen.getByRole('button', { name: 'Collapse note.md' }));
    fireEvent.click(screen.getByRole('button', { name: 'Expand note.md' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rendered view' }));
    expect(screen.getByAltText('Attachment preview')).toBeTruthy();
    fireEvent.click(screen.getByTestId('add-comment-btn'));
    const attachment = JSON.parse(screen.getByTestId('state').textContent!)[0].comments[0]
      .attachments[0];
    expect(attachment.mediaType).toBe('image/png');
    expect(new Uint8Array(savedBytes!)).toEqual(bytes);
    expect(createUrl).toHaveBeenCalled();
  } finally {
    cleanup();
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    vi.unstubAllGlobals();
  }
});

it('cancels only one anchor draft and retains the other draft and category', () => {
  const files = [file()];
  render(
    <ReviewProviders adapter={adapter} initialFiles={files} initialSource={source}>
      <Probe />
      <div data-testid='file-draft'>
        <CommentInput filePath='note.md' lineRange={null} onCancel={() => {}} />
      </div>
      <div data-testid='line-draft'>
        <CommentInput
          filePath='note.md'
          lineRange={range}
          originalCode='# First'
          onCancel={() => {}}
        />
      </div>
    </ReviewProviders>
  );
  const fileEditor = screen.getByTestId('file-draft');
  const lineEditor = screen.getByTestId('line-draft');
  fireEvent.change(fileEditor.querySelector('textarea')!, { target: { value: 'File draft' } });
  fireEvent.change(lineEditor.querySelector('textarea')!, { target: { value: 'Line draft' } });
  fireEvent.click(within(lineEditor).getByTestId('category-option-bug'));
  fireEvent.click(within(fileEditor).getByTestId('cancel-comment-btn'));
  expect(screen.getByDisplayValue('Line draft')).toBeTruthy();
  expect(screen.getByTestId('dirty').textContent).toBe('true');
  fireEvent.click(within(lineEditor).getByTestId('add-comment-btn'));
  expect(JSON.parse(screen.getByTestId('state').textContent!)[0].comments).toMatchObject([
    { body: 'Line draft', category: 'bug', lineRange: range },
  ]);
  expect(screen.getByTestId('dirty').textContent).toBe('false');
});

it('recovers an edited inline comment after its row unmounts during view and disclosure changes', async () => {
  render(
    <ReviewPanel adapter={{ loadDiff: async () => ({ files: [file()], source }) }}>
      <Probe />
    </ReviewPanel>
  );
  await screen.findByTestId('file-section-note.md');
  fireEvent.click(screen.getByRole('button', { name: 'Raw view' }));
  act(() =>
    screen.getByTestId('file-section-note.md').dispatchEvent(
      new CustomEvent('trigger-line-comment', {
        detail: { filePath: 'note.md', lineNumber: 1, side: 'new' },
      })
    )
  );
  write('Submitted');
  fireEvent.click(screen.getByTestId('add-comment-btn'));
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  write('Edited but not submitted');
  fireEvent.click(screen.getByRole('button', { name: 'Rendered view' }));
  // A replaced row need not keep its editing UI, but its draft stays reachable.
  fireEvent.click(screen.getByRole('button', { name: 'Continue draft' }));
  expect(body().value).toBe('Edited but not submitted');
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  fireEvent.click(screen.getByRole('button', { name: 'Collapse note.md' }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue draft' }));
  expect(body().value).toBe('Edited but not submitted');
  fireEvent.click(screen.getByTestId('add-comment-btn'));
  expect(JSON.parse(screen.getByTestId('state').textContent!)[0].comments).toMatchObject([
    { body: 'Edited but not submitted', lineRange: range },
  ]);
  expect(screen.getByTestId('dirty').textContent).toBe('false');
});

it('preserves a stale proposal as plain text when its range is no longer in the diff', () => {
  const files = [file()];
  const tree = (current: DiffFile[]) => (
    <ReviewProviders adapter={adapter} initialFiles={current} initialSource={source}>
      <Probe />
      <CommentInput
        filePath='note.md'
        lineRange={range}
        originalCode='# First'
        onCancel={() => {}}
      />
    </ReviewProviders>
  );
  const view = render(tree(files));
  write('Reasoning');
  fireEvent.click(screen.getByTestId('add-suggestion-btn'));
  fireEvent.change(screen.getByLabelText('Suggested'), {
    target: { value: '# Recover this proposal' },
  });
  view.rerender(tree([{ ...file(), hunks: [] }]));
  expect(screen.queryByText('Use current location')).toBeNull();
  expect((screen.getByTestId('add-comment-btn') as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByText('Keep as file comment'));
  expect(body().value).toContain('# Recover this proposal');
  fireEvent.click(screen.getByTestId('add-comment-btn'));
  const comment = JSON.parse(screen.getByTestId('state').textContent!)[0].comments[0];
  expect(comment).toMatchObject({ lineRange: null, suggestion: null });
  expect(comment.body).toContain('Reasoning');
  expect(comment.body).toContain('# Recover this proposal');
});

it('requires confirmation when an untouched editor is first used after snapshot replacement', () => {
  const tree = (files: DiffFile[]) => (
    <ReviewProviders adapter={adapter} initialFiles={files} initialSource={source}>
      <Probe />
      <CommentInput
        filePath='note.md'
        lineRange={range}
        originalCode='# First'
        onCancel={() => {}}
      />
    </ReviewProviders>
  );
  const view = render(tree([file()]));
  view.rerender(tree([file('# Replacement')]));
  write('New reasoning');
  fireEvent.click(screen.getByTestId('add-suggestion-btn'));
  expect((screen.getByTestId('add-comment-btn') as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByText('Use current location'));
  expect((screen.getByLabelText('Original') as HTMLTextAreaElement).value).toBe('# Replacement');
});
