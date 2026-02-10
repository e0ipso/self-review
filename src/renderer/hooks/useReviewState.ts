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
    filePath: string,
    lineRange: LineRange | null,
    body: string,
    category: string | null,
    suggestion: Suggestion | null
  ) => {
    const newComment: ReviewComment = {
      id: crypto.randomUUID(),
      filePath,
      lineRange,
      body,
      category,
      suggestion,
    };

    setFiles((prevFiles) =>
      prevFiles.map((file) =>
        file.path === filePath
          ? { ...file, comments: [...file.comments, newComment] }
          : file
      )
    );
  };

  const updateComment = (id: string, updates: Partial<ReviewComment>) => {
    setFiles((prevFiles) =>
      prevFiles.map((file) => ({
        ...file,
        comments: file.comments.map((comment) =>
          comment.id === id ? { ...comment, ...updates } : comment
        ),
      }))
    );
  };

  const deleteComment = (id: string) => {
    setFiles((prevFiles) =>
      prevFiles.map((file) => ({
        ...file,
        comments: file.comments.filter((comment) => comment.id !== id),
      }))
    );
  };

  const toggleViewed = (filePath: string) => {
    setFiles((prevFiles) =>
      prevFiles.map((file) =>
        file.path === filePath ? { ...file, viewed: !file.viewed } : file
      )
    );
  };

  const getCommentsForFile = (filePath: string): ReviewComment[] => {
    const file = files.find((f) => f.path === filePath);
    return file ? file.comments : [];
  };

  const getCommentsForLine = (
    filePath: string,
    lineNumber: number,
    side: 'old' | 'new'
  ): ReviewComment[] => {
    const file = files.find((f) => f.path === filePath);
    if (!file) return [];

    return file.comments.filter((comment) => {
      if (!comment.lineRange) return false;
      if (comment.lineRange.side !== side) return false;
      return (
        lineNumber >= comment.lineRange.start &&
        lineNumber <= comment.lineRange.end
      );
    });
  };

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
