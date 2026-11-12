import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ReviewProviders } from './ReviewProviders';
import { ReviewDraftRecovery } from './components/Comments/ReviewDraftRecovery';
import { useReviewLoadState } from './context/ReviewLoadContext';
import { useReviewSaveTransaction } from './context/ReviewContext';
import { emptyDraftContent } from './context/review-drafts';
import { useReviewDraft, useReviewDraftWork } from './hooks/useReviewDraft';
import { installBrowserApiStubs } from './test-helpers';
installBrowserApiStubs();
afterEach(cleanup);
const files = [
  { oldPath: 'a.ts', newPath: 'a.ts', changeType: 'added' as const, isBinary: false, hunks: [] },
];
const source = { type: 'directory' as const, sourcePath: '/review' };

it('lets custom recovery access load state and retry while preserving save readiness', async () => {
  const loadDiff = vi
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({ files, source });
  let capture!: ReturnType<typeof useReviewSaveTransaction>['begin'];
  function Status() {
    capture = useReviewSaveTransaction().begin;
    return null;
  }
  function CustomRecovery() {
    const { loadError, retryLoad } = useReviewLoadState();
    return loadError ? (
      <aside role='alert'>
        <p>Custom: {loadError}</p>
        <button onClick={() => void retryLoad()}>Try again</button>
      </aside>
    ) : null;
  }
  render(
    <ReviewProviders adapter={{ loadDiff }} recovery={<CustomRecovery />}>
      <Status />
    </ReviewProviders>
  );
  expect((await screen.findByRole('alert')).textContent).toContain('Custom: offline');
  expect(screen.queryByRole('button', { name: 'Retry loading review' })).toBeNull();
  expect(() => capture()).toThrow('not finished loading');
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await act(async () => {});
  expect(screen.queryByRole('alert')).toBeNull();
  expect(loadDiff).toHaveBeenCalledTimes(2);
  const saved = capture();
  expect(saved.state.source).toEqual(source);
  saved.unlock();
});

it('keeps drafts and save guards when recovery is relocated by a custom composition', () => {
  let capture!: ReturnType<typeof useReviewSaveTransaction>['begin'];
  let edit!: ReturnType<typeof useReviewDraft>;
  function Composer() {
    edit = useReviewDraft({ filePath: 'a.ts', lineRange: null }, emptyDraftContent());
    return null;
  }
  function Status() {
    capture = useReviewSaveTransaction().begin;
    return <output>{String(useReviewDraftWork())}</output>;
  }
  const adapter = { loadDiff: vi.fn() };
  const tree = (open: boolean) => (
    <ReviewProviders adapter={adapter} initialFiles={files} initialSource={source} recovery={null}>
      <section aria-label='Host recovery'>
        <ReviewDraftRecovery />
      </section>
      <Status />
      {open && <Composer />}
    </ReviewProviders>
  );
  const view = render(tree(true));
  act(() => edit.setBody('keep this draft'));
  view.rerender(tree(false));
  expect(screen.getAllByRole('region', { name: 'Unfinished drafts' })).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Continue draft' })).toBeTruthy();
  expect(() => capture()).toThrow('Finish or cancel');
  view.rerender(tree(true));
  expect(edit.content.body).toBe('keep this draft');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel draft' }));
  expect(screen.queryByRole('region', { name: 'Unfinished drafts' })).toBeNull();
  expect(screen.getByRole('status').textContent).toBe('false');
  capture().unlock();
});
