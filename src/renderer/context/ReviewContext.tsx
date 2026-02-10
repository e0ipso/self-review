import React, { createContext, useContext, useState } from 'react';
import type {
  DiffFile,
  FileReviewState,
  ReviewComment,
  LineRange,
  Suggestion,
} from '../../shared/types';

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

export function useReview(): ReviewContextValue {
  const context = useContext(ReviewContext);
  if (!context) {
    throw new Error('useReview must be used within a ReviewProvider');
  }
  return context;
}

export function ReviewProvider({ children }: { children: React.ReactNode }) {
  const [diffFiles, setDiffFiles] = useState<DiffFile[]>([]);
  const [files] = useState<FileReviewState[]>([]);

  const value: ReviewContextValue = {
    files,
    diffFiles,
    setDiffFiles,
    addComment: () => { /* stub */ },
    editComment: () => { /* stub */ },
    deleteComment: () => { /* stub */ },
    toggleViewed: () => { /* stub */ },
    getCommentsForFile: () => [],
    getCommentsForLine: () => [],
  };

  return (
    <ReviewContext.Provider value={value}>
      {children}
    </ReviewContext.Provider>
  );
}

export default ReviewContext;
