import React, { useState, useEffect } from 'react';
import type {
  LineRange,
  ReviewComment,
  Suggestion,
} from '../../../shared/types';
import { useReview } from '../../context/ReviewContext';
import { useConfig } from '../../context/ConfigContext';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Separator } from '../ui/separator';
import { Code2 } from 'lucide-react';
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
  const { config } = useConfig();
  const defaultCategory = config.categories?.[0]?.name ?? '';
  const [body, setBody] = useState('');
  const [category, setCategory] = useState(defaultCategory);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [proposedCode, setProposedCode] = useState('');

  useEffect(() => {
    if (existingComment) {
      setBody(existingComment.body);
      setCategory(existingComment.category || defaultCategory);
      if (existingComment.suggestion) {
        setShowSuggestion(true);
        setProposedCode(existingComment.suggestion.proposedCode);
      }
    }
  }, [existingComment]);

  const isValid = body.trim().length > 0 && category.length > 0;

  const handleSubmit = () => {
    if (!isValid) return;

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
    setCategory(defaultCategory);
    setShowSuggestion(false);
    setProposedCode('');
    onSubmit?.();
  };

  const handleCancel = () => {
    setBody('');
    setCategory(defaultCategory);
    setShowSuggestion(false);
    setProposedCode('');
    onCancel();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className='rounded-lg border border-border bg-card shadow-sm overflow-hidden'
      data-testid='comment-input'
    >
      {lineRange && (
        <div className='px-3 pt-2 pb-0'>
          <span className='text-xs font-medium text-muted-foreground'>
            {lineRange.start === lineRange.end
              ? `Comment on line ${lineRange.start}`
              : `Comment on lines ${lineRange.start} to ${lineRange.end}`}
          </span>
        </div>
      )}
      <div className='p-3'>
        <Textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='Add your review comment...'
          className='min-h-[80px] resize-y text-sm border-0 shadow-none focus-visible:ring-0 p-0 placeholder:text-muted-foreground/60'
          autoFocus
        />
      </div>

      {showSuggestion && originalCode && (
        <>
          <Separator />
          <div className='p-3 space-y-2 bg-muted/20'>
            <div data-testid='suggestion-original'>
              <label className='text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1 block'>
                Original
              </label>
              <Textarea
                value={originalCode}
                disabled
                className='font-mono text-xs bg-muted/30 resize-none'
                rows={3}
              />
            </div>
            <div data-testid='suggestion-proposed'>
              <label className='text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1 block'>
                Suggested
              </label>
              <Textarea
                value={proposedCode}
                onChange={e => setProposedCode(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder='Enter your suggested code...'
                className='font-mono text-xs resize-y'
                rows={3}
              />
            </div>
          </div>
        </>
      )}

      <Separator />

      {/* Actions bar */}
      <div className='flex items-center justify-between px-3 py-2 bg-muted/10'>
        <div className='flex items-center gap-2'>
          <CategorySelector value={category} onChange={setCategory} />
          {originalCode && (
            <Button
              type='button'
              variant={showSuggestion ? 'secondary' : 'ghost'}
              size='sm'
              data-testid='add-suggestion-btn'
              onClick={() => setShowSuggestion(!showSuggestion)}
              className='h-7 gap-1.5 text-xs'
            >
              <Code2 className='h-3.5 w-3.5' />
              {showSuggestion ? 'Remove suggestion' : 'Suggest'}
            </Button>
          )}
        </div>

        <div className='flex items-center gap-1.5'>
          <Button
            data-testid='cancel-comment-btn'
            variant='ghost'
            size='sm'
            onClick={handleCancel}
            className='h-7 text-xs'
          >
            Cancel
          </Button>
          <Button
            data-testid='add-comment-btn'
            size='sm'
            onClick={handleSubmit}
            disabled={!isValid}
            className='h-7 text-xs gap-1.5'
          >
            {existingComment ? 'Update' : 'Comment'}
            <kbd className='pointer-events-none inline-flex items-center rounded border border-current/20 px-1 font-mono text-[10px] font-medium opacity-60'>
              {navigator.platform?.includes('Mac') ? '\u2318' : 'Ctrl'}
              {'\u21B5'}
            </kbd>
          </Button>
        </div>
      </div>
    </div>
  );
}
