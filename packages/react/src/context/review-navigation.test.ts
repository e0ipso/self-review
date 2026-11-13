import { expect, it } from 'vitest';
import { createReviewSession, createReviewSessionStore } from './review-session';
import type { DiffFile } from '@self-review/types';

it('reuses indexed canonical files and stable navigation snapshots across body edits', () => {
  const diff: DiffFile[] = ['a', 'b'].map(path => ({
    oldPath: path,
    newPath: path,
    changeType: 'modified',
    isBinary: false,
    hunks: [],
  }));
  const store = createReviewSessionStore(createReviewSession(diff));
  store.dispatch({
    type: 'hydrate',
    comments: [
      {
        id: 'c1',
        filePath: 'a',
        lineRange: null,
        body: 'first',
        category: 'bug',
        suggestion: null,
      },
    ],
  });
  const navigation = store.getNavigation();
  expect(store.getNavigation()).toBe(navigation);
  expect(store.getDiffFile('a')).toBe(diff[0]);
  expect(store.getFile('a')).toBe(store.getSnapshot().files[0]);
  store.dispatch({
    type: 'files',
    update: files =>
      files.map(file =>
        file.path === 'a'
          ? { ...file, comments: file.comments.map(comment => ({ ...comment, body: 'edited' })) }
          : file
      ),
  });
  expect(store.getNavigation()).toBe(navigation);
  expect(store.getFile('a')?.comments[0].body).toBe('edited');
  expect(store.getFile('a')).toBe(store.getSnapshot().files[0]);
  store.dispatch({
    type: 'files',
    update: files => files.map(file => (file.path === 'a' ? { ...file, viewed: true } : file)),
  });
  const changed = store.getNavigation();
  expect(changed).not.toBe(navigation);
  expect(changed.get('b')).toBe(navigation.get('b'));
  expect(changed.get('a')).toEqual({ viewed: true, commentCount: 1 });
  expect(store.getNavigation()).toBe(changed);
  expect(diff.map(file => file.newPath)).toEqual(['a', 'b']);
  store.dispatch({ type: 'diff-files', files: [diff[1], diff[0]] });
  expect([...store.getNavigation().keys()]).toEqual(['b', 'a']);
  expect(store.getNavigation().get('a')).toBe(changed.get('a'));
  store.dispatch({
    type: 'payload',
    payload: { files: [diff[1]], source: { type: 'directory', sourcePath: '/other' } },
  });
  expect(store.getFile('a')).toBeUndefined();
  expect(store.getDiffFile('a')).toBeUndefined();
  expect([...store.getNavigation().keys()]).toEqual(['b']);
});
