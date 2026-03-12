import React from 'react';
import type { ReviewComment } from '@self-review/types';
import CommentDisplay from '../Comments/CommentDisplay';
import CommentInput from '../Comments/CommentInput';

export interface InlineCommentSlotProps {
  commentsToRender: ReviewComment[];
  showCommentInput: boolean;
  commentRange: { start: number; end: number; side: 'old' | 'new' } | null;
  filePath: string;
  originalCode: string | undefined;
  onCancel: () => void;
  onSaved: () => void;
  indentClass?: string;
  getOriginalCodeForComment?: (comment: ReviewComment) => string | undefined;
}

export function InlineCommentSlot({
  commentsToRender,
  showCommentInput,
  commentRange,
  filePath,
  originalCode,
  onCancel,
  onSaved,
  indentClass = '',
  getOriginalCodeForComment,
}: InlineCommentSlotProps) {
  if (!showCommentInput && commentsToRender.length === 0) return null;

  return (
    <>
      {commentsToRender.length > 0 && (
        <div className={`border-y border-border bg-muted/50 px-4 py-3 space-y-2${indentClass ? ` ${indentClass}` : ''}`}>
          {commentsToRender.map(comment => (
            <CommentDisplay
              key={comment.id}
              comment={comment}
              originalCode={getOriginalCodeForComment ? getOriginalCodeForComment(comment) : undefined}
            />
          ))}
        </div>
      )}
      {showCommentInput && commentRange && (
        <div className={`border-y border-border bg-muted/50 px-4 py-3${indentClass ? ` ${indentClass}` : ''}`}>
          <CommentInput
            filePath={filePath}
            lineRange={{
              side: commentRange.side,
              start: commentRange.start,
              end: commentRange.end,
            }}
            onCancel={onCancel}
            onSubmit={onSaved}
            originalCode={originalCode}
          />
        </div>
      )}
    </>
  );
}
