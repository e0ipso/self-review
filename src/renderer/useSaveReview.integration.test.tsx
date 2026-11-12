import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ReviewProviders } from '../../packages/react/src/ReviewProviders';
import { useReview } from '../../packages/react/src/context/ReviewContext';
import Toolbar from '../../packages/react/src/components/Toolbar';
import { KeyboardNavigationManager } from '../../packages/react/src/components/KeyboardNavigationManager';
import { LocalizationProvider } from '../../packages/react/src/localization/LocalizationContext';
import { installBrowserApiStubs } from '../../packages/react/src/test-helpers';
import type { DiffLoadPayload, ReviewSaveResult } from '../shared/types';
import { resolveDesktopCatalog } from '../shared/localization';
import CloseConfirmDialog from './components/CloseConfirmDialog';
import { SaveReviewBoundary, useSaveReview } from './useSaveReview';

installBrowserApiStubs();
const payload: DiffLoadPayload = {
  source: { type: 'directory', sourcePath: '/review' },
  files: [{ oldPath: '', newPath: 'a.ts', changeType: 'added', hunks: [], isBinary: false }],
};

it.each(['en', 'es'])(
  'shares one transaction across real toolbar Finish and close-dialog Save, locale=%s',
  async locale => {
    let close!: () => void;
    let resolve!: (result: ReviewSaveResult) => void;
    const response = new Promise<ReviewSaveResult>(yes => {
      resolve = yes;
    });
    const api = {
      onCloseRequested: vi.fn((callback: () => void) => {
        close = callback;
        return () => {};
      }),
      discardAndQuit: vi.fn(),
      submitReview: vi.fn(),
      saveAndQuit: vi.fn(),
      saveReview: vi.fn(() => response),
      acknowledgeReviewSave: vi.fn(),
    };
    let finish!: () => void;
    let comment!: () => void;
    function Shell() {
      const save = useSaveReview(api);
      const review = useReview();
      finish = save;
      comment = () => review.addComment('a.ts', null, 'Retained feedback', 'note', null);
      return (
        <>
          <KeyboardNavigationManager />
          <Toolbar onFinishReview={save} />
          <CloseConfirmDialog api={api} />
          <output>{review.files[0]?.comments.map(value => value.body).join(', ')}</output>
        </>
      );
    }
    render(
      <LocalizationProvider locale={locale} messages={resolveDesktopCatalog(locale)}>
        <ReviewProviders
          adapter={{ loadDiff: async () => payload }}
          initialFiles={payload.files}
          initialSource={payload.source}
        >
          <SaveReviewBoundary api={api}>
            <Shell />
          </SaveReviewBoundary>
        </ReviewProviders>
      </LocalizationProvider>
    );
    await waitFor(() => expect(close).toBeTypeOf('function'));
    act(() => comment());
    act(() => close());
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    fireEvent.click(screen.getByTestId('close-confirm-save'));
    // The toolbar and the dialog use the same inherited controller, including imperative calls.
    act(() => finish());
    fireEvent.click(screen.getByTestId('finish-review-btn'));
    fireEvent.keyDown(document, { key: 'f' });
    expect(api.saveReview).toHaveBeenCalledOnce();
    expect(api.saveReview.mock.calls[0]).toEqual([
      expect.objectContaining({
        files: [
          expect.objectContaining({
            comments: [expect.objectContaining({ body: 'Retained feedback' })],
          }),
        ],
      }),
    ]);
    expect(api.submitReview).not.toHaveBeenCalled();
    expect(api.saveAndQuit).not.toHaveBeenCalled();
    await act(async () =>
      resolve({ status: 'failed', message: 'Disk full', detail: 'Free space' })
    );
    expect(screen.getByRole('alert').textContent).toContain('Disk full');
    expect(screen.getByTestId('desktop-review-interaction').hasAttribute('inert')).toBe(false);
    expect(screen.getByText('Retained feedback')).toBeTruthy();
    expect(api.discardAndQuit).not.toHaveBeenCalled();
    api.saveReview.mockResolvedValueOnce({ status: 'saved', receipt: 'published retry' });
    await act(async () => fireEvent.click(screen.getByTestId('finish-review-btn')));
    expect(api.saveReview).toHaveBeenCalledTimes(2);
    expect(api.acknowledgeReviewSave).toHaveBeenCalledExactlyOnceWith('published retry');
  }
);
