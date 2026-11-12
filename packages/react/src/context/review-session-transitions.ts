import type {
  DiffFile,
  DiffHunk,
  DiffLoadPayload,
  DiffSource,
  FileReviewState,
  RemoteSessionInfo,
  ResumeLoadPayload,
  ReviewComment,
} from '@self-review/types';
import type { SetStateAction } from 'react';
import { reconcileRemoteFeedback } from './reconcile-remote-feedback';

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

/**
 * Comparable identity of the review a payload describes: same identity updates the session,
 * a different one starts a new one. The remote head SHA is left out on purpose, so the same
 * PR at a newer head is the same review. Its forge, URL and source kind identify it; clone paths
 * and SHA-based diff arguments identify its snapshot. Local git arguments remain identity-bearing.
 * The adapter is the other half (see {@link ReviewProvider}).
 */
export function reviewSessionIdentity(
  source: DiffSource,
  remote?: RemoteSessionInfo | null
): string {
  let parts: string[];
  switch (source.type) {
    case 'git':
      parts = remote ? ['git'] : ['git', source.repository, source.gitDiffArgs];
      break;
    case 'directory':
    case 'file':
      parts = [source.type, source.sourcePath];
      break;
    default:
      parts = [source.type];
  }
  if (remote) parts.push('remote', remote.remoteForge, remote.remoteUrl);
  return JSON.stringify(parts);
}

/** Local updates retain their existing semantics. Remote pulls must match the exact snapshot. */
export function sameRemoteSnapshot(
  previous: { remote?: RemoteSessionInfo | null; diffSource?: DiffSource; source?: DiffSource },
  next: Pick<DiffLoadPayload, 'source' | 'remote'>
): boolean {
  if (!previous.remote && !next.remote) return true;
  const source = previous.diffSource ?? previous.source;
  const sameSource =
    source?.type === 'git' &&
    next.source.type === 'git' &&
    source.repository === next.source.repository &&
    source.gitDiffArgs === next.source.gitDiffArgs;
  return (
    previous.remote?.remoteHeadSha === next.remote?.remoteHeadSha &&
    previous.remote?.remoteBaseSha === next.remote?.remoteBaseSha &&
    sameSource
  );
}

function isPlaceholderSource(source: DiffSource): boolean {
  return source.type === 'loading' || source.type === 'welcome';
}

export const LOADING_SOURCE: DiffSource = { type: 'loading' };
export const DEFAULT_STATIC_SOURCE: DiffSource = { type: 'directory', sourcePath: '' };

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
  viewedPaths: ReadonlySet<string>,
  viewedEdits: ReadonlySet<string>
): FileReviewState[] {
  const known = new Set(prev.map(f => f.path));
  const merged = prev.map(file => {
    const incoming = commentsByFile.get(file.path) ?? [];
    const ids = new Set(file.comments.map(c => c.id));
    const added = incoming.filter(c => !ids.has(c.id));
    const viewed = viewedEdits.has(file.path)
      ? file.viewed
      : file.viewed || viewedPaths.has(file.path);
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

export interface ReviewSessionState {
  sessionId: number;
  snapshotId: number;
  identity: string | null;
  diffSource: DiffSource;
  allDiffFiles: DiffFile[];
  files: FileReviewState[];
  reviewedPaths: ReadonlySet<string>;
  remote: RemoteSessionInfo | null;
  diagnostics: string[];
  isLargePayload: boolean;
  applyDestination: string | null;
  resumedReview: ResumeLoadPayload | null;
  hydrated: boolean;
  acceptsInitialComments: boolean;
  loadError: string | null;
  resumeError: string | null;
  resumePending: boolean;
  deletedCommentIds: ReadonlySet<string>;
  viewedEdits: ReadonlySet<string>;
  anchorDiagnostics: string[];
}
export function createReviewSessionState(
  sessionId: number,
  files?: DiffFile[],
  source?: DiffSource,
  resumePending = false
): ReviewSessionState {
  const diffSource = source ?? (files ? DEFAULT_STATIC_SOURCE : LOADING_SOURCE);
  return {
    sessionId,
    snapshotId: 0,
    identity: files ? reviewSessionIdentity(diffSource) : null,
    diffSource,
    allDiffFiles: files ?? [],
    files: seedFileStates(files ?? [], []),
    reviewedPaths: new Set((files ?? []).map(pathOf)),
    remote: null,
    diagnostics: [],
    isLargePayload: false,
    applyDestination: null,
    resumedReview: null,
    hydrated: false,
    acceptsInitialComments: true,
    loadError: null,
    resumeError: null,
    resumePending,
    deletedCommentIds: new Set(),
    viewedEdits: new Set(),
    anchorDiagnostics: [],
  };
}
export type SessionAction =
  | {
      type: 'payload';
      payload: DiffLoadPayload;
      initialComments?: ReviewComment[];
      resumePending?: boolean;
    }
  | { type: 'hydrate'; comments?: ReviewComment[] }
  | { type: 'resume'; resumed: ResumeLoadPayload | null }
  | { type: 'resume-start' }
  | { type: 'files'; update: SetStateAction<FileReviewState[]> }
  | { type: 'diff-files'; files: DiffFile[] }
  | { type: 'hunks'; filePath: string; hunks: DiffHunk[] }
  | { type: 'destination'; destination: string }
  | { type: 'load-error' | 'resume-error'; message: string | null };

function mergeComments(
  state: ReviewSessionState,
  comments: ReviewComment[],
  viewed: ReadonlySet<string>
): ReviewSessionState {
  const byFile = groupCommentsByFile(
    comments.filter(comment => !state.deletedCommentIds.has(comment.id))
  );
  return {
    ...state,
    files: mergeIntoFileStates(state.files, byFile, viewed, state.viewedEdits),
    allDiffFiles: withSyntheticEntries(state.allDiffFiles, byFile.keys()),
  };
}
function hydrate(state: ReviewSessionState, comments?: ReviewComment[]): ReviewSessionState {
  if (
    state.hydrated ||
    !state.acceptsInitialComments ||
    isPlaceholderSource(state.diffSource) ||
    !comments?.length
  )
    return state;
  return { ...mergeComments(state, comments, new Set()), hydrated: true };
}
/** All file reconciliation and hydration happen in the same transition as their owning snapshot. */
export function transitionReviewSession(
  state: ReviewSessionState,
  action: SessionAction,
  replacementSessionId: number
): ReviewSessionState {
  switch (action.type) {
    case 'payload': {
      const { payload } = action;
      const identity = reviewSessionIdentity(payload.source, payload.remote);
      const same = identity === state.identity;
      const allDiffFiles = same
        ? withSyntheticEntries(
            payload.files,
            state.files.filter(f => f.comments.length > 0).map(f => f.path)
          )
        : payload.files;
      const next = same
        ? state
        : {
            ...createReviewSessionState(replacementSessionId),
            acceptsInitialComments:
              state.acceptsInitialComments && isPlaceholderSource(state.diffSource),
            hydrated: state.hydrated,
          };
      const remoteChanged = same && !!state.remote && !sameRemoteSnapshot(state, payload);
      const reconciliation = remoteChanged
        ? reconcileRemoteFeedback(state.files, state.allDiffFiles, payload.files)
        : { files: state.files, diagnostics: [] };
      return hydrate(
        {
          ...next,
          identity,
          snapshotId: state.snapshotId + 1,
          diffSource: payload.source,
          allDiffFiles,
          files: seedFileStates(allDiffFiles, same ? reconciliation.files : []),
          anchorDiagnostics: [...next.anchorDiagnostics, ...reconciliation.diagnostics],
          reviewedPaths: new Set(payload.files.map(pathOf)),
          remote: payload.remote ?? null,
          diagnostics: payload.diagnostics ?? [],
          isLargePayload: payload.isLargePayload === true,
          loadError: null,
          resumePending:
            same && !remoteChanged ? state.resumePending : (action.resumePending ?? false),
          resumeError: remoteChanged ? null : next.resumeError,
        },
        action.initialComments
      );
    }
    case 'hydrate':
      return hydrate(state, action.comments);
    case 'resume-start':
      return { ...state, resumePending: true, resumeError: null };
    case 'resume':
      return {
        ...(action.resumed
          ? mergeComments(state, action.resumed.comments, new Set(action.resumed.viewedFiles ?? []))
          : state),
        resumedReview: action.resumed,
        resumePending: false,
        resumeError: null,
      };
    case 'files': {
      const files =
        typeof action.update === 'function' ? action.update(state.files) : action.update;
      const previous = new Map(state.files.map(file => [file.path, file]));
      let deletedCommentIds = state.deletedCommentIds;
      let viewedEdits = state.viewedEdits;
      for (const file of files) {
        const before = previous.get(file.path);
        if (!before || before === file) continue;
        if (before.viewed !== file.viewed) viewedEdits = new Set([...viewedEdits, file.path]);
        if (before.comments === file.comments) continue;
        const ids = new Set(file.comments.map(comment => comment.id));
        const deleted = before.comments.filter(comment => !ids.has(comment.id));
        if (deleted.length)
          deletedCommentIds = new Set([
            ...deletedCommentIds,
            ...deleted.map(comment => comment.id),
          ]);
      }
      // Resume may arrive after local edits. Deletions and explicit unviewing must win too.
      return { ...state, files, deletedCommentIds, viewedEdits };
    }
    case 'diff-files':
      return {
        ...state,
        snapshotId: state.snapshotId + 1,
        allDiffFiles: action.files,
        files: seedFileStates(action.files, state.files),
      };
    case 'hunks':
      return {
        ...state,
        allDiffFiles: state.allDiffFiles.map(f =>
          pathOf(f) === action.filePath ? { ...f, hunks: action.hunks, contentLoaded: true } : f
        ),
      };
    case 'destination':
      return { ...state, applyDestination: action.destination };
    case 'load-error':
      return { ...state, loadError: action.message };
    case 'resume-error':
      return { ...state, resumeError: action.message, resumePending: false };
  }
}

export { isPlaceholderSource };
