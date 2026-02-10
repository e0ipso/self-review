import React from 'react';
import type { ReviewComment } from '../../../shared/types';

export interface CommentDisplayProps {
  comment: ReviewComment;
}

export default function CommentDisplay({ comment }: CommentDisplayProps) {
  return (
    <div data-testid="comment-display">
      <p>{comment.body}</p>
    </div>
  );
}
