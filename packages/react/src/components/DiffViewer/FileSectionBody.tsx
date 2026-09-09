import React from 'react';
import type { ReviewComment } from '@self-review/types';
import CommentDisplay from '../Comments/CommentDisplay';
import CommentInput from '../Comments/CommentInput';
import { DiffContentArea, type DiffContentAreaProps } from './DiffContentArea';

export interface FileSectionBodyProps {
  filePath: string;
  fileComments: ReviewComment[];
  orphanedComments?: ReviewComment[];
  showingFileComment: boolean;
  onCancelFileComment: () => void;
  onFileCommentSubmit: () => void;
  contentAreaProps: DiffContentAreaProps;
}

export function FileSectionBody({
  filePath,
  fileComments,
  orphanedComments = [],
  showingFileComment,
  onCancelFileComment,
  onFileCommentSubmit,
  contentAreaProps,
}: FileSectionBodyProps) {
  return (
    <div className='bg-background file-diff-content rounded-b-lg overflow-hidden'>
      {orphanedComments.length > 0 && (
        <section
          aria-label='Comments outside the current diff'
          className='p-3 space-y-2 bg-amber-500/10 border-b border-border'
        >
          <h3 className='text-sm font-medium'>Comments outside the current diff</h3>
          <p className='text-xs text-muted-foreground'>
            These recorded line ranges are not in the loaded diff. Their original locations are preserved when you save.
          </p>
          {orphanedComments.map(comment => (
            <CommentDisplay key={comment.id} comment={comment} />
          ))}
        </section>
      )}

      {/* File-level comments */}
      {fileComments.length > 0 && (
        <div className='p-3 space-y-2 bg-muted/20 border-b border-border'>
          {fileComments.map(comment => (
            <CommentDisplay key={comment.id} comment={comment} />
          ))}
        </div>
      )}

      {/* File comment input */}
      {showingFileComment && (
        <div className='p-3 bg-muted/20 border-b border-border'>
          <CommentInput
            filePath={filePath}
            lineRange={null}
            onCancel={onCancelFileComment}
            onSubmit={onFileCommentSubmit}
          />
        </div>
      )}

      {/* Diff content dispatcher */}
      <DiffContentArea {...contentAreaProps} />
    </div>
  );
}
