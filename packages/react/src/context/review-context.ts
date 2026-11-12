import { createContext, type ReactNode } from 'react';
import type {
  DiffFile,
  DiffSource,
  FileReviewState,
  ReviewComment,
  RemoteDriftInfo,
  RemoteSessionInfo,
} from '@self-review/types';
import type { ReviewCommands } from './review-commands';
import type { ReviewSessionStore } from './review-session';

export interface ReviewContextValue extends ReviewCommands {
  files: FileReviewState[];
  diffFiles: DiffFile[];
  diffSource: DiffSource;
  setDiffFiles: (files: DiffFile[]) => void;
  getCommentsForFile: (filePath: string) => ReviewComment[];
  getCommentsForLine: (
    filePath: string,
    lineNumber: number,
    side: 'old' | 'new'
  ) => ReviewComment[];
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
  /** Payload paths only, never synthetic entries, so Apply is not offered on placeholders. */
  reviewedPaths: ReadonlySet<string>;
  /** Changes when a new session starts; async work compares it to drop stale results. */
  sessionId: number;
  /** Changes on external snapshot replacement, but not on local context expansion. */
  snapshotId?: number;
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
  /** Recovery controls inside the session. Omit to retain load and draft recovery. */
  recovery?: ReactNode;
  /** Initial in-memory preference for f/g/j/k and hint letters. Defaults to enabled. */
  initialCharacterShortcuts?: boolean;
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
