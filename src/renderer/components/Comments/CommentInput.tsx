import React, { useState, useEffect } from 'react';
import type { LineRange, ReviewComment, Suggestion } from '../../../shared/types';
import { useReview } from '../../context/ReviewContext';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import CategorySelector from './CategorySelector';

export interface CommentInputProps {
  filePath: string;
  lineRange: LineRange | null;
  onCancel: () => void;
  onSubmit?: () => void;
  existingComment?: ReviewComment;
  originalCode?: string;
}

export default function CommentInput({
  filePath,
  lineRange,
  onCancel,
  onSubmit,
  existingComment,
  originalCode,
}: CommentInputProps) {
  const { addComment, editComment } = useReview();
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [proposedCode, setProposedCode] = useState('');

  useEffect(() => {
    if (existingComment) {
      setBody(existingComment.body);
      setCategory(existingComment.category);
      if (existingComment.suggestion) {
        setShowSuggestion(true);
        setProposedCode(existingComment.suggestion.proposedCode);
      }
    }
  }, [existingComment]);

  const handleSubmit = () => {
    if (!body.trim()) return;

    const suggestion: Suggestion | null =
      showSuggestion && originalCode
        ? {
            originalCode,
            proposedCode,
          }
        : null;

    if (existingComment) {
      editComment(existingComment.id, { body, category, suggestion });
    } else {
      addComment(filePath, lineRange, body, category, suggestion);
    }

    setBody('');
    setCategory(null);
    setShowSuggestion(false);
    setProposedCode('');
    onSubmit?.();
  };

  const handleCancel = () => {
    setBody('');
    setCategory(null);
    setShowSuggestion(false);
    setProposedCode('');
    onCancel();
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm" data-testid="comment-input">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add your review comment..."
        className="mb-3 min-h-[100px] resize-y"
      />

      <div className="mb-3">
        <CategorySelector value={category} onChange={setCategory} />
      </div>

      {originalCode && (
        <div className="mb-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="add-suggestion-btn"
            onClick={() => setShowSuggestion(!showSuggestion)}
          >
            {showSuggestion ? 'Remove suggestion' : 'Add suggestion'}
          </Button>
        </div>
      )}

      {showSuggestion && originalCode && (
        <div className="mb-3 space-y-2">
          <div data-testid="suggestion-original">
            <label className="mb-1 block text-sm font-medium text-foreground">
              Original code
            </label>
            <Textarea
              value={originalCode}
              disabled
              className="font-mono text-sm"
              rows={3}
            />
          </div>
          <div data-testid="suggestion-proposed">
            <label className="mb-1 block text-sm font-medium text-foreground">
              Proposed code
            </label>
            <Textarea
              value={proposedCode}
              onChange={(e) => setProposedCode(e.target.value)}
              placeholder="Enter your suggested code..."
              className="font-mono text-sm"
              rows={3}
            />
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button data-testid="add-comment-btn" onClick={handleSubmit} disabled={!body.trim()}>
          {existingComment ? 'Update comment' : 'Add comment'}
        </Button>
        <Button data-testid="cancel-comment-btn" variant="ghost" onClick={handleCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
