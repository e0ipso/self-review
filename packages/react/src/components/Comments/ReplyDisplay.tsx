import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Reply } from '@self-review/types';
import { useReview } from '../../context/ReviewContext';
import { Button } from '../ui/button';
import { Pencil, Trash2, Bot, User } from 'lucide-react';
import ReplyInput from './ReplyInput';
import { remarkEmoji } from '../../utils/remark-emoji';
import { AttachmentImage } from './AttachmentImage';

/**
 * Markdown body styling shared by a comment body and a reply body. A reply is
 * the same prose in the same gutter, so it must render identically; the string
 * lives here rather than in `CommentDisplay` only to keep the import direction
 * `CommentDisplay -> ReplyDisplay` acyclic.
 */
export const PROSE_CLASSES =
  '[&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_pre]:my-2 [&_pre]:p-3 [&_pre]:bg-muted [&_pre]:rounded-md [&_pre]:overflow-x-auto [&_code]:text-[0.85em] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:bg-muted [&_h1]:text-base [&_h1]:font-bold [&_h1]:my-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:my-2 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:my-2 [&_a]:text-blue-600 [&_a]:underline dark:[&_a]:text-blue-400 [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_hr]:my-2 [&_hr]:border-border [&_pre_code]:bg-transparent [&_pre_code]:p-0';

export interface ReplyDisplayProps {
  commentId: string;
  reply: Reply;
}

/**
 * One conversation turn under a comment.
 *
 * Deliberately thin: no category, severity, confidence or suggestion, because
 * all four belong to the finding and the finding is the root comment. Edit and
 * delete are ungated exactly as they are on root comments — the human owns the
 * document, whoever authored the turn.
 */
export default function ReplyDisplay({ commentId, reply }: ReplyDisplayProps) {
  const { deleteReply } = useReview();
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <ReplyInput
        commentId={commentId}
        existingReply={reply}
        onCancel={() => setIsEditing(false)}
        onSubmit={() => setIsEditing(false)}
      />
    );
  }

  return (
    <div
      // A *named* group: the comment container above is a bare `group`, so an
      // unnamed group here would reveal every reply's controls at once.
      className='group/reply border-t border-border/50 pt-2'
      data-testid={`reply-${reply.id}`}
    >
      <div className='flex items-center justify-between px-3'>
        <span className='flex items-center gap-1 text-xs font-semibold text-foreground max-w-[200px] truncate'>
          {reply.author ? (
            <>
              <Bot className='h-3.5 w-3.5 shrink-0' />
              {reply.author}
            </>
          ) : (
            <>
              <User className='h-3.5 w-3.5 shrink-0' />
              You
            </>
          )}
        </span>
        <div className='flex gap-0.5 opacity-0 group-hover/reply:opacity-100 transition-opacity'>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => setIsEditing(true)}
            data-testid={`edit-reply-btn-${reply.id}`}
            className='h-6 w-6 p-0'
          >
            <Pencil className='h-3 w-3' />
            <span className='sr-only'>Edit reply</span>
          </Button>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => deleteReply(commentId, reply.id)}
            data-testid={`delete-reply-btn-${reply.id}`}
            className='h-6 w-6 p-0 text-muted-foreground hover:text-destructive'
          >
            <Trash2 className='h-3 w-3' />
            <span className='sr-only'>Delete reply</span>
          </Button>
        </div>
      </div>

      <div className={`px-3 pb-2 text-sm text-foreground leading-relaxed ${PROSE_CLASSES}`}>
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkEmoji]}>
          {reply.body}
        </ReactMarkdown>
      </div>

      {reply.attachments && reply.attachments.length > 0 && (
        <div className='flex gap-2 flex-wrap px-3 pb-2'>
          {reply.attachments.map((att) => (
            <AttachmentImage key={att.id} attachment={att} />
          ))}
        </div>
      )}
    </div>
  );
}
