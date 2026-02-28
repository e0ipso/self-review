import React, { useMemo } from 'react';
import { useReview } from '../context/ReviewContext';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { Eye, MessageSquare } from 'lucide-react';

export default function ReviewProgress() {
  const { files, diffFiles } = useReview();

  const { viewedCount, totalFiles, commentCount, filesWithComments } =
    useMemo(() => {
      const viewed = files.filter(f => f.viewed).length;
      const total = diffFiles.length;
      const comments = files.reduce((sum, f) => sum + f.comments.length, 0);
      const withComments = files.filter(f => f.comments.length > 0).length;
      return {
        viewedCount: viewed,
        totalFiles: total,
        commentCount: comments,
        filesWithComments: withComments,
      };
    }, [files, diffFiles]);

  if (totalFiles === 0) return null;

  const percentage = Math.round((viewedCount / totalFiles) * 100);

  return (
    <div className='flex items-center gap-2'>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className='flex items-center gap-1.5 text-xs text-muted-foreground'
            data-testid='review-progress'
          >
            <Eye className='h-3 w-3' />
            <span className='tabular-nums'>
              {viewedCount}/{totalFiles}
            </span>
            <div className='w-16 h-1.5 rounded-full bg-muted overflow-hidden'>
              <div
                className='h-full rounded-full bg-green-600 dark:bg-green-500 transition-all duration-300'
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {viewedCount} of {totalFiles} files viewed ({percentage}%)
        </TooltipContent>
      </Tooltip>
      {commentCount > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className='flex items-center gap-1 text-xs text-muted-foreground'
              data-testid='comment-stats'
            >
              <MessageSquare className='h-3 w-3' />
              <span className='tabular-nums'>{commentCount}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {commentCount} {commentCount === 1 ? 'comment' : 'comments'} across{' '}
            {filesWithComments} {filesWithComments === 1 ? 'file' : 'files'}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
