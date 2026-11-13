import { useLocalization } from '../../localization/LocalizationContext';
import React, { useRef } from 'react';
import type { Reply } from '@self-review/types';
import { useReviewCommands } from '../../context/review-session-hooks';
import { useReviewDraft } from '../../hooks/useReviewDraft';
import { DraftStatus } from './DraftStatus';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { ComposerCore, AttachButton } from './ComposerCore';

/** Replies are conversational and short, so the editor is shorter too. */
const REPLY_EDITOR_HEIGHT = 160;

export interface ReplyInputProps {
  commentId: string;
  existingReply?: Reply;
  onCancel: () => void;
  onSubmit?: () => void;
}

export default function ReplyInput({
  commentId,
  existingReply,
  onCancel,
  onSubmit,
}: ReplyInputProps) {
  const { t } = useLocalization();
  const { addReply, updateReply } = useReviewCommands();
  const editor = useReviewDraft(
    { filePath: '', lineRange: null, commentId, existingReply },
    {
      body: existingReply?.body ?? '',
      category: '',
      showSuggestion: false,
      proposedCode: '',
      attachments: existingReply?.attachments ?? [],
    }
  );
  const {
    content: { body, attachments },
    setBody,
    setAttachments,
  } = editor;
  const actionsRef = useRef<HTMLDivElement>(null);

  const hasContent = body.trim().length > 0 || attachments.length > 0;

  const handleSubmit = () => {
    if (!hasContent || !editor.current() || editor.draft.pending || editor.draft.interrupted)
      return;

    if (existingReply) {
      updateReply(commentId, existingReply.id, {
        body,
        attachments: attachments.length ? attachments : undefined,
      });
    } else {
      // `author` stays undefined: a reply composed in the UI is the human's.
      addReply(commentId, body, undefined, attachments.length ? attachments : undefined);
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
      placeholder={t('Reply to this comment... (paste or drop images here)')}
      onSubmit={handleSubmit}
      testId='reply-input'
      actionsRef={actionsRef}
      height={REPLY_EDITOR_HEIGHT}
    >
      <DraftStatus editor={editor} />
      <Separator />

      {/* Actions bar */}
      <div
        className='flex items-center justify-between px-3 py-2 bg-muted/10 outline-none'
        data-testid='reply-actions'
        tabIndex={-1}
        ref={actionsRef}
      >
        <div className='flex items-center gap-2'>
          <AttachButton setAttachments={setAttachments} />
        </div>

        <div className='flex items-center gap-1.5'>
          <span className='text-[10px] text-muted-foreground/50 me-0.5'>{t('Esc to unfocus')}</span>
          <Button
            data-testid='cancel-reply-btn'
            variant='ghost'
            size='sm'
            onClick={handleCancel}
            className='h-7 text-xs'
          >
            {t('Cancel')}
          </Button>
          <Button
            data-testid='add-reply-btn'
            size='sm'
            onClick={handleSubmit}
            disabled={
              !hasContent || editor.draft.pending || editor.draft.stale || editor.draft.interrupted
            }
            className='h-7 text-xs gap-1.5'
          >
            {t(existingReply ? 'Update' : 'Reply')}
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
