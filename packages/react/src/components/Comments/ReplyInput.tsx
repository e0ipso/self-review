import React, { useState, useEffect, useRef } from 'react';
import type { Attachment, Reply } from '@self-review/types';
import { useReview } from '../../context/ReviewContext';
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
  const { addReply, updateReply } = useReview();
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (existingReply) {
      setBody(existingReply.body);
      if (existingReply.attachments) {
        setAttachments(existingReply.attachments);
      }
    }
  }, [existingReply]);

  const hasContent = body.trim().length > 0 || attachments.length > 0;

  const handleSubmit = () => {
    if (!hasContent) return;

    if (existingReply) {
      updateReply(commentId, existingReply.id, {
        body,
        ...(attachments.length ? { attachments } : {}),
      });
    } else {
      // `author` stays undefined: a reply composed in the UI is the human's.
      addReply(commentId, body, undefined, attachments.length ? attachments : undefined);
    }

    setBody('');
    setAttachments([]);
    onSubmit?.();
  };

  const handleCancel = () => {
    setBody('');
    setAttachments([]);
    onCancel();
  };

  return (
    <ComposerCore
      body={body}
      onBodyChange={setBody}
      attachments={attachments}
      setAttachments={setAttachments}
      placeholder='Reply to this comment... (paste or drop images here)'
      onSubmit={handleSubmit}
      testId='reply-input'
      actionsRef={actionsRef}
      height={REPLY_EDITOR_HEIGHT}
    >
      <Separator />

      {/* Actions bar */}
      <div className='flex items-center justify-between px-3 py-2 bg-muted/10 outline-none' data-testid='reply-actions' tabIndex={-1} ref={actionsRef}>
        <div className='flex items-center gap-2'>
          <AttachButton setAttachments={setAttachments} />
        </div>

        <div className='flex items-center gap-1.5'>
          <span className='text-[10px] text-muted-foreground/50 mr-0.5'>
            <kbd className='font-mono'>Esc</kbd> to unfocus
          </span>
          <Button
            data-testid='cancel-reply-btn'
            variant='ghost'
            size='sm'
            onClick={handleCancel}
            className='h-7 text-xs'
          >
            Cancel
          </Button>
          <Button
            data-testid='add-reply-btn'
            size='sm'
            onClick={handleSubmit}
            disabled={!hasContent}
            className='h-7 text-xs gap-1.5'
          >
            {existingReply ? 'Update' : 'Reply'}
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
