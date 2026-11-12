import type { Attachment, Reply, ReviewComment, LineRange, Suggestion } from '@self-review/types';
import type { UseReviewStateReturn } from '../hooks/useReviewState';

/** Comment and viewed mutations share one updater, independently of React subscriptions. */
export function createReviewStateCommands(
  setFiles: UseReviewStateReturn['setFiles'],
  createId: () => string
) {
  const changeThread = (
    commentId: string,
    change: (comment: ReviewComment) => ReviewComment | null
  ) => {
    setFiles(previous =>
      previous.map(file => {
        if (!file.comments.some(comment => comment.id === commentId)) return file;
        return {
          ...file,
          comments: file.comments.flatMap(comment => {
            if (comment.id !== commentId) return [comment];
            const next = change(comment);
            return next ? [next] : [];
          }),
        };
      })
    );
  };
  const addComment = (
    filePath: string,
    lineRange: LineRange | null,
    body: string,
    category: string,
    suggestion: Suggestion | null,
    attachments?: Attachment[]
  ) => {
    const newComment: ReviewComment = {
      id: createId(),
      filePath,
      lineRange,
      body,
      category,
      suggestion,
      ...(attachments?.length ? { attachments } : {}),
    };

    setFiles(prevFiles =>
      prevFiles.map(file =>
        file.path === filePath ? { ...file, comments: [...file.comments, newComment] } : file
      )
    );
  };

  const updateComment = (id: string, updates: Partial<ReviewComment>) =>
    changeThread(id, comment => ({ ...comment, ...updates }));
  const deleteComment = (id: string) => changeThread(id, () => null);

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
      id: createId(),
      body,
      ...(author ? { author } : {}),
      ...(attachments?.length ? { attachments } : {}),
    };

    changeThread(commentId, comment => ({
      ...comment,
      replies: [...(comment.replies ?? []), newReply],
    }));
  };
  const updateReply = (commentId: string, replyId: string, updates: Partial<Reply>) => {
    changeThread(commentId, comment => ({
      ...comment,
      replies: comment.replies?.map(reply =>
        reply.id === replyId ? { ...reply, ...updates } : reply
      ),
    }));
  };
  const deleteReply = (commentId: string, replyId: string) => {
    changeThread(commentId, comment => ({
      ...comment,
      replies: comment.replies?.filter(reply => reply.id !== replyId),
    }));
  };

  const toggleViewed = (filePath: string) => {
    setFiles(prevFiles =>
      prevFiles.map(file => (file.path === filePath ? { ...file, viewed: !file.viewed } : file))
    );
  };

  return {
    addComment,
    updateComment,
    deleteComment,
    addReply,
    updateReply,
    deleteReply,
    toggleViewed,
  };
}
