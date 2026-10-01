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
  /**
   * Remote head drift from the resumed document, when the session is a
   * resumed remote review. `null` for local reviews and drift-free resumes.
   */
  remoteDrift: RemoteDriftInfo | null;
  /**
   * Provenance of the remote PR/MR under review, or `null` for a local one.
   * Carries `temporaryClone`, which decides whether an apply has anywhere
   * to write (PRD Section 5.4.8).
   */
  remote: RemoteSessionInfo | null;
  /**
   * What the host could not load faithfully, from `DiffLoadPayload.diagnostics`:
   * an unsupported `git diff` output format, or output the parser could not
   * represent. Empty for a clean load. Shown instead of "no changes" when
   * there are no files, and as a banner above the files otherwise.
   */
  diagnostics: string[];
  /**
   * Destination directory the reviewer named for this session's applies, as
   * the host reported it, or `null` while none has been named. Only a
   * temporary-clone review ever needs one.
   */
  applyDestination: string | null;
  /** Record the destination the host accepted. */
  setApplyDestination: (destinationRoot: string) => void;
  /**
   * Identifies the session the rest of this value describes. It changes
   * whenever the provider starts a new session (a new adapter, a pushed
   * payload for a different source, a different static source) and stays
   * put across same-session updates. Asynchronous work started for one
   * session can compare it on completion to discard a stale result.
   */
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

/**
 * The review session when there is one, `null` otherwise.
 *
 * For a component that renders both inside a review and on its own, and
 * only reads session facts to decide how much of itself to show.
 */
export function useOptionalReview() {
  return useContext(ReviewContext);
}

// ===== Session identity =====

/**
 * The identity of the review a payload describes, as a comparable string.
 *
 * Two payloads with the same identity are the same session: the second one
 * updates the first and keeps the reviewer's comments and viewed flags. Any
 * difference starts a new session. The identity is the source kind plus
 * everything that names what is being reviewed:
 *
 * - `git`: the repository and the diff arguments
 * - `directory` / `file`: the source path
 * - `welcome` / `loading`: the kind alone (placeholders, never a review)
 * - plus `remote.remoteUrl` when the payload carries remote provenance, so
 *   two PRs materialized into the same clone stay distinct. The head SHA is
 *   deliberately left out: the same PR at a newer head is the same review.
 *
 * The adapter is the other half of a session's identity. It is not part of
 * this string because it is compared by object identity; see
 * {@link ReviewProvider}.
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

/** Sources that stand in for a session rather than describing one. */
function isPlaceholderSource(source: DiffSource): boolean {
  return source.type === 'loading' || source.type === 'welcome';
}

const LOADING_SOURCE: DiffSource = { type: 'loading' };
const DEFAULT_STATIC_SOURCE: DiffSource = { type: 'directory', sourcePath: '' };

const adapterIds = new WeakMap<object, number>();
let nextAdapterId = 1;

/** A stable number per adapter object, so object identity can key a session. */
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

// ===== Session state helpers =====

function pathOf(file: DiffFile): string {
  return file.newPath || file.oldPath;
}

/**
 * One review state per diff entry, carrying over the existing state for any
 * path `prev` already holds. Returns `prev` itself when nothing changed, so a
 * no-op reconciliation does not re-render the tree.
 */
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

/**
 * `diffFiles` plus an empty-hunk entry for each of `paths` it lacks. The file
 * tree and the diff viewer render from the diff entries, and file state
 * without one is dropped on the next reconciliation, so a comment on a path
 * the diff does not contain — the review-level sentinel `''`, an outdated
 * anchor, a file that left the diff — needs a synthetic entry to survive.
 */
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

/**
 * Merge comments and viewed flags into existing review state. Comments are
 * appended after any the file already holds (an id already present is not
 * added twice), and paths the state lacks get their own entries.
 */
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
  /**
   * Static diff data, used instead of `adapter.loadDiff()`. While this prop
   * is set the provider neither loads nor subscribes to pushes. A new array
   * for the same `initialSource` is a same-session update: comments and
   * viewed flags carry over for every path still present.
   */
  initialFiles?: DiffFile[];
  /**
   * Source metadata for `initialFiles` (defaults to an unnamed directory).
   * Part of the session identity: a value naming a different source starts
   * a new session. Compared by value, so an inline object literal is fine.
   */
  initialSource?: DiffSource;
  /**
   * Comments to seed the session with. Applied exactly once per session
   * this provider starts from its own inputs (mount, a new adapter, a
   * different `initialSource`), as soon as the session's files are known:
   * the first non-empty value present once the diff has loaded is merged
   * in, and every later value — a new array identity, equal content or not —
   * is ignored, so it can never overwrite the reviewer's edits. Comments on
   * paths the diff does not contain are kept on synthetic entries. A
   * session the host pushes later through `adapter.onDiffLoad` is a
   * different review and starts without them; the welcome placeholder is
   * not a session, so a push that replaces it still receives them.
   */
  initialComments?: ReviewComment[];
}

/**
 * Holds the review session: the diff, its source, and the reviewer's
 * comments and viewed flags, which is exactly what `useReviewBridge`
 * exports.
 *
 * **Session identity** is the adapter object (from `ReviewAdapterProvider`)
 * plus {@link reviewSessionIdentity} of the payload: source kind, repository
 * and diff arguments or source path, and remote URL.
 *
 * - **Initialization.** On mount the provider loads `adapter.loadDiff()` (and
 *   `loadResumedReview()`) and subscribes to `adapter.onDiffLoad`, unless
 *   `initialFiles` is set.
 * - **Replacement.** A different adapter object, a different
 *   `initialSource`, or switching between static and adapter-loaded files
 *   starts a new session: state is discarded, the new adapter is loaded and
 *   subscribed, the old subscription is released and the old adapter's late
 *   results are ignored. Keep the adapter identity stable (module scope or
 *   `useMemo`) unless a new session is intended. A pushed payload whose
 *   identity differs from the current session also replaces it in place:
 *   no comment, viewed flag, resumed review, remote provenance or apply
 *   destination from the old session survives, including when the new
 *   session has no files at all.
 * - **Update.** A pushed payload (or a new `initialFiles` array) with the
 *   same identity updates the current session: its file list is adopted,
 *   comments and viewed flags carry over by path, and a commented path the
 *   update no longer lists is kept on a synthetic entry rather than
 *   dropping the reviewer's work.
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

/**
 * One provider-started session. `ReviewProvider` keys it on the inputs that
 * define a session, so React discards all of this state — and runs the
 * effect cleanups that cancel the old adapter's work — on replacement.
 */
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
  const [applyDestination, setApplyDestination] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState(() => nextSessionId++);
  const sessionIdRef = useRef(sessionId);
  // Identity of the session currently held, or null before any payload.
  const identityRef = useRef<string | null>(
    initialFiles ? reviewSessionIdentity(startingSource) : null
  );
  // Whether the session held is a placeholder (loading, welcome) rather
  // than a review.
  const placeholderRef = useRef(isPlaceholderSource(startingSource));
  // The session an outstanding loadResumedReview() answer belongs to.
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

  // Read by payload callbacks, which run outside render.
  const filesRef = useRef(reviewState.files);
  useLayoutEffect(() => {
    filesRef.current = reviewState.files;
  }, [reviewState.files]);

  /**
   * Accept a diff payload from any channel: the initial load, a push, or a
   * new `initialFiles` array. Same identity updates the session; a
   * different one replaces it.
   */
  const receivePayload = (payload: DiffLoadPayload) => {
    const identity = reviewSessionIdentity(payload.source, payload.remote);
    if (identity === identityRef.current) {
      const commentedPaths = filesRef.current.filter(f => f.comments.length > 0).map(f => f.path);
      setAllDiffFiles(withSyntheticEntries(payload.files, commentedPaths));
      setDiffSource(payload.source);
      setRemote(payload.remote ?? null);
      setDiagnostics(payload.diagnostics ?? []);
      return;
    }

    identityRef.current = identity;
    const nextId = nextSessionId++;
    // A placeholder is not a review, so a resume requested while one was
    // showing belongs to the review that replaces it: Electron answers the
    // welcome screen's pending request with a remote PR/MR's fetched
    // threads right after pushing its diff.
    if (placeholderRef.current && resumeOwnerRef.current === sessionIdRef.current) {
      resumeOwnerRef.current = nextId;
    }
    placeholderRef.current = isPlaceholderSource(payload.source);
    sessionIdRef.current = nextId;
    setSessionId(nextId);
    resumeAppliedRef.current = false;
    setResumedReview(null);
    setAllDiffFiles(payload.files);
    setDiffSource(payload.source);
    setRemote(payload.remote ?? null);
    setDiagnostics(payload.diagnostics ?? []);
    // A destination named for the previous session says nothing about
    // this review's files.
    setApplyDestination(null);
    setFiles(seedFileStates(payload.files, []));
  };

  /** Merge comments and viewed paths into the session, keeping off-diff paths. */
  const mergeIntoSession = (comments: ReviewComment[], viewedPaths: ReadonlySet<string>) => {
    const commentsByFile = groupCommentsByFile(comments);
    setFiles(prev => mergeIntoFileStates(prev, commentsByFile, viewedPaths));
    setAllDiffFiles(prev => withSyntheticEntries(prev, commentsByFile.keys()));
  };

  // Keep one review state per diff entry, including when the diff is empty.
  useEffect(() => {
    setFiles(prev => seedFileStates(allDiffFiles, prev));
  }, [allDiffFiles]);

  // Merge the resumed review after loading, even when the current diff is empty.
  //
  // The seeding effect above is declared first, so when both run in the same
  // commit its updater is queued first and this one sees the seeded files.
  // Applying only once keeps later allDiffFiles updates (lazy hunk loads,
  // expanded context) from resurrecting comments the user has since deleted.
  useEffect(() => {
    if (!resumedReview || resumeAppliedRef.current) return;
    resumeAppliedRef.current = true;
    mergeIntoSession(resumedReview.comments, new Set(resumedReview.viewedFiles ?? []));
  }, [resumedReview]);

  // Hydrate initialComments once, after the session's files are known.
  // Declared after the seeding effect for the same ordering reason as above.
  useEffect(() => {
    if (hydratedRef.current || !initialComments || initialComments.length === 0) return;
    if (isPlaceholderSource(diffSource)) return;
    hydratedRef.current = true;
    mergeIntoSession(initialComments, new Set());
  }, [initialComments, diffSource]);

  // A new initialFiles array is a same-session update (a different source
  // remounts this provider through ReviewProvider's key).
  useEffect(() => {
    if (!initialFiles || initialFiles === staticFilesRef.current) return;
    staticFilesRef.current = initialFiles;
    receivePayload({ files: initialFiles, source: startingSource });
  }, [initialFiles]);

  // Initial load. The adapter is fixed for this keyed session; cleanup on
  // replacement or unmount discards whatever is still in flight.
  useEffect(() => {
    if (initialFiles || !adapter) return;

    let cancelled = false;

    (async () => {
      try {
        const payload: DiffLoadPayload = await adapter.loadDiff();
        if (cancelled) return;
        // A push that already established a different session is newer
        // than this response.
        const identity = reviewSessionIdentity(payload.source, payload.remote);
        if (identityRef.current !== null && identityRef.current !== identity) return;
        receivePayload(payload);

        // Applying the resumed review is deferred to the effect above: the
        // per-file state it merges into does not exist until the seeding
        // effect has run. It belongs to the session it was loaded for (or,
        // from a placeholder, to the review that replaced it).
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

  // Later pushed payloads — the host may start a review after the initial
  // load resolved (e.g. a remote PR/MR URL submitted on the welcome screen),
  // or re-deliver the current one. receivePayload decides update versus
  // replacement.
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

  // Bound to the session this render belongs to: hunks requested for a
  // session that has since been replaced must not land on a same-named
  // file of the new one.
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
        remote,
        diagnostics,
        applyDestination,
        setApplyDestination,
        sessionId,
      }}
    >
      {children}
    </ReviewContext.Provider>
  );
}
