import React, {
  createContext,
  useContext,
  useEffect,
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
  ReviewComment,
  RemoteDriftInfo,
  RemoteSessionInfo,
  LineRange,
  Suggestion,
} from '@self-review/types';
import { useReviewStateOperations } from '../hooks/useReviewState';
import { useReviewHost } from '../hooks/useReviewHost';
import { useConfig } from './ConfigContext';
import { useAdapter } from './ReviewAdapterContext';
import type { ReviewAdapter } from '../adapter';
import {
  createReviewSession,
  createReviewSessionStore,
  reviewSessionIdentity,
  type ReviewSessionStore,
} from './review-session';
import { ReviewLifecycleContext } from './ReviewLifecycleContext';
import { isPlaceholderSource } from './review-session';
import { Button } from '../components/ui/button';
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
type ReviewCommands = Pick<
  ReviewContextValue,
  | 'addComment'
  | 'editComment'
  | 'deleteComment'
  | 'addReply'
  | 'updateReply'
  | 'deleteReply'
  | 'toggleViewed'
  | 'expandFileContext'
  | 'updateFileHunks'
  | 'setApplyDestination'
  | 'isCurrentSession'
>;
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
/** Subscribes only to this file's review state, preserving references for unrelated files. */
export function useFileReview(filePath: string) {
  return useSessionSelection(state => state.files.find(file => file.path === filePath));
}
export function useReviewedFile(filePath: string) {
  return useSessionSelection(state =>
    state.allDiffFiles.find(file => (file.newPath || file.oldPath) === filePath)
  );
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
    createReviewSessionStore(createReviewSession(initialFiles, initialSource))
  );
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const { config } = useConfig();
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
    initialComments
  );
  const staticFiles = useRef(initialFiles);
  useLayoutEffect(() => {
    if (!initialFiles || initialFiles === staticFiles.current) return;
    staticFiles.current = initialFiles;
    store.dispatch({
      type: 'payload',
      payload: { files: initialFiles, source: initialSource ?? state.diffSource },
      initialComments,
    });
  }, [initialFiles, initialSource, initialComments, store, state.diffSource]);
  useEffect(() => {
    store.dispatch({ type: 'hydrate', comments: initialComments });
  }, [initialComments, store]);

  const diffFiles = useMemo(
    () =>
      config.showUntracked
        ? state.allDiffFiles
        : state.allDiffFiles.filter(file => !file.isUntracked),
    [state.allDiffFiles, config.showUntracked]
  );
  const commands = useMemo<ReviewCommands>(() => {
    const owner = state.sessionId;
    const snapshot = state.snapshotId;
    const current = () =>
      store.getSnapshot().sessionId === owner && store.getSnapshot().snapshotId === snapshot;
    return {
      addComment: review.addComment,
      editComment: review.updateComment,
      deleteComment: review.deleteComment,
      addReply: review.addReply,
      updateReply: review.updateReply,
      deleteReply: review.deleteReply,
      toggleViewed: review.toggleViewed,
      isCurrentSession: current,
      updateFileHunks: (filePath, hunks) => {
        if (current()) store.dispatch({ type: 'hunks', filePath, hunks });
      },
      setApplyDestination: destination => {
        if (current()) store.dispatch({ type: 'destination', destination });
      },
      expandFileContext: async (filePath, contextLines) => {
        if (!adapter?.expandContext || !current()) return null;
        try {
          const result = await adapter.expandContext({ filePath, contextLines });
          return current() && result
            ? { hunks: result.hunks, totalLines: result.totalLines }
            : null;
        } catch (error) {
          console.error('[ReviewContext] Failed to expand context:', error);
          return null;
        }
      },
    };
  }, [
    store,
    adapter,
    state.sessionId,
    state.snapshotId,
    review.addComment,
    review.updateComment,
    review.deleteComment,
    review.addReply,
    review.updateReply,
    review.deleteReply,
    review.toggleViewed,
  ]);
  const value: ReviewContextValue = {
    ...commands,
    files: state.files,
    diffFiles,
    diffSource: state.diffSource,
    setDiffFiles: files => store.dispatch({ type: 'diff-files', files }),
    getCommentsForFile: review.getCommentsForFile,
    getCommentsForLine: review.getCommentsForLine,
    remoteDrift: state.resumedReview?.remoteDrift ?? null,
    importDiagnostics: state.resumedReview?.importDiagnostics ?? [],
    remote: state.remote,
    diagnostics: state.diagnostics,
    isLargePayload: state.isLargePayload,
    applyDestination: state.applyDestination,
    reviewedPaths: state.reviewedPaths,
    sessionId: state.sessionId,
    snapshotId: state.snapshotId,
    loadError: state.loadError,
    resumeError: state.resumeError,
    retryLoad,
    retryResume,
  };
  return (
    <SessionStoreContext.Provider value={store}>
      <CommandsContext.Provider value={commands}>
        <ReviewContext.Provider value={value}>
          {state.loadError && (
            <div role='alert' className='m-3 rounded border border-destructive p-3 text-sm'>
              <p>The review could not be loaded. {state.loadError}</p>
              <Button onClick={() => void retryLoad()}>Retry loading review</Button>
            </div>
          )}
          {state.resumeError && (
            <div role='alert' className='m-3 rounded border border-destructive p-3 text-sm'>
              <p>Saved feedback could not be loaded. {state.resumeError}</p>
              <Button onClick={() => void retryResume()}>Retry loading saved feedback</Button>
            </div>
          )}
          {children}
        </ReviewContext.Provider>
      </CommandsContext.Provider>
    </SessionStoreContext.Provider>
  );
}

export function useOptionalSnapshotKey() {
  const store = useContext(SessionStoreContext);
  const read = () =>
    store ? `${store.getSnapshot().sessionId}:${store.getSnapshot().snapshotId}` : '';
  return useSyncExternalStore(store?.subscribe ?? (() => () => {}), read, read);
}
