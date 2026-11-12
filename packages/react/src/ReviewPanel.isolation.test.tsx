import React from 'react';
import { it, expect, vi } from 'vitest';
import { fireEvent, render, within, waitFor } from '@testing-library/react';
import { ReviewPanel } from './ReviewPanel';
import Toolbar from './components/Toolbar';
import { useReview } from './context/ReviewContext';
import { installBrowserApiStubs } from './test-helpers';
installBrowserApiStubs();
const file = {
  oldPath: 'same.ts',
  newPath: 'same.ts',
  changeType: 'modified' as const,
  isBinary: false,
  hunks: [],
};
function Add() {
  const review = useReview();
  return (
    <button onClick={() => review.addComment('same.ts', null, 'thread body', 'bug', null)}>
      Seed comment
    </button>
  );
}
it('keeps shortcuts and bulk actions inside the active review with overlapping paths', async () => {
  const first = {
    loadDiff: async () => ({
      files: [file],
      source: { type: 'directory' as const, sourcePath: '/a' },
    }),
  };
  const second = {
    loadDiff: async () => ({
      files: [file],
      source: { type: 'directory' as const, sourcePath: '/b' },
    }),
  };
  const { container } = render(
    <>
      <ReviewPanel adapter={first} className='first'>
        <Toolbar />
        <Add />
      </ReviewPanel>
      <ReviewPanel adapter={second} className='second'>
        <Toolbar />
        <Add />
      </ReviewPanel>
    </>
  );
  const a = within(container.querySelector('.first')! as HTMLElement);
  const b = within(container.querySelector('.second')! as HTMLElement);
  await a.findByTestId('file-section-same.ts');
  await b.findByTestId('file-section-same.ts');
  const scrollers = container.querySelectorAll<HTMLElement>('[data-scroll-container="diff"]');
  scrollers[0].scrollBy = vi.fn();
  scrollers[1].scrollBy = vi.fn();
  fireEvent.pointerDown(b.getByTestId('file-section-same.ts'));
  fireEvent.keyDown(document, { key: 'j' });
  expect(scrollers[1].scrollBy).toHaveBeenCalledTimes(1);
  expect(scrollers[0].scrollBy).not.toHaveBeenCalled();
  fireEvent.click(a.getByTestId('collapse-all-btn'));
  expect(a.getByTestId('file-section-same.ts').querySelector('.file-diff-content')).toBeNull();
  expect(b.getByTestId('file-section-same.ts').querySelector('.file-diff-content')).not.toBeNull();
  fireEvent.click(b.getByText('Seed comment'));
  fireEvent.click(a.getByTestId('expand-all-btn'));
  fireEvent.click(a.getByText('Seed comment'));
  fireEvent.click(a.getByTestId('collapse-all-comments-btn'));
  await waitFor(() => expect(a.getByText('thread body').closest('[hidden]')).toBeTruthy());
  expect(b.getByText('thread body').closest('[hidden]')).toBeNull();
  const ids = [...container.querySelectorAll('[id]')].map(element => element.id);
  expect(new Set(ids).size).toBe(ids.length);
});

it('keeps a nested review from taking its enclosing review’s scroller', async () => {
  const adapter = {
    loadDiff: async () => ({
      files: [file],
      source: { type: 'directory' as const, sourcePath: '/a' },
    }),
  };
  const { container } = render(
    <ReviewPanel adapter={adapter} className='outer'>
      <ReviewPanel adapter={adapter} className='inner' />
    </ReviewPanel>
  );
  const inner = container.querySelector('.inner')! as HTMLElement;
  await within(inner).findByTestId('file-section-same.ts');
  const innerRoot = inner.closest('.self-review');
  const scrollers = [...container.querySelectorAll<HTMLElement>('[data-scroll-container="diff"]')];
  const innerScroll = scrollers.find(element => element.closest('.self-review') === innerRoot)!;
  const outerScroll = scrollers.find(element => element.closest('.self-review') !== innerRoot)!;
  innerScroll.scrollBy = vi.fn();
  outerScroll.scrollBy = vi.fn();
  fireEvent.pointerDown(within(inner).getByTestId('file-section-same.ts'));
  fireEvent.keyDown(document, { key: 'j' });
  expect(innerScroll.scrollBy).toHaveBeenCalledTimes(1);
  expect(outerScroll.scrollBy).not.toHaveBeenCalled();
});
