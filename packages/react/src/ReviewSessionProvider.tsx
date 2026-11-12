import React, { useContext, useLayoutEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { FileReviewState } from '@self-review/types';
import type { ReviewAdapter } from './adapter';
import { useReviewHost } from './hooks/useReviewHost';
import { useAdapter } from './context/ReviewAdapterContext';
import { useConfiguration } from './context/ConfigContext';
import { useReviewServices } from './context/ReviewServicesContext';
import {
  ReviewContext,
  SessionStoreContext,
  CommandsContext,
  type ReviewProviderProps,
} from './context/review-context';
import {
  createReviewSession,
  createReviewSessionStore,
  reviewSessionIdentity,
  reviewSessionReducer,
  isPlaceholderSource,
  type ReviewSessionStore,
} from './context/review-session';
import { createReviewStateCommands } from './context/review-state-commands';
import { createReviewStateQueries } from './context/review-state-queries';
import { createSessionCommands, type ReviewCommands } from './context/review-commands';
import { projectReviewContext } from './context/review-compatibility';
import { ReviewDisplayProvider } from './context/ReviewDisplayContext';
import { ReviewLifecycleContext } from './context/ReviewLifecycleContext';
import { ReviewLoadContext } from './context/ReviewLoadContext';
import { ApplyOperationsContext, createApplyOperations } from './context/apply-operation';
import { ReviewDraftRecovery } from './components/Comments/ReviewDraftRecovery';
import { ReviewLoadRecovery } from './components/ReviewLoadRecovery';

const adapterIds = new WeakMap<object, number>();
let nextAdapterId = 1;
function adapterIdentity(adapter: object | null): number {
  if (!adapter) return 0;
  let id = adapterIds.get(adapter);
  if (id === undefined) {
    id = nextAdapterId++;
    adapterIds.set(adapter, id);
  }
  return id;
}

/**
 * Owns the session on screen. Adapter changes and different logical source identities replace it.
 * Updates to the same remote PR retain feedback; snapshot changes invalidate asynchronous work
 * and reconcile anchors against both diffs before any suggestion can be used again.
 */
export function ReviewProvider(props: ReviewProviderProps) {
  const adapter = useAdapter();
  const sessionKey = [
    adapterIdentity(adapter),
    props.initialFiles ? 'static' : 'adapter',
    props.initialSource ? reviewSessionIdentity(props.initialSource) : '',
  ].join('|');
  return <ReviewSessionProvider key={sessionKey} {...props} adapter={adapter} />;
}

function ReviewSessionProvider({
  children,
  initialFiles,
  initialSource,
  initialComments,
  adapter,
}: ReviewProviderProps & { adapter: ReviewAdapter | null }) {
  const [store] = useState(() =>
    createReviewSessionStore(
      reviewSessionReducer(
        createReviewSession(initialFiles, initialSource, !!adapter?.loadResumedReview),
        { type: 'hydrate', comments: initialComments }
      )
    )
  );
  useLayoutEffect(() => () => store.drafts.abortPending(), [store]);
  const host = useReviewHost(store, adapter, initialFiles !== undefined, initialComments, {
    files: initialFiles,
    source: initialSource,
  });
  // Feedback edits do not rerun command binding or replace Apply ownership.
  const snapshotId = useSyncExternalStore(
    store.subscribe,
    () => store.getSnapshot().snapshotId,
    () => store.getSnapshot().snapshotId
  );
  const { createId } = useReviewServices();
  const setFiles = useMemo(
    () => (update: React.SetStateAction<FileReviewState[]>) =>
      store.dispatch({ type: 'files', update }),
    [store]
  );
  const operations = useMemo(
    () => createReviewStateCommands(setFiles, createId),
    [setFiles, createId]
  );
  const commands = useMemo(
    () => createSessionCommands(store, host.controller, operations),
    [store, host.controller, operations, snapshotId]
  );
  const apply = useMemo(createApplyOperations, [snapshotId]);
  return (
    <SessionStoreContext.Provider value={store}>
      <CommandsContext.Provider value={commands}>
        <ApplyOperationsContext.Provider value={apply}>
          <ReviewSessionProjection
            store={store}
            commands={commands}
            retryLoad={host.retryLoad}
            retryResume={host.retryResume}
          >
            {children}
          </ReviewSessionProjection>
        </ApplyOperationsContext.Provider>
      </CommandsContext.Provider>
    </SessionStoreContext.Provider>
  );
}

/** The complete legacy projection is subscribed here, separate from commands and request ownership. */
function ReviewSessionProjection({
  store,
  commands,
  retryLoad,
  retryResume,
  children,
}: {
  store: ReviewSessionStore;
  commands: ReviewCommands;
  retryLoad: () => Promise<void>;
  retryResume: () => Promise<void>;
  children: React.ReactNode;
}) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const { config } = useConfiguration();
  const notifyIdentity = useContext(ReviewLifecycleContext);
  useLayoutEffect(() => {
    if (state.identity && !isPlaceholderSource(state.diffSource)) notifyIdentity?.(state.identity);
  }, [notifyIdentity, state.identity, state.diffSource]);
  const diffFiles = useMemo(
    () =>
      config.showUntracked
        ? state.allDiffFiles
        : state.allDiffFiles.filter(file => !file.isUntracked),
    [state.allDiffFiles, config.showUntracked]
  );
  const queries = useMemo(() => createReviewStateQueries(state.files), [state.files]);
  const value = projectReviewContext(
    store,
    state,
    diffFiles,
    commands,
    queries,
    retryLoad,
    retryResume
  );
  const loading = useMemo(
    () => ({ loadError: state.loadError, resumeError: state.resumeError, retryLoad, retryResume }),
    [state.loadError, state.resumeError, retryLoad, retryResume]
  );
  return (
    <ReviewContext.Provider value={value}>
      <ReviewLoadContext.Provider value={loading}>
        <ReviewLoadRecovery />
      </ReviewLoadContext.Provider>
      <ReviewDisplayProvider
        sessionId={state.sessionId}
        files={diffFiles}
        isLargePayload={state.isLargePayload}
        reviewFiles={state.files}
      >
        <ReviewDraftRecovery />
        {children}
      </ReviewDisplayProvider>
    </ReviewContext.Provider>
  );
}
