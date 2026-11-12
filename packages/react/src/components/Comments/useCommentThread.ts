import { useState } from 'react';
import { useReviewCommands } from '../../context/ReviewContext';
import { useCommentDisclosure } from '../../context/ReviewDisplayContext';

/** Local editor modes and shared thread disclosure; feedback stays in the review's store. */
export function useCommentThread(commentId: string) {
  const { deleteComment } = useReviewCommands();
  const { isCollapsed: readCollapsed, setCollapsed } = useCommentDisclosure();
  const [isEditing, setEditing] = useState(false);
  const [isReplying, setReplying] = useState(false);
  const isCollapsed = readCollapsed(commentId);
  return {
    isEditing,
    startEditing: () => setEditing(true),
    finishEditing: () => setEditing(false),
    isReplying,
    startReplying: () => setReplying(true),
    finishReplying: () => setReplying(false),
    isCollapsed,
    toggleCollapse: () => setCollapsed(commentId, !isCollapsed),
    deleteThread: () => deleteComment(commentId),
  };
}
