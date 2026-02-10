import React, { useState } from 'react';
import type { ReviewComment } from '../../../shared/types';
import { useReview } from '../../context/ReviewContext';
import { useConfig } from '../../context/ConfigContext';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import CommentInput from './CommentInput';
import SuggestionBlock from './SuggestionBlock';

export interface CommentDisplayProps {
  comment: ReviewComment;
}

export default function CommentDisplay({ comment }: CommentDisplayProps) {
  const { deleteComment } = useReview();
  const { config } = useConfig();
  const [isEditing, setIsEditing] = useState(false);

  const categoryDef = config.categories?.find((cat) => cat.name === comment.category);
  const borderColor = categoryDef?.color || 'hsl(var(--primary))';

  const handleDelete = () => {
    deleteComment(comment.id);
  };

  const handleEditComplete = () => {
    setIsEditing(false);
  };

  // Extract original code if we have a suggestion
  const originalCode = comment.suggestion?.originalCode;

  if (isEditing) {
    return (
      <CommentInput
        filePath={comment.filePath}
        lineRange={comment.lineRange}
        onCancel={() => setIsEditing(false)}
        onSubmit={handleEditComplete}
        existingComment={comment}
        originalCode={originalCode}
      />
    );
  }

  return (
    <div
      className="rounded-lg bg-muted/30 p-4"
      style={{ borderLeft: `4px solid ${borderColor}` }}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">You</span>
          {comment.category && (
            <Badge
              variant="secondary"
              style={{
                backgroundColor: categoryDef?.color || undefined,
                color: categoryDef ? 'white' : undefined,
              }}
            >
              {comment.category}
            </Badge>
          )}
          {comment.orphaned && (
            <Badge variant="destructive" className="bg-orange-500">
              Orphaned
            </Badge>
          )}
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(true)}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
          >
            Delete
          </Button>
        </div>
      </div>

      <div className="whitespace-pre-wrap text-sm text-foreground">
        {comment.body}
      </div>

      {comment.suggestion && (
        <SuggestionBlock
          suggestion={comment.suggestion}
          language="typescript"
        />
      )}
    </div>
  );
}
