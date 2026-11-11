import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { it, expect, vi } from 'vitest';
import type { FileReviewState, ReviewComment } from '../../shared/types';
const context = vi.hoisted(() => ({
  files: [] as FileReviewState[],
  diffSource: { type: 'directory' as const, sourcePath: '/picked' },
}));
vi.mock('../../../packages/react/src/context/ReviewContext', () => ({ useReview: () => context }));
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
