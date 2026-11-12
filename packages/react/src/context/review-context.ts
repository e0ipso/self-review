import { createContext, type ReactNode } from 'react';
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
import type { ReviewCommands } from './review-commands';
import type { ReviewSessionStore } from './review-session';

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

export const ReviewContext = createContext<ReviewContextValue | null>(null);
export const SessionStoreContext = createContext<ReviewSessionStore | null>(null);
export const CommandsContext = createContext<ReviewCommands | null>(null);

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
