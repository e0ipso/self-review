import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ReviewProviders } from '../../packages/react/src/ReviewProviders';
import CommentInput from '../../packages/react/src/components/Comments/CommentInput';
import { installBrowserApiStubs } from '../../packages/react/src/test-helpers';
import { LocalizationProvider } from '../../packages/react/src/localization/LocalizationContext';
import { resolveDesktopCatalog } from '../shared/localization';
import { SaveReviewBoundary, useSaveReview } from './useSaveReview';
import CloseConfirmDialog from './components/CloseConfirmDialog';
installBrowserApiStubs();
afterEach(cleanup);

it('prompts on draft-only close and refuses Finish and Save & Quit before any legacy handoff', () => {
  let close!: () => void;
  const api = {
    submitReview: vi.fn(),
    saveAndQuit: vi.fn(),
    discardAndQuit: vi.fn(),
    onCloseRequested: (callback: () => void) => {
      close = callback;
      return () => {};
    },
  };
  function Controls() {
    const save = useSaveReview(api);
    return <button onClick={save}>Finish</button>;
  }
  render(
    <LocalizationProvider locale='es' messages={resolveDesktopCatalog('es')}>
      <ReviewProviders
        adapter={{
          loadDiff: async () => ({
            files: [],
            source: { type: 'directory', sourcePath: '/review' },
          }),
        }}
        initialFiles={[
          { oldPath: 'a.ts', newPath: 'a.ts', changeType: 'added', isBinary: false, hunks: [] },
        ]}
      >
        <SaveReviewBoundary api={api}>
          <Controls />
          <CommentInput filePath='a.ts' lineRange={null} onCancel={() => {}} />
          <CloseConfirmDialog api={api} />
        </SaveReviewBoundary>
      </ReviewProviders>
    </LocalizationProvider>
  );
  fireEvent.change(screen.getByTestId('comment-input').querySelector('textarea')!, {
    target: { value: 'Only a draft' },
  });
  fireEvent.click(screen.getByText('Finish'));
  expect(screen.getByRole('alert').textContent).toContain('Termina o cancela los borradores');
  expect(api.submitReview).not.toHaveBeenCalled();
  act(() => close());
  expect(screen.getByTestId('close-confirm-dialog')).toBeTruthy();
  expect(api.discardAndQuit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTestId('close-confirm-save'));
  expect(api.submitReview).not.toHaveBeenCalled();
  expect(api.saveAndQuit).not.toHaveBeenCalled();
  expect(screen.getByDisplayValue('Only a draft')).toBeTruthy();
  act(() => close());
  fireEvent.click(screen.getByTestId('close-confirm-discard'));
  expect(api.discardAndQuit).toHaveBeenCalledOnce();
});

it('retains the no-draft legacy handoff after cancelling the unfinished draft', async () => {
  const api = { submitReview: vi.fn(), saveAndQuit: vi.fn() };
  function Controls() {
    const save = useSaveReview(api);
    return <button onClick={save}>Finish</button>;
  }
  render(
    <ReviewProviders
      adapter={{
        loadDiff: async () => ({ files: [], source: { type: 'directory', sourcePath: '/review' } }),
      }}
      initialFiles={[
        { oldPath: 'a.ts', newPath: 'a.ts', changeType: 'added', isBinary: false, hunks: [] },
      ]}
    >
      <SaveReviewBoundary api={api}>
        <Controls />
        <CommentInput filePath='a.ts' lineRange={null} onCancel={() => {}} />
      </SaveReviewBoundary>
    </ReviewProviders>
  );
  fireEvent.change(screen.getByTestId('comment-input').querySelector('textarea')!, {
    target: { value: 'Cancel me' },
  });
  fireEvent.click(screen.getByTestId('cancel-comment-btn'));
  await act(async () => fireEvent.click(screen.getByText('Finish')));
  expect(api.submitReview).toHaveBeenCalledOnce();
  expect(api.submitReview.mock.calls[0][0].files[0].comments).toEqual([]);
  expect(api.saveAndQuit).toHaveBeenCalledOnce();
});
