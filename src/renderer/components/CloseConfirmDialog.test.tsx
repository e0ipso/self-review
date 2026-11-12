import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { it, expect, vi } from 'vitest';
import type { FileReviewState, ReviewComment } from '../../shared/types';
const context = vi.hoisted(() => ({
  files: [] as FileReviewState[],
  diffSource: { type: 'directory' as const, sourcePath: '/picked' },
}));
vi.mock('../../../packages/react/src/context/ReviewContext', () => ({
  useReview: () => context,
  useReviewSessionId: () => 1,
  useReviewSnapshotId: () => 0,
  useReviewSaveTransaction: () => ({
    begin: () => ({
      state: {
        timestamp: new Date().toISOString(),
        source: context.diffSource,
        files: context.files,
      },
      current: () => true,
      unlock: () => {},
    }),
  }),
}));
import CloseConfirmDialog from './CloseConfirmDialog';

function api() {
  let close = () => {};
  return {
    onCloseRequested: vi.fn(callback => {
      close = callback;
      return () => {};
    }),
    discardAndQuit: vi.fn(),
    submitReview: vi.fn(),
    saveAndQuit: vi.fn(),
    close: () => act(() => close()),
  };
}
function file(comments: ReviewComment[] = [], viewed = false): FileReviewState {
  return { path: 'a.ts', changeType: 'added', viewed, comments };
}

it('offers Save, Discard and Cancel for viewed-only progress and submits it intact', () => {
  const host = api();
  context.files = [file([], true)];
  render(<CloseConfirmDialog api={host} />);
  host.close();
  expect(screen.getByTestId('close-confirm-dialog')).toBeTruthy();
  expect(host.discardAndQuit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTestId('close-confirm-save'));
  expect(host.submitReview).toHaveBeenCalledWith(expect.objectContaining({ files: context.files }));
  expect(host.saveAndQuit).toHaveBeenCalledOnce();
});

it('keeps the prompt after deleting the final resumed comment', () => {
  const host = api();
  context.files = [
    file([
      {
        id: 'saved',
        filePath: 'a.ts',
        body: 'saved',
        category: 'note',
        lineRange: null,
        suggestion: null,
      },
    ]),
  ];
  const rendered = render(<CloseConfirmDialog api={host} />);
  context.files = [file()];
  rendered.rerender(<CloseConfirmDialog api={host} />);
  host.close();
  expect(screen.getByTestId('close-confirm-dialog')).toBeTruthy();
  expect(host.discardAndQuit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTestId('close-confirm-cancel'));
  expect(host.saveAndQuit).not.toHaveBeenCalled();
});

it('closes a pristine review directly but protects a viewed flag that was subsequently cleared', () => {
  const host = api();
  context.files = [file()];
  const rendered = render(<CloseConfirmDialog api={host} />);
  host.close();
  expect(host.discardAndQuit).toHaveBeenCalledOnce();
  context.files = [file([], true)];
  rendered.rerender(<CloseConfirmDialog api={host} />);
  context.files = [file()];
  rendered.rerender(<CloseConfirmDialog api={host} />);
  host.close();
  expect(screen.getByTestId('close-confirm-dialog')).toBeTruthy();
  expect(host.discardAndQuit).toHaveBeenCalledOnce();
});

it('names the close decision and focuses Cancel under the shared RTL locale boundary', async () => {
  const { LocalizationProvider } =
    await import('../../../packages/react/src/localization/LocalizationContext');
  const { waitFor } = await import('@testing-library/react');
  const host = api();
  context.files = [file([], true)];
  render(
    <LocalizationProvider locale='ar' direction='rtl'>
      <CloseConfirmDialog api={host} />
    </LocalizationProvider>
  );
  host.close();
  const dialog = screen.getByRole('alertdialog', { name: 'Save your review?' });
  expect(dialog).toBeTruthy();
  expect(document.querySelector('[dir="rtl"]')).toBeTruthy();
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }))
  );
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(host.submitReview).not.toHaveBeenCalled();
});
