import React, { useState } from 'react';
import type { ReviewComment } from '../../../shared/types';
import { useReview } from '../../context/ReviewContext';
import { useConfig } from '../../context/ConfigContext';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Pencil, Trash2 } from 'lucide-react';
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
  const borderColor = categoryDef?.color || 'hsl(var(--border))';

  const handleDelete = () => {
    deleteComment(comment.id);
  };

  const handleEditComplete = () => {
    setIsEditing(false);
  };

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
      className="rounded-lg border border-border bg-card text-sm group"
      data-testid={`comment-${comment.id}`}
      style={{ borderLeftWidth: '3px', borderLeftColor: borderColor }}
    >
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">You</span>
          {comment.category && (
            <Badge
              variant="secondary"
              className="category-badge h-5 px-1.5 text-[10px] font-medium"
              style={{
                backgroundColor: categoryDef?.color ? `${categoryDef.color}20` : undefined,
                color: categoryDef?.color || undefined,
                borderColor: categoryDef?.color ? `${categoryDef.color}40` : undefined,
                borderWidth: '1px',
              }}
            >
              {comment.category}
            </Badge>
          )}
          {comment.orphaned && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-orange-500/15 text-orange-600 dark:text-orange-400">
              Orphaned
            </Badge>
          )}
        </div>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="h-6 w-6 p-0"
          >
            <Pencil className="h-3 w-3" />
            <span className="sr-only">Edit</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
            <span className="sr-only">Delete</span>
          </Button>
        </div>
      </div>

      <div className="px-3 pb-3 whitespace-pre-wrap text-sm text-foreground leading-relaxed">
        {comment.body}
      </div>

      {comment.suggestion && (
        <div className="px-3 pb-3">
          <SuggestionBlock
            suggestion={comment.suggestion}
            language="typescript"
          />
        </div>
      )}
    </div>
  );
}
