import { useContext, useSyncExternalStore, useMemo, useRef, useLayoutEffect } from 'react';
import type { ReviewState } from '@self-review/types';
import { ReviewContext, SessionStoreContext } from './review-context';
import type { ReviewSessionStore } from './review-session';
import { isPlaceholderSource } from './review-session';
import { useConfiguration } from './ConfigContext';
import { useLocalization } from '../localization/LocalizationContext';
import { UnfinishedReviewDraftError } from './review-drafts';
import { useReviewServices } from './ReviewServicesContext';
export type { ReviewContextValue, ReviewProviderProps } from './review-context';
export { ReviewProvider } from '../ReviewSessionProvider';
export { reviewSessionIdentity } from './review-session';

export function useReview() {
  const context = useContext(ReviewContext);
  if (!context) throw new Error('useReview must be used within ReviewProvider');
  return context;
}
export function useOptionalReview() {
  return useContext(ReviewContext);
}
function useSessionSelection<T>(
  select: (state: ReturnType<ReviewSessionStore['getSnapshot']>) => T
): T {
  const store = useContext(SessionStoreContext);
  if (!store) throw new Error('Session selection must be used within ReviewProvider');
  return useSyncExternalStore(
    store.subscribe,
    () => select(store.getSnapshot()),
    () => select(store.getSnapshot())
  );
}
function useStoreSelection<T>(select: (store: ReviewSessionStore) => T): T {
  const store = useContext(SessionStoreContext);
  if (!store) throw new Error('Session selection must be used within ReviewProvider');
  return useSyncExternalStore(
    store.subscribe,
    () => select(store),
    () => select(store)
  );
}
/** Indexed reads preserve canonical references and avoid one array scan per subscriber. */
export function useFileReview(filePath: string) {
  return useStoreSelection(store => store.getFile(filePath));
}
export function useReviewedFile(filePath: string) {
  return useStoreSelection(store => store.getDiffFile(filePath));
}
/** Counts and viewed flags only. Comment/reply body edits retain this projection's identity. */
export function useNavigationReview() {
  return useStoreSelection(store => store.getNavigation());
}
/** Progress counts each canonical entry, including entries with a repeated display path. */
export function useProgressReview() {
  return useStoreSelection(store => store.getProgress());
}
export function useReviewSource() {
  return useSessionSelection(state => state.diffSource);
}
export function useReviewSessionId() {
  return useSessionSelection(state => state.sessionId);
}
export function useReviewSnapshotId() {
  return useSessionSelection(state => state.snapshotId);
}

/** The diff stream does not subscribe to comment mutations. */
export function useDiffReview() {
  const all = useSessionSelection(state => state.allDiffFiles);
  const { config } = useConfiguration();
  const diffFiles = useMemo(
    () => (config.showUntracked ? all : all.filter(file => !file.isUntracked)),
    [all, config.showUntracked]
  );
  return {
    diffFiles,
    diffSource: useReviewSource(),
    diagnostics: useSessionSelection(state => state.diagnostics),
    isLargePayload: useSessionSelection(state => state.isLargePayload),
    sessionId: useReviewSessionId(),
  };
}

export interface ReviewSaveSnapshot {
  /** One ready snapshot, captured from the synchronous owner rather than a render closure. */
  state: ReviewState;
  /** False after replacement or provider disposal. Ignore all late publication replies then. */
  current: () => boolean;
  /** Release only this save after a known refusal, or explicit inspection of an unknown outcome. */
  unlock: () => void;
}
export interface ReviewSaveTransaction {
  /** Throws while diff/resume loading failed or is pending, or another save owns the snapshot.
   * Unfinished drafts must be submitted or cancelled before capture.
   * Success and unknown outcomes retain the lock. Never retry a write automatically.
   */
  begin: () => ReviewSaveSnapshot;
}

/** Host publication freezes the synchronous state owner before capturing its snapshot.
 * A known failure unlocks this owner only; a replacement session is never unlocked by an old reply.
 */
export function useReviewSaveTransaction(): ReviewSaveTransaction {
  const store = useContext(SessionStoreContext);
  if (!store) throw new Error('Save transactions require ReviewProvider');
  const { now } = useReviewServices();
  const { t } = useLocalization();
  const clock = useRef(now);
  clock.current = now;
  const live = useRef(true);
  useLayoutEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  return useMemo(
    () => ({
      begin() {
        const state = store.getSnapshot();
        if (store.drafts.hasWork())
          throw new UnfinishedReviewDraftError(
            t('Finish or cancel unfinished drafts before saving the review.')
          );
        if (
          !live.current ||
          isPlaceholderSource(state.diffSource) ||
          state.loadError !== null ||
          state.resumeError !== null ||
          state.resumePending
        )
          throw new Error('The current review has not finished loading.');
        const timestamp = clock.current().toISOString();
        const owner = store.lockMutations();
        return {
          state: {
            timestamp,
            source: state.diffSource,
            files: state.files,
          },
          current: () =>
            live.current &&
            store.ownsMutations(owner) &&
            store.getSnapshot().sessionId === state.sessionId &&
            store.getSnapshot().snapshotId === state.snapshotId,
          unlock: () => {
            store.unlockMutations(owner);
          },
        };
      },
    }),
    [store, t]
  );
}

export {
  useReviewCommands,
  useOptionalSnapshotKey,
  useOptionalApplySession,
} from './review-session-hooks';
