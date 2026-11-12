import type { DiffFile, FileReviewState } from '@self-review/types';
import type { ReviewSessionState } from './review-session-transitions';

function pathOf(file: DiffFile): string {
  return file.newPath || file.oldPath;
}

export interface FileReviewSummary {
  readonly viewed: boolean;
  readonly commentCount: number;
}
export interface FileProgressSummary extends FileReviewSummary {
  readonly path: string;
}

/** Cached projections; canonical arrays remain owned by the session store. */
export function createReviewSessionIndexes(read: () => ReviewSessionState) {
  let indexedFiles: FileReviewState[] | undefined;
  let filesByPath = new Map<string, FileReviewState>();
  let summaries: ReadonlyMap<string, FileReviewSummary> = new Map();
  let progress: readonly FileProgressSummary[] = [];
  let indexedDiff: DiffFile[] | undefined;
  let diffByPath = new Map<string, DiffFile>();
  const indexFiles = () => {
    if (indexedFiles === read().files) return;
    indexedFiles = read().files;
    filesByPath = new Map();
    const nextProgress: FileProgressSummary[] = [];
    let progressChanged = progress.length !== read().files.length;
    // A rename and deletion can display the same path; ordered lookups select the first.
    for (const [index, file] of read().files.entries()) {
      if (!filesByPath.has(file.path)) filesByPath.set(file.path, file);
      const before = progress[index];
      const summary =
        before?.path === file.path &&
        before.viewed === file.viewed &&
        before.commentCount === file.comments.length
          ? before
          : { path: file.path, viewed: file.viewed, commentCount: file.comments.length };
      nextProgress.push(summary);
      if (before !== summary) progressChanged = true;
    }
    if (progressChanged) progress = nextProgress;
    const next = new Map<string, FileReviewSummary>();
    let changed = summaries.size !== filesByPath.size;
    const previousPaths = summaries.keys();
    for (const file of filesByPath.values()) {
      const before = summaries.get(file.path);
      const summary =
        before?.viewed === file.viewed && before.commentCount === file.comments.length
          ? before
          : { viewed: file.viewed, commentCount: file.comments.length };
      next.set(file.path, summary);
      if (before !== summary || previousPaths.next().value !== file.path) changed = true;
    }
    if (changed) summaries = next;
  };
  return {
    getFile: (path: string) => {
      indexFiles();
      return filesByPath.get(path);
    },
    getNavigation: () => {
      indexFiles();
      return summaries;
    },
    getProgress: () => {
      indexFiles();
      return progress;
    },
    getDiffFile: (path: string) => {
      if (indexedDiff !== read().allDiffFiles) {
        indexedDiff = read().allDiffFiles;
        diffByPath = new Map();
        for (const file of read().allDiffFiles) {
          const path = pathOf(file);
          if (!diffByPath.has(path)) diffByPath.set(path, file);
        }
      }
      return diffByPath.get(path);
    },
  };
}
