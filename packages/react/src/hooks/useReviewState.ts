import { useMemo, useState } from 'react';
import { createReviewStateQueries } from '../context/review-state-queries';
import { createReviewStateCommands } from '../context/review-state-commands';
import { useReviewServices } from '../context/ReviewServicesContext';
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
  addReply: (commentId: string, body: string, author?: string, attachments?: Attachment[]) => void;
  updateReply: (commentId: string, replyId: string, updates: Partial<Reply>) => void;
  deleteReply: (commentId: string, replyId: string) => void;
  toggleViewed: (filePath: string) => void;
  getCommentsForFile: (filePath: string) => ReviewComment[];
  getCommentsForLine: (
    filePath: string,
    lineNumber: number,
    side: 'old' | 'new'
  ) => ReviewComment[];
}

export function useReviewState(
  owner?: Pick<UseReviewStateReturn, 'files' | 'setFiles'>
): UseReviewStateReturn {
  const [localFiles, setLocalFiles] = useState<FileReviewState[]>([]);
  return useReviewStateOperations(owner?.files ?? localFiles, owner?.setFiles ?? setLocalFiles);
}

export function useReviewStateOperations(
  files: FileReviewState[],
  setFiles: UseReviewStateReturn['setFiles']
): UseReviewStateReturn {
  const { createId } = useReviewServices();
  const commands = useMemo(
    () => createReviewStateCommands(setFiles, createId),
    [setFiles, createId]
  );

  const queries = useMemo(() => createReviewStateQueries(files), [files]);

  return {
    files,
    setFiles,
    ...commands,
    ...queries,
  };
}
