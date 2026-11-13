import { useLocalization } from '../../localization/LocalizationContext';
import React, { useRef } from 'react';
import type { LineRange, ReviewComment, Suggestion } from '@self-review/types';
import { useReviewCommands } from '../../context/review-session-hooks';
import { useCategories } from '../../context/ConfigContext';
import { isUsableCategory } from '../../utils/category-utils';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { Code2 } from 'lucide-react';
import { useReviewDraft } from '../../hooks/useReviewDraft';
import { DraftStatus } from './DraftStatus';
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
  const { t } = useLocalization();
  const { addComment, editComment } = useReviewCommands();
  const categories = useCategories();
  const defaultCategory = categories?.find(isUsableCategory)?.name ?? '';
  const editor = useReviewDraft(
    { filePath, lineRange, existingComment, originalCode },
    {
      body: existingComment?.body ?? '',
      category: existingComment?.category || defaultCategory,
      showSuggestion: !!existingComment?.suggestion,
      proposedCode: existingComment?.suggestion?.proposedCode ?? '',
      attachments: existingComment?.attachments ?? [],
    }
  );
  const {
    content: { body, category, showSuggestion, proposedCode, attachments },
    setBody,
    setCategory,
    setShowSuggestion,
    setProposedCode,
    setAttachments,
  } = editor;
  const location = editor.draft.target ?? editor.draft.location;
  const suggestionOriginal = location.originalCode;
  const actionsRef = useRef<HTMLDivElement>(null);

  const hasContent =
    body.trim().length > 0 || (showSuggestion && !!suggestionOriginal) || attachments.length > 0;
  const isValid = hasContent && category.length > 0;

  const handleSubmit = () => {
    if (!isValid || !editor.current() || editor.draft.pending || editor.draft.interrupted) return;

    const suggestion: Suggestion | null =
      showSuggestion && suggestionOriginal
        ? {
            originalCode: suggestionOriginal,
            proposedCode,
          }
        : null;

    if (location.existingComment) {
      // Always send `attachments`: editComment merges, so omitting it would keep the old list.
      editComment(location.existingComment.id, {
        ...(editor.draft.target ? { lineRange: location.lineRange } : {}),
        body,
        category,
        suggestion,
        attachments: attachments.length ? attachments : undefined,
      });
    } else {
      addComment(
        location.filePath,
        location.lineRange,
        body,
        category,
        suggestion,
        attachments.length ? attachments : undefined
      );
    }

    editor.clear();
    onSubmit?.();
  };

  const handleCancel = () => {
    editor.clear();
    onCancel();
  };

  return (
    <ComposerCore
      key={editor.draft.key}
      attachmentOwner={editor.draft.key}
      attachmentSignal={editor.draft.controller.signal}
      onAttachmentsAborted={editor.onAttachmentsAborted}
      onAttachmentWorkChange={editor.onProcessingChange}
      body={body}
      onBodyChange={setBody}
      attachments={attachments}
      setAttachments={setAttachments}
      placeholder={t('Add your review comment... (paste or drop images here)')}
      headerLabel={
        location.lineRange ? (
          <span className='text-xs font-medium text-muted-foreground whitespace-nowrap'>
            {location.lineRange.start === location.lineRange.end
              ? t('Comment on line {line}', { line: location.lineRange.start })
              : t('Comment on lines {start} to {end}', {
                  start: location.lineRange.start,
                  end: location.lineRange.end,
                })}
          </span>
        ) : undefined
      }
      onSubmit={handleSubmit}
      testId='comment-input'
      actionsRef={actionsRef}
    >
      <DraftStatus editor={editor} />
      {showSuggestion && suggestionOriginal && (
        <SuggestionPanel
          originalCode={suggestionOriginal}
          proposedCode={proposedCode}
          onProposedChange={setProposedCode}
          onSubmit={handleSubmit}
        />
      )}

      <Separator />

      {/* Actions bar */}
      <div
        className='flex items-center justify-between px-3 py-2 bg-muted/10 outline-none'
        data-testid='comment-actions'
        tabIndex={-1}
        ref={actionsRef}
      >
        <div className='flex items-center gap-2'>
          <CategorySelector value={category} onChange={setCategory} />
          {suggestionOriginal && (
            <Button
              type='button'
              variant={showSuggestion ? 'secondary' : 'ghost'}
              size='sm'
              data-testid='add-suggestion-btn'
              onClick={() => {
                if (!showSuggestion && proposedCode.length === 0) {
                  setProposedCode(suggestionOriginal);
                }
                setShowSuggestion(!showSuggestion);
              }}
              className='h-7 gap-1.5 text-xs'
            >
              <Code2 className='h-3.5 w-3.5' />
              {t(showSuggestion ? 'Remove suggestion' : 'Suggest')}
            </Button>
          )}
          <AttachButton setAttachments={setAttachments} />
        </div>

        <div className='flex items-center gap-1.5'>
          <span className='text-[10px] text-muted-foreground/50 me-0.5'>{t('Esc to unfocus')}</span>
          <Button
            data-testid='cancel-comment-btn'
            data-hint-action='cancel-comment'
            variant='ghost'
            size='sm'
            onClick={handleCancel}
            className='h-7 text-xs'
          >
            {t('Cancel')}
          </Button>
          <Button
            data-testid='add-comment-btn'
            data-hint-action='submit-comment'
            size='sm'
            onClick={handleSubmit}
            disabled={
              !isValid || editor.draft.pending || editor.draft.stale || editor.draft.interrupted
            }
            className='h-7 text-xs gap-1.5'
          >
            {t(location.existingComment ? 'Update' : 'Comment')}
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
