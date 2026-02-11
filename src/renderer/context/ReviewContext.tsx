import React, { createContext, useContext, useState, useEffect, useRef, useMemo, ReactNode } from 'react';
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
import { useConfig } from './ConfigContext';

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
  const [allDiffFiles, setAllDiffFiles] = useState<DiffFile[]>([]);
  const [gitDiffArgs, setGitDiffArgs] = useState<string>('');
  const [repository, setRepository] = useState<string>('');
  const { config } = useConfig();

  const reviewState = useReviewState();

  // Filter files based on showUntracked toggle
  const diffFiles = useMemo(() => {
    if (config.showUntracked) return allDiffFiles;
    return allDiffFiles.filter((file) => !file.isUntracked);
  }, [allDiffFiles, config.showUntracked]);

  // Create refs for IPC listener closure
  const gitDiffArgsRef = useRef(gitDiffArgs);
  const repositoryRef = useRef(repository);
  const filesRef = useRef(reviewState.files);

  // Update refs when values change
  useEffect(() => { gitDiffArgsRef.current = gitDiffArgs; }, [gitDiffArgs]);
  useEffect(() => { repositoryRef.current = repository; }, [repository]);
  useEffect(() => { filesRef.current = reviewState.files; }, [reviewState.files]);

  // When allDiffFiles change, initialize FileReviewState for all files
  useEffect(() => {
    if (allDiffFiles.length > 0) {
      const fileStates: FileReviewState[] = allDiffFiles.map((file) => ({
        path: file.newPath || file.oldPath,
        changeType: file.changeType,
        viewed: false,
        comments: [] as ReviewComment[],
      }));
      reviewState.setFiles(fileStates);
    }
  }, [allDiffFiles]);

  // Register IPC listeners ONCE and request initial data
  useEffect(() => {
    if (!window.electronAPI) return;

    // Set up listeners first
    window.electronAPI.onDiffLoad((payload: DiffLoadPayload) => {
      setAllDiffFiles(payload.files);
      setGitDiffArgs(payload.gitDiffArgs);
      setRepository(payload.repository);

      // After diff is loaded, request resume data if available
      window.electronAPI.requestResumeData();
    });

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

    window.electronAPI.onRequestReview(() => {
      console.error('[renderer] Received review:request from main');
      const reviewData: ReviewState = {
        timestamp: new Date().toISOString(),
        gitDiffArgs: gitDiffArgsRef.current,
        repository: repositoryRef.current,
        files: filesRef.current,
      };
      console.error('[renderer] Submitting review data:', JSON.stringify({
        timestamp: reviewData.timestamp,
        gitDiffArgs: reviewData.gitDiffArgs,
        repository: reviewData.repository,
        fileCount: reviewData.files.length,
      }));
      window.electronAPI.submitReview(reviewData);
      console.error('[renderer] Review data submitted');
    });

    // Now request the data from main process
    window.electronAPI.requestDiffData();
  }, []); // Empty dependency array - register only once

  return (
    <ReviewContext.Provider
      value={{
        files: reviewState.files,
        diffFiles,
        setDiffFiles: setAllDiffFiles,
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
