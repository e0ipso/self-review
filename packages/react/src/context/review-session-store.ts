import type { DiffFile, DiffSource } from '@self-review/types';
import { createReviewDraftStore } from './review-drafts';
import { createReviewSessionIndexes } from './review-session-indexes';
import {
  createReviewSessionState,
  reviewSessionIdentity,
  transitionReviewSession,
  type ReviewSessionState,
  type SessionAction,
} from './review-session-transitions';

// Allocate lifetime tokens outside the pure transition policy. Existing public factories and
// reducers share this sequence, including callers that do not create an external store.
let nextSessionId = 1;
export function createReviewSession(
  files?: DiffFile[],
  source?: DiffSource,
  resumePending = false
) {
  return createReviewSessionState(nextSessionId++, files, source, resumePending);
}
export function reviewSessionReducer(state: ReviewSessionState, action: SessionAction) {
  const replacing =
    action.type === 'payload' &&
    reviewSessionIdentity(action.payload.source, action.payload.remote) !== state.identity;
  return transitionReviewSession(state, action, replacing ? nextSessionId++ : state.sessionId);
}

/** One synchronous owner also lets async callbacks check ownership before React commits. */
export function createReviewSessionStore(initial: ReviewSessionState) {
  let state = initial;
  const listeners = new Set<() => void>();
  const indexes = createReviewSessionIndexes(() => state);
  let mutationLock: symbol | null = null;
  const drafts = createReviewDraftStore(() => ({
    snapshotId: state.snapshotId,
    locked: mutationLock !== null,
  }));
  return {
    drafts,
    getSnapshot: () => state,
    ...indexes,
    lockMutations: () => {
      if (mutationLock) throw new Error('A save already owns this review.');
      mutationLock = Symbol('review-save');
      return mutationLock;
    },
    ownsMutations: (owner: symbol) => mutationLock === owner,
    unlockMutations: (owner: symbol) => {
      if (mutationLock === owner) mutationLock = null;
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatch: (action: SessionAction) => {
      if (
        mutationLock &&
        ['files', 'resume', 'resume-start', 'hydrate', 'diff-files', 'destination'].includes(
          action.type
        )
      )
        return;
      const next = reviewSessionReducer(state, action);
      if (next.sessionId !== state.sessionId || next.snapshotId !== state.snapshotId)
        mutationLock = null;
      if (next === state) return;
      const replacement = next.sessionId !== state.sessionId;
      const refreshed = next.snapshotId !== state.snapshotId;
      state = next;
      if (replacement || refreshed) drafts.transition(replacement);
      listeners.forEach(listener => listener());
    },
  };
}
export type ReviewSessionStore = ReturnType<typeof createReviewSessionStore>;
