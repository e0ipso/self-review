import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
  ReactNode,
} from 'react';
import type {
  Attachment,
  DiffFile,
  DiffHunk,
  DiffLoadPayload,
  DiffSource,
  FileReviewState,
  Reply,
  ReviewComment,
  ResumeLoadPayload,
  RemoteDriftInfo,
  RemoteSessionInfo,
  LineRange,
  Suggestion,
} from '@self-review/types';
import { useReviewState } from '../hooks/useReviewState';
import { useConfig } from './ConfigContext';
import { useAdapter } from './ReviewAdapterContext';
import type { ReviewAdapter } from '../adapter';

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
}

const ReviewContext = createContext<ReviewContextValue | null>(null);

function groupCommentsByFile(comments: ReviewComment[]): Map<string, ReviewComment[]> {
  const byFile = new Map<string, ReviewComment[]>();
  comments.forEach(comment => {
    if (!byFile.has(comment.filePath)) {
      byFile.set(comment.filePath, []);
    }
    byFile.get(comment.filePath)!.push(comment);
  });
  return byFile;
}

export function useReview() {
  const context = useContext(ReviewContext);
  if (!context) {
    throw new Error('useReview must be used within ReviewProvider');
  }
  return context;
}

/** The review session when there is one, `null` otherwise. */
export function useOptionalReview() {
  return useContext(ReviewContext);
}

/**
 * Comparable identity of the review a payload describes: same identity updates the session,
 * a different one starts a new one. The remote head SHA is left out on purpose, so the same
 * PR at a newer head is the same review. The adapter is the other half (see {@link ReviewProvider}).
 */
export function reviewSessionIdentity(
  source: DiffSource,
  remote?: RemoteSessionInfo | null
): string {
  let parts: string[];
  switch (source.type) {
    case 'git':
      parts = ['git', source.repository, source.gitDiffArgs];
      break;
    case 'directory':
    case 'file':
      parts = [source.type, source.sourcePath];
      break;
    default:
      parts = [source.type];
  }
  if (remote) parts.push('remote', remote.remoteUrl);
  return JSON.stringify(parts);
}

function isPlaceholderSource(source: DiffSource): boolean {
  return source.type === 'loading' || source.type === 'welcome';
}

const LOADING_SOURCE: DiffSource = { type: 'loading' };
const DEFAULT_STATIC_SOURCE: DiffSource = { type: 'directory', sourcePath: '' };

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

let nextSessionId = 1;

function pathOf(file: DiffFile): string {
  return file.newPath || file.oldPath;
}

/** Returns `prev` itself when nothing changed, so a no-op reconciliation does not re-render. */
function seedFileStates(diffFiles: DiffFile[], prev: FileReviewState[]): FileReviewState[] {
  const prevByPath = new Map(prev.map(f => [f.path, f]));
  const next = diffFiles.map((file): FileReviewState => {
    const path = pathOf(file);
    const existing = prevByPath.get(path);
    if (existing) {
      return existing.changeType === file.changeType
        ? existing
        : { ...existing, changeType: file.changeType };
    }
    return { path, changeType: file.changeType, viewed: false, comments: [] };
  });
  const unchanged = next.length === prev.length && next.every((f, i) => f === prev[i]);
  return unchanged ? prev : next;
}

/** State without a diff entry is dropped on reconcile, so off-diff comments need a synthetic one. */
function withSyntheticEntries(diffFiles: DiffFile[], paths: Iterable<string>): DiffFile[] {
  const known = new Set(diffFiles.map(pathOf));
  const extras: DiffFile[] = [];
  for (const path of paths) {
    if (known.has(path)) continue;
    known.add(path);
    extras.push({
      oldPath: path,
      newPath: path,
      changeType: 'modified',
      isBinary: false,
      hunks: [],
    });
  }
  return extras.length > 0 ? [...diffFiles, ...extras] : diffFiles;
}

/** Appends comments by id (no duplicates) and adds entries for paths the state lacks. */
function mergeIntoFileStates(
  prev: FileReviewState[],
  commentsByFile: Map<string, ReviewComment[]>,
  viewedPaths: ReadonlySet<string>
): FileReviewState[] {
  const known = new Set(prev.map(f => f.path));
  const merged = prev.map(file => {
    const incoming = commentsByFile.get(file.path) ?? [];
    const ids = new Set(file.comments.map(c => c.id));
    const added = incoming.filter(c => !ids.has(c.id));
    const viewed = file.viewed || viewedPaths.has(file.path);
    if (added.length === 0 && viewed === file.viewed) return file;
    return { ...file, viewed, comments: [...file.comments, ...added] };
  });
  const extras: FileReviewState[] = [];
  commentsByFile.forEach((comments, path) => {
    if (!known.has(path)) {
      extras.push({ path, changeType: 'modified', viewed: viewedPaths.has(path), comments });
    }
  });
  return extras.length > 0 ? [...merged, ...extras] : merged;
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

/** Keyed by `ReviewProvider`: replacement unmounts it and cleanups cancel the old adapter's work. */
function ReviewSessionProvider({
  children,
  initialFiles,
  initialSource,
  initialComments,
  adapter,
}: ReviewProviderProps & { adapter: ReviewAdapter | null }) {
  const startingSource = initialSource || (initialFiles ? DEFAULT_STATIC_SOURCE : LOADING_SOURCE);
  const [allDiffFiles, setAllDiffFiles] = useState<DiffFile[]>(initialFiles || []);
  const [diffSource, setDiffSource] = useState<DiffSource>(startingSource);
  const [resumedReview, setResumedReview] = useState<ResumeLoadPayload | null>(null);
  const [remote, setRemote] = useState<RemoteSessionInfo | null>(null);
  const [diagnostics, setDiagnostics] = useState<string[]>([]);
  const [isLargePayload, setIsLargePayload] = useState(false);
  const [applyDestination, setApplyDestination] = useState<string | null>(null);
  const [reviewedPaths, setReviewedPaths] = useState<ReadonlySet<string>>(
    () => new Set((initialFiles ?? []).map(pathOf))
  );
  const [sessionId, setSessionId] = useState(() => nextSessionId++);
  const sessionIdRef = useRef(sessionId);
  const identityRef = useRef<string | null>(
    initialFiles ? reviewSessionIdentity(startingSource) : null
  );
  const placeholderRef = useRef(isPlaceholderSource(startingSource));
  // Session an outstanding loadResumedReview() answer belongs to.
  const resumeOwnerRef = useRef<number | null>(null);
  const resumeAppliedRef = useRef(false);
  const hydratedRef = useRef(false);
  const staticFilesRef = useRef(initialFiles);
  const { config } = useConfig();

  const reviewState = useReviewState();
  const { setFiles } = reviewState;

  // Filter files based on showUntracked toggle
  const diffFiles = useMemo(() => {
    if (config.showUntracked) return allDiffFiles;
    return allDiffFiles.filter(file => !file.isUntracked);
  }, [allDiffFiles, config.showUntracked]);

  // Payload callbacks run outside render and read this.
  const filesRef = useRef(reviewState.files);
  useLayoutEffect(() => {
    filesRef.current = reviewState.files;
  }, [reviewState.files]);

  /** Same identity updates the session; a different one replaces it. */
  const receivePayload = (payload: DiffLoadPayload) => {
    const identity = reviewSessionIdentity(payload.source, payload.remote);
    if (identity === identityRef.current) {
      const commentedPaths = filesRef.current.filter(f => f.comments.length > 0).map(f => f.path);
      setAllDiffFiles(withSyntheticEntries(payload.files, commentedPaths));
      setReviewedPaths(new Set(payload.files.map(pathOf)));
      setDiffSource(payload.source);
      setRemote(payload.remote ?? null);
      setDiagnostics(payload.diagnostics ?? []);
      setIsLargePayload(payload.isLargePayload === true);
      return;
    }

    identityRef.current = identity;
    const nextId = nextSessionId++;
    // A resume requested while a placeholder showed belongs to the review replacing it
    // (Electron answers the welcome screen's pending request right after pushing the diff).
    if (placeholderRef.current && resumeOwnerRef.current === sessionIdRef.current) {
      resumeOwnerRef.current = nextId;
    }
    placeholderRef.current = isPlaceholderSource(payload.source);
    sessionIdRef.current = nextId;
    setSessionId(nextId);
    resumeAppliedRef.current = false;
    setResumedReview(null);
    setAllDiffFiles(payload.files);
    setReviewedPaths(new Set(payload.files.map(pathOf)));
    setDiffSource(payload.source);
    setRemote(payload.remote ?? null);
    setDiagnostics(payload.diagnostics ?? []);
    setIsLargePayload(payload.isLargePayload === true);
    setApplyDestination(null);
    setFiles(seedFileStates(payload.files, []));
  };

  /** Merge comments and viewed paths into the session, keeping off-diff paths. */
  const mergeIntoSession = (comments: ReviewComment[], viewedPaths: ReadonlySet<string>) => {
    const commentsByFile = groupCommentsByFile(comments);
    setFiles(prev => mergeIntoFileStates(prev, commentsByFile, viewedPaths));
    setAllDiffFiles(prev => withSyntheticEntries(prev, commentsByFile.keys()));
  };

  useEffect(() => {
    setFiles(prev => seedFileStates(allDiffFiles, prev));
  }, [allDiffFiles]);

  // Declared after the seeding effect so its updater is queued first and this one sees the seeded
  // files. Applying once keeps later allDiffFiles updates from resurrecting deleted comments.
  useEffect(() => {
    if (!resumedReview || resumeAppliedRef.current) return;
    resumeAppliedRef.current = true;
    mergeIntoSession(resumedReview.comments, new Set(resumedReview.viewedFiles ?? []));
  }, [resumedReview]);

  // Declared after the seeding effect for the same ordering reason.
  useEffect(() => {
    if (hydratedRef.current || !initialComments || initialComments.length === 0) return;
    if (isPlaceholderSource(diffSource)) return;
    hydratedRef.current = true;
    mergeIntoSession(initialComments, new Set());
  }, [initialComments, diffSource]);

  useEffect(() => {
    if (!initialFiles || initialFiles === staticFilesRef.current) return;
    staticFilesRef.current = initialFiles;
    receivePayload({ files: initialFiles, source: startingSource });
  }, [initialFiles]);

  useEffect(() => {
    if (initialFiles || !adapter) return;

    let cancelled = false;

    (async () => {
      try {
        const payload: DiffLoadPayload = await adapter.loadDiff();
        if (cancelled) return;
        // A push that already established a different session is newer than this response.
        const identity = reviewSessionIdentity(payload.source, payload.remote);
        if (identityRef.current !== null && identityRef.current !== identity) return;
        receivePayload(payload);

        // Applying is deferred to the effect above: per-file state does not exist until seeding runs.
        if (adapter.loadResumedReview) {
          resumeOwnerRef.current = sessionIdRef.current;
          const resumed = await adapter.loadResumedReview();
          if (cancelled || resumeOwnerRef.current !== sessionIdRef.current) return;
          resumeOwnerRef.current = null;
          setResumedReview(resumed);
        }
      } catch (error) {
        console.error('[ReviewContext] Failed to load diff:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // The host may start a review after the initial load (e.g. a PR URL from the welcome screen).
  useEffect(() => {
    if (initialFiles || !adapter?.onDiffLoad) return;
    return adapter.onDiffLoad(payload => receivePayload(payload));
  }, []);

  const expandFileContext = async (
    filePath: string,
    contextLines: number
  ): Promise<{ hunks: DiffHunk[]; totalLines: number } | null> => {
    if (!adapter?.expandContext) return null;
    try {
      const response = await adapter.expandContext({ filePath, contextLines });
      if (!response) return null;
      return { hunks: response.hunks, totalLines: response.totalLines };
    } catch (error) {
      console.error('[ReviewContext] Failed to expand context:', error);
      return null;
    }
  };

  // Hunks requested for a replaced session must not land on a same-named file of the new one.
  const renderedSessionId = sessionId;
  const updateFileHunks = (filePath: string, hunks: DiffHunk[]) => {
    if (renderedSessionId !== sessionIdRef.current) return;
    setAllDiffFiles(prev =>
      prev.map(f => (pathOf(f) === filePath ? { ...f, hunks, contentLoaded: true } : f))
    );
  };

  return (
    <ReviewContext.Provider
      value={{
        files: reviewState.files,
        diffFiles,
        diffSource,
        setDiffFiles: setAllDiffFiles,
        addComment: reviewState.addComment,
        editComment: reviewState.updateComment,
        deleteComment: reviewState.deleteComment,
        addReply: reviewState.addReply,
        updateReply: reviewState.updateReply,
        deleteReply: reviewState.deleteReply,
        toggleViewed: reviewState.toggleViewed,
        getCommentsForFile: reviewState.getCommentsForFile,
        getCommentsForLine: reviewState.getCommentsForLine,
        expandFileContext,
        updateFileHunks,
        remoteDrift: resumedReview?.remoteDrift ?? null,
        importDiagnostics: resumedReview?.importDiagnostics ?? [],
        remote,
        diagnostics,
        isLargePayload,
        applyDestination,
        setApplyDestination,
        reviewedPaths,
        sessionId,
      }}
    >
      {children}
    </ReviewContext.Provider>
  );
}
