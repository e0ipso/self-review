import { expect, it, vi } from 'vitest';
import type { DiffFile, DiffLoadPayload, ReviewComment } from '@self-review/types';
import {
  createReviewSession,
  createReviewSessionStore,
  reviewSessionReducer,
  DEFAULT_STATIC_SOURCE,
  type ReviewSessionStore,
} from './review-session';
import { createReviewSessionState, transitionReviewSession } from './review-session-transitions';
import { getViewedReviewIndex } from './review-viewed-index';
import { emptyDraftContent } from './review-drafts';

const file = (path: string): DiffFile => ({
  oldPath: path,
  newPath: path,
  changeType: 'modified',
  isBinary: false,
  hunks: [],
});
const comment = (id: string, filePath = 'a'): ReviewComment => ({
  id,
  filePath,
  body: id,
  lineRange: null,
  category: 'note',
  suggestion: null,
  attachments: [{ id: 'image', mediaType: 'image/png', fileName: 'image.png' }],
});

it('preserves canonical source, payload and feedback aliases through hydration and same-source refresh', () => {
  const files = [file('a')];
  const initial = createReviewSession(files);
  expect(initial.diffSource).toBe(DEFAULT_STATIC_SOURCE);
  expect(initial.allDiffFiles).toBe(files);
  const seed = comment('seed');
  const hydrated = reviewSessionReducer(initial, { type: 'hydrate', comments: [seed] });
  expect(hydrated.files[0].comments[0]).toBe(seed);
  expect(initial.files[0].comments).toEqual([]);
  expect(reviewSessionReducer(hydrated, { type: 'hydrate', comments: [comment('ignored')] })).toBe(
    hydrated
  );
  const payload: DiffLoadPayload = { files, source: initial.diffSource, diagnostics: ['notice'] };
  const refreshed = reviewSessionReducer(hydrated, { type: 'payload', payload });
  expect(refreshed.sessionId).toBe(initial.sessionId);
  expect(refreshed.snapshotId).toBe(initial.snapshotId + 1);
  expect(refreshed.diffSource).toBe(payload.source);
  expect(refreshed.diagnostics).toBe(payload.diagnostics);
  expect(refreshed.allDiffFiles).toBe(files);
  expect(refreshed.files).toBe(hydrated.files);
  expect(refreshed.files[0].comments[0].attachments).toBe(seed.attachments);
});

it('retains off-diff feedback without extending reviewed membership and resets it on replacement', () => {
  const initial = createReviewSession([file('a')], { type: 'directory', sourcePath: '/a' });
  const hydrated = reviewSessionReducer(initial, {
    type: 'hydrate',
    comments: [comment('off-diff', 'missing'), comment('review-level', '')],
  });
  const refreshed = reviewSessionReducer(hydrated, {
    type: 'payload',
    payload: { files: [], source: initial.diffSource },
  });
  expect(refreshed.files.map(entry => entry.path)).toEqual(['missing', '']);
  expect([...refreshed.reviewedPaths]).toEqual([]);
  expect(refreshed.files.flatMap(entry => entry.comments.map(value => value.id))).toEqual([
    'off-diff',
    'review-level',
  ]);
  const replacement = reviewSessionReducer(refreshed, {
    type: 'payload',
    payload: { files: [file('missing')], source: { type: 'directory', sourcePath: '/b' } },
    initialComments: [comment('must-not-hydrate', 'missing')],
  });
  expect(replacement.sessionId).not.toBe(refreshed.sessionId);
  expect(replacement.files[0].comments).toEqual([]);
  expect(replacement.files[0].viewed).toBe(false);
});

it('keeps the existing last-state reconciliation and first-entry lookup rules for duplicates', () => {
  const diff = [file('shared'), { ...file('shared'), changeType: 'deleted' as const }];
  const initial = createReviewSession(diff);
  initial.files[1] = { ...initial.files[1], viewed: true, comments: [comment('second', 'shared')] };
  const store = createReviewSessionStore(initial);
  expect(store.getFile('shared')).toBe(initial.files[0]);
  store.dispatch({ type: 'diff-files', files: diff });
  expect(store.getSnapshot().files.map(entry => entry.viewed)).toEqual([true, true]);
  expect(store.getSnapshot().files.map(entry => entry.changeType)).toEqual(['modified', 'deleted']);
  expect(store.getSnapshot().files[1]).toBe(initial.files[1]);
  expect(store.getFile('shared')).toBe(store.getSnapshot().files[0]);
  expect(initial.files[0].viewed).toBe(false);
});

it('runs replacement policy deterministically with caller-supplied lifetime tokens', () => {
  const state = createReviewSessionState(101, [file('a')], { type: 'directory', sourcePath: '/a' });
  const action = {
    type: 'payload' as const,
    payload: {
      files: [file('b')],
      source: { type: 'directory' as const, sourcePath: '/b' },
    },
  };
  const first = transitionReviewSession(state, action, 202);
  expect(transitionReviewSession(state, action, 202)).toEqual(first);
  expect(first.sessionId).toBe(202);
  expect(state.sessionId).toBe(101);
  expect(state.files[0].path).toBe('a');
  expect(first.files[0].path).toBe('b');
});

it('notifies after commit, releases subscriptions and keeps draft tokens bound to the snapshot', () => {
  const initial = createReviewSession([file('a')]);
  const store = createReviewSessionStore(initial);
  const seen: number[] = [];
  const unsubscribe = store.subscribe(() => seen.push(store.getSnapshot().snapshotId));
  store.dispatch({ type: 'hydrate', comments: [] });
  expect(seen).toEqual([]);
  const draft = store.drafts.acquire({ filePath: 'a', lineRange: null }, emptyDraftContent());
  store.drafts.update(draft.key, draft.token, value => ({ ...value, body: 'keep my work' }));
  store.drafts.processing(draft.key, draft.token, true);
  store.dispatch({
    type: 'payload',
    payload: { files: initial.allDiffFiles, source: initial.diffSource },
  });
  expect(seen).toEqual([1]);
  expect(draft.controller.signal.aborted).toBe(true);
  const recovered = store.drafts.get(draft.key)!;
  expect(recovered.token).not.toBe(draft.token);
  expect(recovered.content.body).toBe('keep my work');
  expect(recovered.interrupted).toBe(true);
  expect(recovered.stale).toBe(true);
  expect(store.drafts.owns(draft.key, draft.token)).toBe(false);
  store.drafts.rebind(
    draft.key,
    recovered.token,
    { filePath: 'a', lineRange: null },
    recovered.content
  );
  const rebound = store.drafts.get(draft.key)!;
  expect(rebound.token).not.toBe(recovered.token);
  expect(rebound.stale).toBe(false);
  const owner = store.lockMutations();
  const before = store.getSnapshot();
  store.dispatch({ type: 'destination', destination: '/blocked' });
  expect(store.getSnapshot()).toBe(before);
  expect(store.drafts.owns(draft.key, rebound.token)).toBe(false);
  store.unlockMutations(owner);
  store.dispatch({
    type: 'payload',
    payload: {
      files: [],
      source: { type: 'directory', sourcePath: '/replacement' },
    },
  });
  expect(store.drafts.getSnapshot()).toEqual([]);
  expect(rebound.controller.signal.aborted).toBe(true);
  unsubscribe();
  store.dispatch({ type: 'load-error', message: 'after disposal' });
  expect(seen).toEqual([1, 2]);
});

it('accepts the original structural store role without requiring a viewed getter', () => {
  const backing = createReviewSessionStore(createReviewSession([file('a')]));
  const legacy: ReviewSessionStore = {
    drafts: backing.drafts,
    getSnapshot: backing.getSnapshot,
    getFile: backing.getFile,
    getDiffFile: backing.getDiffFile,
    getNavigation: backing.getNavigation,
    getProgress: backing.getProgress,
    lockMutations: backing.lockMutations,
    ownsMutations: backing.ownsMutations,
    unlockMutations: backing.unlockMutations,
    subscribe: backing.subscribe,
    dispatch: backing.dispatch,
  };
  const first = getViewedReviewIndex(legacy);
  const notify = vi.fn();
  const dispose = legacy.subscribe(notify);
  legacy.dispatch({
    type: 'files',
    update: files => files.map(entry => ({ ...entry, comments: [comment('added')] })),
  });
  expect(getViewedReviewIndex(legacy)).toBe(first);
  legacy.dispatch({
    type: 'files',
    update: files => files.map(entry => ({ ...entry, viewed: true })),
  });
  expect([...getViewedReviewIndex(legacy).first]).toEqual(['a']);
  expect([...getViewedReviewIndex(legacy).any]).toEqual(['a']);
  expect(notify).toHaveBeenCalledTimes(2);
  dispose();
});
