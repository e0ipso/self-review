import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import type {
  DiffFile,
  DiffLoadPayload,
  FileReviewState,
  ReviewComment,
  ReviewState,
  LineRange,
  Suggestion,
} from '../../shared/types';
import { useReviewState } from '../hooks/useReviewState';

export interface ReviewContextValue {
  files: FileReviewState[];
  diffFiles: DiffFile[];
  setDiffFiles: (files: DiffFile[]) => void;
  addComment: (
    filePath: string,
    lineRange: LineRange | null,
    body: string,
    category: string | null,
    suggestion: Suggestion | null
  ) => void;
  editComment: (id: string, updates: Partial<ReviewComment>) => void;
  deleteComment: (id: string) => void;
  toggleViewed: (filePath: string) => void;
  getCommentsForFile: (filePath: string) => ReviewComment[];
  getCommentsForLine: (filePath: string, lineNumber: number, side: 'old' | 'new') => ReviewComment[];
}

const ReviewContext = createContext<ReviewContextValue | null>(null);

export function useReview() {
  const context = useContext(ReviewContext);
  if (!context) {
    throw new Error('useReview must be used within ReviewProvider');
  }
  return context;
}

interface ReviewProviderProps {
  children: ReactNode;
}

export function ReviewProvider({ children }: ReviewProviderProps) {
  const [diffFiles, setDiffFiles] = useState<DiffFile[]>([]);
  const [gitDiffArgs, setGitDiffArgs] = useState<string>('');
  const [repository, setRepository] = useState<string>('');

  const reviewState = useReviewState();

  // Create refs for IPC listener closure
  const gitDiffArgsRef = useRef(gitDiffArgs);
  const repositoryRef = useRef(repository);
  const filesRef = useRef(reviewState.files);

  // Update refs when values change
  useEffect(() => { gitDiffArgsRef.current = gitDiffArgs; }, [gitDiffArgs]);
  useEffect(() => { repositoryRef.current = repository; }, [repository]);
  useEffect(() => { filesRef.current = reviewState.files; }, [reviewState.files]);

  // When diffFiles change, initialize FileReviewState
  useEffect(() => {
    if (diffFiles.length > 0) {
      const fileStates: FileReviewState[] = diffFiles.map((file) => ({
        path: file.newPath || file.oldPath,
        changeType: file.changeType,
        viewed: false,
        comments: [] as ReviewComment[],
      }));
      reviewState.setFiles(fileStates);
    }
  }, [diffFiles]);

  // Register IPC listeners ONCE
  useEffect(() => {
    if (!window.electronAPI) return;

    // Load diff data from main process
    window.electronAPI.onDiffLoad((payload: DiffLoadPayload) => {
      setDiffFiles(payload.files);
      setGitDiffArgs(payload.gitDiffArgs);
      setRepository(payload.repository);
    });

    // Load prior comments for resume
    window.electronAPI.onResumeLoad((payload) => {
      // Merge prior comments into existing state
      const commentsByFile = new Map<string, ReviewComment[]>();
      payload.comments.forEach((comment) => {
        if (!commentsByFile.has(comment.filePath)) {
          commentsByFile.set(comment.filePath, []);
        }
        commentsByFile.get(comment.filePath)!.push(comment);
      });

      reviewState.setFiles((prev) =>
        prev.map((file) => ({
          ...file,
          comments: commentsByFile.get(file.path) || [],
        }))
      );
    });

    // Handle review submission request
    window.electronAPI.onRequestReview(() => {
      const reviewData: ReviewState = {
        timestamp: new Date().toISOString(),
        gitDiffArgs: gitDiffArgsRef.current,
        repository: repositoryRef.current,
        files: filesRef.current,
      };
      window.electronAPI.submitReview(reviewData);
    });
  }, []); // Empty dependency array - register only once

  return (
    <ReviewContext.Provider
      value={{
        files: reviewState.files,
        diffFiles,
        setDiffFiles,
        addComment: reviewState.addComment,
        editComment: reviewState.updateComment,
        deleteComment: reviewState.deleteComment,
        toggleViewed: reviewState.toggleViewed,
        getCommentsForFile: reviewState.getCommentsForFile,
        getCommentsForLine: reviewState.getCommentsForLine,
      }}
    >
      {children}
    </ReviewContext.Provider>
  );
}
