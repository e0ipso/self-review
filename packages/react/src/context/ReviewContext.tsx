import React, {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type {
  Attachment,
  DiffFile,
  DiffHunk,
  DiffSource,
  FileReviewState,
  Reply,
  ReviewState,
  ReviewComment,
  RemoteDriftInfo,
  RemoteSessionInfo,
  LineRange,
  Suggestion,
} from '@self-review/types';
import { useReviewStateOperations } from '../hooks/useReviewState';
import { useReviewHost } from '../hooks/useReviewHost';
import { useSessionCommands, type ReviewCommands } from './review-commands';
import { projectReviewContext } from './review-compatibility';
import { useConfiguration } from './ConfigContext';
import { useAdapter } from './ReviewAdapterContext';
import type { ReviewAdapter } from '../adapter';
import {
  createReviewSession,
  createReviewSessionStore,
  reviewSessionIdentity,
  reviewSessionReducer,
  type ReviewSessionStore,
} from './review-session';
import { ReviewDisplayProvider } from './ReviewDisplayContext';
import { ReviewLifecycleContext } from './ReviewLifecycleContext';
import { isPlaceholderSource } from './review-session';
import { ReviewLoadContext } from './ReviewLoadContext';
import {
  ApplyOperationsContext,
  createApplyOperations,
} from '../components/Comments/apply-operation';
import { ReviewLoadRecovery } from '../components/ReviewLoadRecovery';
import { useReviewServices } from './ReviewServicesContext';
export { reviewSessionIdentity } from './review-session';

export interface ReviewContextValue {
  files: FileReviewState[];
  diffFiles: DiffFile[];
  diffSource: DiffSource;
  setDiffFiles: (files: DiffFile[]) => void;
  addComment: (
    filePath: string,
    lineRange: LineRange | null,
    body: string,
    category: string,
    suggestion: Suggestion | null,
    attachments?: Attachment[]
  ) => void;
  editComment: (id: string, updates: Partial<ReviewComment>) => void;
  deleteComment: (id: string) => void;
  addReply: (commentId: string, body: string, author?: string, attachments?: Attachment[]) => void;
  updateReply: (commentId: string, replyId: string, updates: Partial<Reply>) => void;
  deleteReply: (commentId: string, replyId: string) => void;
  toggleViewed: (filePath: string) => void;
  getCommentsForFile: (filePath: string) => ReviewComment[];
  getCommentsForLine: (
    filePath: string,
    lineNumber: number,
    side: 'old' | 'new'
  ) => ReviewComment[];
  expandFileContext: (
    filePath: string,
    contextLines: number
  ) => Promise<{ hunks: DiffHunk[]; totalLines: number } | null>;
  updateFileHunks: (filePath: string, hunks: DiffHunk[]) => void;
  /** Remote head drift from the resumed document; `null` for local or drift-free reviews. */
  remoteDrift: RemoteDriftInfo | null;
  /** One line per resumed comment the importer downgraded (`ResumeLoadPayload.importDiagnostics`). */
  importDiagnostics: string[];
  /** Remote PR/MR provenance, or `null`. `temporaryClone` decides where an apply can write. */
  remote: RemoteSessionInfo | null;
  /** What the host could not load faithfully (`DiffLoadPayload.diagnostics`). */
  diagnostics: string[];
  /** Large-payload mode: files may arrive without hunks and load on demand. */
  isLargePayload: boolean;
  /** Directory the reviewer named for applies, or `null`. Only a temporary-clone review needs one. */
  applyDestination: string | null;
  /** Record the destination the host accepted. */
  setApplyDestination: (destinationRoot: string) => void;
  /** Payload paths only, never synthetic entries, so Apply is not offered on placeholders. */
  reviewedPaths: ReadonlySet<string>;
  /** Changes when a new session starts; async work compares it to drop stale results. */
  sessionId: number;
  /** Changes on external snapshot replacement, but not on local context expansion. */
  snapshotId?: number;
  /** Checks synchronously, including before a replacement has committed in React. */
  isCurrentSession?: () => boolean;
  loadError?: string | null;
  resumeError?: string | null;
  retryLoad?: () => Promise<void>;
  retryResume?: () => Promise<void>;
}

const ReviewContext = createContext<ReviewContextValue | null>(null);
const SessionStoreContext = createContext<ReviewSessionStore | null>(null);
const CommandsContext = createContext<ReviewCommands | null>(null);

export function useReview() {
  const context = useContext(ReviewContext);
  if (!context) throw new Error('useReview must be used within ReviewProvider');
  return context;
}
export function useOptionalReview() {
  return useContext(ReviewContext);
}
export function useReviewCommands() {
  const commands = useContext(CommandsContext);
  if (!commands) throw new Error('useReviewCommands must be used within ReviewProvider');
  return commands;
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

export interface ReviewProviderProps {
  children: ReactNode;
  /** Static diff data used instead of `adapter.loadDiff()`; no loading or push subscription. */
  initialFiles?: DiffFile[];
  /** Source metadata for `initialFiles`; part of the session identity, compared by value. */
  initialSource?: DiffSource;
  /**
   * Seeds the session once, when its files are known; later values are ignored so they never
   * overwrite the reviewer's edits. A session pushed later through `adapter.onDiffLoad` starts
   * without them, except a push that replaces the welcome placeholder.
   */
  initialComments?: ReviewComment[];
}

/**
 * Holds the review session (diff, source, comments, viewed flags). Session identity is the
 * adapter object plus {@link reviewSessionIdentity}. A different adapter, `initialSource` or
 * static/adapter switch, or a pushed payload with another identity, replaces the session and
 * discards everything from the old one. The same identity updates it, carrying comments over by
 * path. Keep the adapter identity stable unless a new session is intended.
 */
export function ReviewProvider(props: ReviewProviderProps) {
  const adapter = useAdapter();
  const { initialFiles, initialSource } = props;
  const sessionKey = [
    adapterIdentity(adapter),
    initialFiles ? 'static' : 'adapter',
    initialSource ? reviewSessionIdentity(initialSource) : '',
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
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const { config } = useConfiguration();
  const notifyIdentity = useContext(ReviewLifecycleContext);
  useLayoutEffect(() => {
    if (state.identity && !isPlaceholderSource(state.diffSource)) notifyIdentity?.(state.identity);
  }, [notifyIdentity, state.identity, state.diffSource]);
  const setFiles = useMemo(
    () => (update: React.SetStateAction<FileReviewState[]>) =>
      store.dispatch({ type: 'files', update }),
    [store]
  );
  const review = useReviewStateOperations(state.files, setFiles);
  const { retryLoad, retryResume } = useReviewHost(
    store,
    adapter,
    initialFiles !== undefined,
    initialComments,
    { files: initialFiles, source: initialSource }
  );
  const loadingState = useMemo(
    () => ({
      loadError: state.loadError,
      resumeError: state.resumeError,
      retryLoad,
      retryResume,
    }),
    [state.loadError, state.resumeError, retryLoad, retryResume]
  );

  const diffFiles = useMemo(
    () =>
      config.showUntracked
        ? state.allDiffFiles
        : state.allDiffFiles.filter(file => !file.isUntracked),
    [state.allDiffFiles, config.showUntracked]
  );
  const commands = useSessionCommands(store, adapter, review, state.sessionId, state.snapshotId);
  const applyOperations = useMemo(createApplyOperations, [state.sessionId, state.snapshotId]);
  const value = projectReviewContext(
    store,
    state,
    diffFiles,
    commands,
    review,
    retryLoad,
    retryResume
  );
  return (
    <SessionStoreContext.Provider value={store}>
      <ApplyOperationsContext.Provider value={applyOperations}>
        <CommandsContext.Provider value={commands}>
          <ReviewContext.Provider value={value}>
            <ReviewLoadContext.Provider value={loadingState}>
              <ReviewLoadRecovery />
            </ReviewLoadContext.Provider>
            <ReviewDisplayProvider
              sessionId={state.sessionId}
              files={diffFiles}
              isLargePayload={state.isLargePayload}
              reviewFiles={state.files}
            >
              {children}
            </ReviewDisplayProvider>
          </ReviewContext.Provider>
        </CommandsContext.Provider>
      </ApplyOperationsContext.Provider>
    </SessionStoreContext.Provider>
  );
}

export function useOptionalSnapshotKey() {
  const store = useContext(SessionStoreContext);
  const read = () =>
    store ? `${store.getSnapshot().sessionId}:${store.getSnapshot().snapshotId}` : '';
  return useSyncExternalStore(store?.subscribe ?? (() => () => {}), read, read);
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

/** Apply controls depend on session ownership and destination, never on comment bodies. */
export function useOptionalApplySession() {
  const store = useContext(SessionStoreContext);
  const commands = useContext(CommandsContext);
  const subscribe = store?.subscribe ?? emptySubscribe;
  const read = () => store?.getSnapshot();
  // Each selected value retains its identity across unrelated file/comment updates.
  const select =
    <T,>(selector: (state: ReturnType<ReviewSessionStore['getSnapshot']>) => T) =>
    () => {
      const state = read();
      return state ? selector(state) : undefined;
    };
  const sessionId = useSyncExternalStore(
    subscribe,
    select(s => s.sessionId),
    select(s => s.sessionId)
  );
  const snapshotId = useSyncExternalStore(
    subscribe,
    select(s => s.snapshotId),
    select(s => s.snapshotId)
  );
  const diffSource = useSyncExternalStore(
    subscribe,
    select(s => s.diffSource),
    select(s => s.diffSource)
  );
  const reviewedPaths = useSyncExternalStore(
    subscribe,
    select(s => s.reviewedPaths),
    select(s => s.reviewedPaths)
  );
  const remote = useSyncExternalStore(
    subscribe,
    select(s => s.remote),
    select(s => s.remote)
  );
  const applyDestination = useSyncExternalStore(
    subscribe,
    select(s => s.applyDestination),
    select(s => s.applyDestination)
  );
  return store && commands && diffSource && reviewedPaths
    ? {
        sessionId,
        snapshotId,
        diffSource,
        reviewedPaths,
        remote,
        applyDestination,
        isCurrentSession: commands.isCurrentSession,
        setApplyDestination: commands.setApplyDestination,
      }
    : null;
}
const emptySubscribe = () => () => {};

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
    [store]
  );
}
