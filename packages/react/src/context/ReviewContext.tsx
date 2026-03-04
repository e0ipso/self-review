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
  ReviewComment,
  ReviewState,
  LineRange,
  Suggestion,
} from '@self-review/core';
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
  toggleViewed: (filePath: string) => void;
  getCommentsForFile: (filePath: string) => ReviewComment[];
  getCommentsForLine: (
    filePath: string,
    lineNumber: number,
    side: 'old' | 'new'
  ) => ReviewComment[];
  expandFileContext: (filePath: string, contextLines: number) => Promise<{ hunks: DiffHunk[]; totalLines: number } | null>;
  updateFileHunks: (filePath: string, hunks: DiffHunk[]) => void;
}

const ReviewContext = createContext<ReviewContextValue | null>(null);

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

        // Load resumed comments if adapter supports it
        if (adapter.loadResumedComments) {
          const comments = await adapter.loadResumedComments();
          if (cancelled) return;
          const commentsByFile = new Map<string, ReviewComment[]>();
          comments.forEach(comment => {
            if (!commentsByFile.has(comment.filePath)) {
              commentsByFile.set(comment.filePath, []);
            }
            commentsByFile.get(comment.filePath)!.push(comment);
          });

          reviewState.setFiles(prev =>
            prev.map(file => ({
              ...file,
              comments: commentsByFile.get(file.path) || file.comments,
            }))
          );
        }
      } catch (error) {
        console.error('[ReviewContext] Failed to load diff:', error);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // Apply initial comments
  useEffect(() => {
    if (!initialComments || initialComments.length === 0) return;

    const commentsByFile = new Map<string, ReviewComment[]>();
    initialComments.forEach(comment => {
      if (!commentsByFile.has(comment.filePath)) {
        commentsByFile.set(comment.filePath, []);
      }
      commentsByFile.get(comment.filePath)!.push(comment);
    });

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
        toggleViewed: reviewState.toggleViewed,
        getCommentsForFile: reviewState.getCommentsForFile,
        getCommentsForLine: reviewState.getCommentsForLine,
        expandFileContext,
        updateFileHunks,
      }}
    >
      {children}
    </ReviewContext.Provider>
  );
}
