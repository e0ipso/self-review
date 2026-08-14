import React, { useState, useEffect, useRef } from 'react';
import type {
  Attachment,
  LineRange,
  ReviewComment,
  Suggestion,
} from '@self-review/types';
import { useReview } from '../../context/ReviewContext';
import { useConfig } from '../../context/ConfigContext';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { Code2 } from 'lucide-react';
import CategorySelector from './CategorySelector';
import { ComposerCore, AttachButton } from './ComposerCore';
import { SuggestionPanel } from './SuggestionPanel';

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
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (existingComment) {
      setBody(existingComment.body);
      setCategory(existingComment.category || defaultCategory);
      if (existingComment.suggestion) {
        setShowSuggestion(true);
        setProposedCode(existingComment.suggestion.proposedCode);
      }
      if (existingComment.attachments) {
        setAttachments(existingComment.attachments);
      }
    }
  }, [existingComment]);

  const hasContent = body.trim().length > 0 || (showSuggestion && !!originalCode) || attachments.length > 0;
  const isValid = hasContent && category.length > 0;

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
      editComment(existingComment.id, {
        body,
        category,
        suggestion,
        ...(attachments.length ? { attachments } : {}),
      });
    } else {
      addComment(filePath, lineRange, body, category, suggestion, attachments.length ? attachments : undefined);
    }

    setBody('');
    setCategory(defaultCategory);
    setShowSuggestion(false);
    setProposedCode('');
    setAttachments([]);
    onSubmit?.();
  };

  const handleCancel = () => {
    setBody('');
    setCategory(defaultCategory);
    setShowSuggestion(false);
    setProposedCode('');
    setAttachments([]);
    onCancel();
  };

  return (
    <ComposerCore
      body={body}
      onBodyChange={setBody}
      attachments={attachments}
      setAttachments={setAttachments}
      placeholder='Add your review comment... (paste or drop images here)'
      headerLabel={lineRange ? (
        <span className='text-xs font-medium text-muted-foreground whitespace-nowrap'>
          {lineRange.start === lineRange.end
            ? `Comment on line ${lineRange.start}`
            : `Comment on lines ${lineRange.start} to ${lineRange.end}`}
        </span>
      ) : undefined}
      onSubmit={handleSubmit}
      testId='comment-input'
      actionsRef={actionsRef}
    >
      {showSuggestion && originalCode && (
        <SuggestionPanel
          originalCode={originalCode}
          proposedCode={proposedCode}
          onProposedChange={setProposedCode}
          onSubmit={handleSubmit}
        />
      )}

      <Separator />

      {/* Actions bar */}
      <div className='flex items-center justify-between px-3 py-2 bg-muted/10 outline-none' data-testid='comment-actions' tabIndex={-1} ref={actionsRef}>
        <div className='flex items-center gap-2'>
          <CategorySelector value={category} onChange={setCategory} />
          {originalCode && (
            <Button
              type='button'
              variant={showSuggestion ? 'secondary' : 'ghost'}
              size='sm'
              data-testid='add-suggestion-btn'
              onClick={() => {
                if (!showSuggestion && proposedCode.length === 0) {
                  setProposedCode(originalCode);
                }
                setShowSuggestion(!showSuggestion);
              }}
              className='h-7 gap-1.5 text-xs'
            >
              <Code2 className='h-3.5 w-3.5' />
              {showSuggestion ? 'Remove suggestion' : 'Suggest'}
            </Button>
          )}
          <AttachButton setAttachments={setAttachments} />
        </div>

        <div className='flex items-center gap-1.5'>
          <span className='text-[10px] text-muted-foreground/50 mr-0.5'>
            <kbd className='font-mono'>Esc</kbd> to unfocus
          </span>
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
    </ComposerCore>
  );
}
