import { expect, it } from 'vitest';
import type { DiffFile } from '@self-review/types';
import { createReviewSession, createReviewSessionStore } from './review-session';

function fixture() {
  const diff: DiffFile[] = [
    {
      oldPath: 'old',
      newPath: 'shared',
      changeType: 'renamed',
      isBinary: false,
      hunks: [],
    },
    {
      oldPath: 'shared',
      newPath: '',
      changeType: 'deleted',
      isBinary: false,
      hunks: [],
    },
  ];
  const initial = createReviewSession(diff);
  initial.files[1] = { ...initial.files[1], viewed: true };
  return { diff, store: createReviewSessionStore(initial) };
}

it('preserves the first matching review state when several entries display the same path', () => {
  const { store } = fixture();
  expect(store.getFile('shared')).toBe(store.getSnapshot().files[0]);
});

it('preserves first-match source lookup through duplicate-path reordering', () => {
  const { store, diff } = fixture();
  expect(store.getDiffFile('shared')).toBe(diff[0]);
  store.dispatch({ type: 'diff-files', files: [diff[1], diff[0]] });
  expect(store.getDiffFile('shared')).toBe(diff[1]);
});

it('keeps the first-path navigation projection stable when later duplicates change', () => {
  const { store } = fixture();
  const navigation = store.getNavigation();
  expect(navigation.get('shared')).toEqual({ viewed: false, commentCount: 0 });
  expect(store.getNavigation()).toBe(navigation);
  store.dispatch({
    type: 'files',
    update: files => [files[0], { ...files[1], viewed: false }],
  });
  expect(store.getNavigation()).toBe(navigation);
  store.dispatch({
    type: 'files',
    update: files => [{ ...files[1], viewed: true }, files[0]],
  });
  expect(store.getNavigation().get('shared')).toEqual({ viewed: true, commentCount: 0 });
  expect(store.getFile('shared')).toBe(store.getSnapshot().files[0]);
  expect(store.getSnapshot().files).toHaveLength(2);
});

it('retains every progress entry and reuses its snapshot when only canonical references change', () => {
  const { store } = fixture();
  const progress = store.getProgress();
  expect(progress.map(file => file.viewed)).toEqual([false, true]);
  expect(store.getProgress()).toBe(progress);
  store.dispatch({ type: 'files', update: files => files.map(file => ({ ...file })) });
  expect(store.getProgress()).toBe(progress);
  store.dispatch({ type: 'files', update: files => [...files].reverse() });
  expect(store.getProgress().map(file => file.viewed)).toEqual([true, false]);
  expect(store.getProgress()).not.toBe(progress);
});
