import { useLocalization } from '../../localization/LocalizationContext';
import React, { useId } from 'react';
import ReactMarkdown from 'react-markdown';
import { localContentUrlTransform, rehypePassiveContent } from '../../utils/passive-content';
import { ReviewedImage, ReviewedMedia } from '../ReviewedMedia/ReviewedImage';
import remarkGfm from 'remark-gfm';
import type { ReviewComment } from '@self-review/types';
import { Button } from '../ui/button';
import { Reply as ReplyIcon } from 'lucide-react';
import { CommentHeader } from './CommentHeader';
import { useCommentThread } from './useCommentThread';
import CommentInput from './CommentInput';
import ReplyInput from './ReplyInput';
import ReplyDisplay, { PROSE_CLASSES } from './ReplyDisplay';
import SuggestionBlock from './SuggestionBlock';
import { remarkEmoji } from '../../utils/remark-emoji';
import { AttachmentImage } from './AttachmentImage';

export interface CommentDisplayProps {
  comment: ReviewComment;
  /** Code currently visible for the comment's range; replaces a recorded original when given. */
  originalCode?: string;
  /** False when part of the range is in a gap between hunks: keeps the recorded original, marks it. */
  anchorFullyVisible?: boolean;
}

export default function CommentDisplay({
  comment,
  originalCode: originalCodeProp,
  anchorFullyVisible = true,
}: CommentDisplayProps) {
  const { t } = useLocalization();
  const contentId = useId();
  const {
    isEditing,
    startEditing,
    finishEditing,
    isReplying,
    startReplying,
    finishReplying,
    isCollapsed,
    toggleCollapse,
    deleteThread,
  } = useCommentThread(comment.id);

  const originalCode = originalCodeProp ?? comment.suggestion?.originalCode;

  if (isEditing) {
    return (
      <CommentInput
        filePath={comment.filePath}
        lineRange={comment.lineRange}
        onCancel={finishEditing}
        onSubmit={finishEditing}
        existingComment={comment}
        originalCode={originalCode}
      />
    );
  }

  return (
    <div
      className='rounded-lg border border-foreground/15 bg-card text-sm group shadow-sm'
      data-testid={`comment-${comment.id}`}
    >
      <CommentHeader
        comment={comment}
        contentId={contentId}
        isCollapsed={isCollapsed}
        anchorFullyVisible={anchorFullyVisible}
        onEdit={startEditing}
        onDelete={deleteThread}
        onToggleCollapse={toggleCollapse}
      />

      <ReviewedMedia documentPath={comment.filePath || undefined}>
        <div id={contentId} hidden={isCollapsed}>
          <div className={`px-3 pb-3 text-sm text-foreground leading-relaxed ${PROSE_CLASSES}`}>
            <ReactMarkdown
              urlTransform={localContentUrlTransform}
              remarkPlugins={[remarkGfm, remarkEmoji]}
              rehypePlugins={[rehypePassiveContent]}
              components={{ img: ReviewedImage }}
            >
              {comment.body}
            </ReactMarkdown>
          </div>

          {comment.suggestion && (
            <div className='px-3 pb-3'>
              <SuggestionBlock
                suggestion={comment.suggestion}
                language='typescript'
                filePath={comment.filePath}
                lineRange={comment.lineRange}
              />
            </div>
          )}

          {comment.attachments && comment.attachments.length > 0 && (
            <div className='flex gap-2 flex-wrap px-3 pb-3'>
              {comment.attachments.map(att => (
                <AttachmentImage key={att.id} attachment={att} />
              ))}
            </div>
          )}

          {/* Keep thread editors and Apply state mounted while disclosure hides the region. */}
          {comment.replies && comment.replies.length > 0 && (
            <div className='ms-4 border-s-2 border-border/60' data-testid={`thread-${comment.id}`}>
              {comment.replies.map(reply => (
                <ReplyDisplay key={reply.id} commentId={comment.id} reply={reply} />
              ))}
            </div>
          )}

          {isReplying ? (
            <div className='ms-4 px-3 pb-3 pt-2'>
              <ReplyInput
                commentId={comment.id}
                onCancel={finishReplying}
                onSubmit={finishReplying}
              />
            </div>
          ) : (
            <div className='px-3 pb-3'>
              <Button
                variant='ghost'
                size='sm'
                onClick={startReplying}
                data-testid={`reply-btn-${comment.id}`}
                className='h-7 gap-1.5 text-xs text-muted-foreground'
              >
                <ReplyIcon className='h-3.5 w-3.5' />
                {t('Reply')}
              </Button>
            </div>
          )}
        </div>
      </ReviewedMedia>
    </div>
  );
}
