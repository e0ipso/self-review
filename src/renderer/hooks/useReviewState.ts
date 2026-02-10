import { useState } from 'react';
import type { FileReviewState, ReviewComment, LineRange, Suggestion } from '../../shared/types';

export interface UseReviewStateReturn {
  files: FileReviewState[];
  setFiles: React.Dispatch<React.SetStateAction<FileReviewState[]>>;
  addComment: (
    filePath: string,
    lineRange: LineRange | null,
    body: string,
    category: string | null,
    suggestion: Suggestion | null
  ) => void;
  updateComment: (id: string, updates: Partial<ReviewComment>) => void;
  deleteComment: (id: string) => void;
  toggleViewed: (filePath: string) => void;
  getCommentsForFile: (filePath: string) => ReviewComment[];
  getCommentsForLine: (filePath: string, lineNumber: number, side: 'old' | 'new') => ReviewComment[];
}

export function useReviewState(): UseReviewStateReturn {
  const [files, setFiles] = useState<FileReviewState[]>([]);

  const addComment = (
    _filePath: string,
    _lineRange: LineRange | null,
    _body: string,
    _category: string | null,
    _suggestion: Suggestion | null
  ) => { /* stub */ };

  const updateComment = (_id: string, _updates: Partial<ReviewComment>) => { /* stub */ };
  const deleteComment = (_id: string) => { /* stub */ };
  const toggleViewed = (_filePath: string) => { /* stub */ };
  const getCommentsForFile = (_filePath: string): ReviewComment[] => [];
  const getCommentsForLine = (_filePath: string, _lineNumber: number, _side: 'old' | 'new'): ReviewComment[] => [];

  return {
    files,
    setFiles,
    addComment,
    updateComment,
    deleteComment,
    toggleViewed,
    getCommentsForFile,
    getCommentsForLine,
  };
}
