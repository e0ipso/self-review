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
  LineRange,
  Suggestion,
} from '@self-review/types';
import { useReviewState } from '../hooks/useReviewState';
import { useConfig } from './ConfigContext';
import { useAdapter } from './ReviewAdapterContext';

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
  addReply: (
    commentId: string,
    body: string,
    author?: string,
    attachments?: Attachment[]
  ) => void;
  updateReply: (
    commentId: string,
    replyId: string,
    updates: Partial<Reply>
  ) => void;
  deleteReply: (commentId: string, replyId: string) => void;
  toggleViewed: (filePath: string) => void;
  getCommentsForFile: (filePath: string) => ReviewComment[];
  getCommentsForLine: (
    filePath: string,
    lineNumber: number,
    side: 'old' | 'new'
  ) => ReviewComment[];
  expandFileContext: (filePath: string, contextLines: number) => Promise<{ hunks: DiffHunk[]; totalLines: number } | null>;
  updateFileHunks: (filePath: string, hunks: DiffHunk[]) => void;
  /**
   * Remote head drift from the resumed document, when the session is a
   * resumed remote review. `null` for local reviews and drift-free resumes.
   */
  remoteDrift: RemoteDriftInfo | null;
}

const ReviewContext = createContext<ReviewContextValue | null>(null);

function groupCommentsByFile(
  comments: ReviewComment[]
): Map<string, ReviewComment[]> {
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

export interface ReviewProviderProps {
  children: ReactNode;
  /** Optional: provide diff data directly instead of using adapter.loadDiff() */
  initialFiles?: DiffFile[];
  /** Optional: provide diff source directly */
  initialSource?: DiffSource;
  /** Optional: provide initial comments */
  initialComments?: ReviewComment[];
}

export function ReviewProvider({
  children,
  initialFiles,
  initialSource,
  initialComments,
}: ReviewProviderProps) {
  const [allDiffFiles, setAllDiffFiles] = useState<DiffFile[]>(initialFiles || []);
  const [diffSource, setDiffSource] = useState<DiffSource>(
    initialSource || (initialFiles ? { type: 'directory', sourcePath: '' } : { type: 'loading' })
  );
  const [resumedReview, setResumedReview] = useState<ResumeLoadPayload | null>(
    null
  );
  const resumeAppliedRef = useRef(false);
  const { config } = useConfig();
  const adapter = useAdapter();

  const reviewState = useReviewState();

  // Filter files based on showUntracked toggle
  const diffFiles = useMemo(() => {
    if (config.showUntracked) return allDiffFiles;
    return allDiffFiles.filter(file => !file.isUntracked);
  }, [allDiffFiles, config.showUntracked]);

  // Create refs for review submission
  const diffSourceRef = useRef(diffSource);
  const filesRef = useRef(reviewState.files);

  useLayoutEffect(() => {
    diffSourceRef.current = diffSource;
  }, [diffSource]);
  useLayoutEffect(() => {
    filesRef.current = reviewState.files;
  }, [reviewState.files]);

  // When allDiffFiles change, initialize FileReviewState for all files
  useEffect(() => {
    if (allDiffFiles.length > 0) {
      reviewState.setFiles(prev => {
        const prevByPath = new Map(prev.map(f => [f.path, f]));
        return allDiffFiles.map(file => {
          const path = file.newPath || file.oldPath;
          const existing = prevByPath.get(path);
          if (existing) {
            return { ...existing, changeType: file.changeType };
          }
          return {
            path,
            changeType: file.changeType,
            viewed: false,
            comments: [] as ReviewComment[],
          };
        });
      });
    }
  }, [allDiffFiles]);

  // Merge the resumed review once the file state it applies to exists.
  //
  // The seeding effect above is declared first, so when both run in the same
  // commit its updater is queued first and this one sees the seeded files.
  // Applying only once keeps later allDiffFiles updates (lazy hunk loads,
  // expanded context) from resurrecting comments the user has since deleted.
  useEffect(() => {
    if (!resumedReview || resumeAppliedRef.current) return;
    if (allDiffFiles.length === 0) return;
    resumeAppliedRef.current = true;

    const commentsByFile = groupCommentsByFile(resumedReview.comments);
    const viewedPaths = new Set(resumedReview.viewedFiles ?? []);

    reviewState.setFiles(prev => {
      const known = new Set(prev.map(f => f.path));
      const merged = prev.map(file => ({
        ...file,
        comments: commentsByFile.get(file.path) || file.comments,
        viewed: viewedPaths.has(file.path) || file.viewed,
      }));
      // Comments whose path is not in the diff — the review-level sentinel
      // ('') and threads with outdated anchors on removed files — must
      // still render and survive save, so they get synthetic entries.
      const extras: FileReviewState[] = [];
      commentsByFile.forEach((comments, path) => {
        if (!known.has(path)) {
          extras.push({ path, changeType: 'modified', viewed: false, comments });
        }
      });
      return extras.length > 0 ? [...merged, ...extras] : merged;
    });

    // Matching synthetic diff entries (empty hunks): the file tree and the
    // diff viewer render from diffFiles, and the seeding effect drops any
    // file state without a diff entry on its next run.
    setAllDiffFiles(prev => {
      const known = new Set(prev.map(f => f.newPath || f.oldPath));
      const extras: DiffFile[] = [];
      commentsByFile.forEach((_comments, path) => {
        if (!known.has(path)) {
          extras.push({
            oldPath: path,
            newPath: path,
            changeType: 'modified',
            isBinary: false,
            hunks: [],
          });
        }
      });
      return extras.length > 0 ? [...prev, ...extras] : prev;
    });
  }, [resumedReview, allDiffFiles]);

  // Load data from adapter (if provided and no initialFiles)
  useEffect(() => {
    if (initialFiles || !adapter) return;

    let cancelled = false;

    (async () => {
      try {
        const payload: DiffLoadPayload = await adapter.loadDiff();
        if (cancelled) return;
        setAllDiffFiles(payload.files);
        setDiffSource(payload.source);

        // Load resumed review if adapter supports it. Applying it is deferred to
        // the effect below: the per-file state it merges into does not exist
        // until the allDiffFiles effect has seeded it.
        if (adapter.loadResumedReview) {
          const resumed = await adapter.loadResumedReview();
          if (cancelled) return;
          setResumedReview(resumed);
        }
      } catch (error) {
        console.error('[ReviewContext] Failed to load diff:', error);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // Later pushed diff payloads replace the session wholesale — the host may
  // start a review after the initial load resolved (e.g. a remote PR/MR URL
  // submitted on the welcome screen). loadDiff's promise has settled by
  // then, so pushes arrive only through this subscription.
  useEffect(() => {
    if (initialFiles || !adapter?.onDiffLoad) return;
    return adapter.onDiffLoad(payload => {
      resumeAppliedRef.current = false;
      setResumedReview(null);
      setAllDiffFiles(payload.files);
      setDiffSource(payload.source);
    });
  }, []);

  // Apply initial comments
  useEffect(() => {
    if (!initialComments || initialComments.length === 0) return;

    const commentsByFile = groupCommentsByFile(initialComments);

    reviewState.setFiles(prev =>
      prev.map(file => ({
        ...file,
        comments: commentsByFile.get(file.path) || file.comments,
      }))
    );
  }, [initialComments]);

  const expandFileContext = async (filePath: string, contextLines: number): Promise<{ hunks: DiffHunk[]; totalLines: number } | null> => {
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

  const updateFileHunks = (filePath: string, hunks: DiffHunk[]) => {
    setAllDiffFiles(prev =>
      prev.map(f => {
        const fPath = f.newPath || f.oldPath;
        if (fPath === filePath) {
          return { ...f, hunks, contentLoaded: true };
        }
        return f;
      })
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
      }}
    >
      {children}
    </ReviewContext.Provider>
  );
}
