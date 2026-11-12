import { useLocalization } from '../localization/LocalizationContext';
import React, { useMemo } from 'react';
import { useDiffReview, useProgressReview } from '../context/ReviewContext';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { Eye, MessageSquare } from 'lucide-react';

export default function ReviewProgress() {
  const { t, number } = useLocalization();
  const { diffFiles } = useDiffReview();
  const summaries = useProgressReview();

  const { viewedCount, totalFiles, commentCount, filesWithComments } = useMemo(() => {
    const paths = new Set(diffFiles.map(file => file.newPath || file.oldPath));
    const visible = summaries.filter(summary => paths.has(summary.path));
    const viewed = visible.filter(f => f.viewed).length;
    const total = diffFiles.length;
    const comments = visible.reduce((sum, f) => sum + f.commentCount, 0);
    const withComments = visible.filter(f => f.commentCount > 0).length;
    return {
      viewedCount: viewed,
      totalFiles: total,
      commentCount: comments,
      filesWithComments: withComments,
    };
  }, [summaries, diffFiles]);

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
              {number(viewedCount)}/{number(totalFiles)}
            </span>
            <div
              role='progressbar'
              aria-label={t('Review progress')}
              aria-valuemin={0}
              aria-valuemax={totalFiles}
              aria-valuenow={viewedCount}
              className='w-16 h-1.5 rounded-full bg-muted overflow-hidden'
            >
              <div
                className='h-full rounded-full bg-green-600 dark:bg-green-500 transition-all duration-300'
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {t('files viewed', { viewed: viewedCount, total: totalFiles, percent: percentage })}
        </TooltipContent>
      </Tooltip>
      {commentCount > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className='flex items-center gap-1 text-xs text-muted-foreground'
              data-testid='review-stats'
            >
              <MessageSquare className='h-3 w-3' />
              <span className='tabular-nums'>{number(commentCount)}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {t('comments across files', { count: commentCount, files: filesWithComments })}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
