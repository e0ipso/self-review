import { useState } from 'react';
import type {
  Attachment,
  FileReviewState,
  Reply,
  ReviewComment,
  LineRange,
  Suggestion,
} from '@self-review/types';

export interface UseReviewStateReturn {
  files: FileReviewState[];
  setFiles: React.Dispatch<React.SetStateAction<FileReviewState[]>>;
  addComment: (
    filePath: string,
    lineRange: LineRange | null,
    body: string,
    category: string,
    suggestion: Suggestion | null,
    attachments?: Attachment[]
  ) => void;
  updateComment: (id: string, updates: Partial<ReviewComment>) => void;
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
}

export function useReviewState(): UseReviewStateReturn {
  const [files, setFiles] = useState<FileReviewState[]>([]);

  const addComment = (
    filePath: string,
    lineRange: LineRange | null,
    body: string,
    category: string,
    suggestion: Suggestion | null,
    attachments?: Attachment[]
  ) => {
    const newComment: ReviewComment = {
      id: crypto.randomUUID(),
      filePath,
      lineRange,
      body,
      category,
      suggestion,
      ...(attachments?.length ? { attachments } : {}),
    };

    setFiles(prevFiles =>
      prevFiles.map(file =>
        file.path === filePath
          ? { ...file, comments: [...file.comments, newComment] }
          : file
      )
    );
  };

  const updateComment = (id: string, updates: Partial<ReviewComment>) => {
    setFiles(prevFiles =>
      prevFiles.map(file => ({
        ...file,
        comments: file.comments.map(comment =>
          comment.id === id ? { ...comment, ...updates } : comment
        ),
      }))
    );
  };

  const deleteComment = (id: string) => {
    setFiles(prevFiles =>
      prevFiles.map(file => ({
        ...file,
        comments: file.comments.filter(comment => comment.id !== id),
      }))
    );
  };

  /**
   * Appends a reply to a comment's thread, creating the array when absent.
   * Order is conversation order: replies are always appended, never prepended.
   */
  const addReply = (
    commentId: string,
    body: string,
    author?: string,
    attachments?: Attachment[]
  ) => {
    const newReply: Reply = {
      id: crypto.randomUUID(),
      body,
      ...(author ? { author } : {}),
      ...(attachments?.length ? { attachments } : {}),
    };

    setFiles(prevFiles =>
      prevFiles.map(file => ({
        ...file,
        comments: file.comments.map(comment =>
          comment.id === commentId
            ? { ...comment, replies: [...(comment.replies ?? []), newReply] }
            : comment
        ),
      }))
    );
  };

  const updateReply = (
    commentId: string,
    replyId: string,
    updates: Partial<Reply>
  ) => {
    setFiles(prevFiles =>
      prevFiles.map(file => ({
        ...file,
        comments: file.comments.map(comment =>
          comment.id === commentId
            ? {
                ...comment,
                replies: comment.replies?.map(reply =>
                  reply.id === replyId ? { ...reply, ...updates } : reply
                ),
              }
            : comment
        ),
      }))
    );
  };

  const deleteReply = (commentId: string, replyId: string) => {
    setFiles(prevFiles =>
      prevFiles.map(file => ({
        ...file,
        comments: file.comments.map(comment =>
          comment.id === commentId
            ? {
                ...comment,
                replies: comment.replies?.filter(reply => reply.id !== replyId),
              }
            : comment
        ),
      }))
    );
  };

  const toggleViewed = (filePath: string) => {
    setFiles(prevFiles =>
      prevFiles.map(file =>
        file.path === filePath ? { ...file, viewed: !file.viewed } : file
      )
    );
  };

  const getCommentsForFile = (filePath: string): ReviewComment[] => {
    const file = files.find(f => f.path === filePath);
    return file ? file.comments : [];
  };

  const getCommentsForLine = (
    filePath: string,
    lineNumber: number,
    side: 'old' | 'new'
  ): ReviewComment[] => {
    const file = files.find(f => f.path === filePath);
    if (!file) return [];

    return file.comments.filter(comment => {
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
    addReply,
    updateReply,
    deleteReply,
    toggleViewed,
    getCommentsForFile,
    getCommentsForLine,
  };
}
