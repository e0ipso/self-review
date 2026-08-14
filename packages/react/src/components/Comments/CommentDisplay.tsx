import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type {
  ReviewComment,
  CommentSeverity,
  CommentConfidence,
} from '@self-review/types';
import { useReview } from '../../context/ReviewContext';
import { useConfig } from '../../context/ConfigContext';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';
// `Reply` is aliased because the identifier is also the reply *type* exported
// by @self-review/types, which this file's thread markup talks about.
import { Pencil, Trash2, ChevronDown, ChevronUp, Bot, User, Reply as ReplyIcon } from 'lucide-react';
import CommentInput from './CommentInput';
import ReplyInput from './ReplyInput';
import ReplyDisplay, { PROSE_CLASSES } from './ReplyDisplay';
import SuggestionBlock from './SuggestionBlock';
import { remarkEmoji } from '../../utils/remark-emoji';
import { AttachmentImage } from './AttachmentImage';

export interface CommentDisplayProps {
  comment: ReviewComment;
  originalCode?: string;
}

/**
 * Presentation for the thresholding signals carried by a comment. The values
 * are fixed by the XSD rather than configured, so unlike categories they use
 * fixed classes instead of a colour from config. Descriptions restate the
 * schema documentation, because these are exactly the values the human is
 * being asked to sanity-check.
 */
const SEVERITY_STYLES: Record<CommentSeverity, { className: string; description: string }> = {
  critical: {
    className: 'bg-red-500/15 text-red-600 dark:text-red-400',
    description: 'Critical: data loss, a security hole, or a crash on a path real usage reaches.',
  },
  major: {
    className: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
    description: 'Major: wrong behaviour or a broken contract on a path real usage reaches.',
  },
  minor: {
    className: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400',
    description: 'Minor: real but bounded. Behaviour is correct today.',
  },
  info: {
    className: 'bg-muted text-muted-foreground',
    description: 'Info: no defect. Style, naming, a question, or a note.',
  },
};

const CONFIDENCE_STYLES: Record<CommentConfidence, { className: string; description: string }> = {
  high: {
    className: 'bg-muted text-muted-foreground',
    description: 'High confidence: traceable from the diff, no unverified assumption needed.',
  },
  medium: {
    className: 'bg-muted text-muted-foreground',
    description: 'Medium confidence: rests on one assumption the author did not verify.',
  },
  low: {
    className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
    description: 'Low confidence: speculative. Worth your eyes, not worth acting on unattended.',
  },
};

function SignalBadge({
  label,
  styles,
  testId,
}: {
  label: string;
  styles: { className: string; description: string };
  testId: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant='secondary'
          className={`h-5 px-1.5 text-[10px] font-medium ${styles.className}`}
          data-testid={testId}
        >
          {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side='bottom'>{styles.description}</TooltipContent>
    </Tooltip>
  );
}

export default function CommentDisplay({ comment, originalCode: originalCodeProp }: CommentDisplayProps) {
  const { deleteComment } = useReview();
  const { config } = useConfig();
  const [isEditing, setIsEditing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isReplying, setIsReplying] = useState(false);

  const categoryDef = config.categories?.find(
    cat => cat.name === comment.category
  );

  // Listen for global collapse/expand all events
  useEffect(() => {
    const handleToggleAllComments = (event: Event) => {
      const customEvent = event as CustomEvent<{ collapsed: boolean }>;
      setIsCollapsed(customEvent.detail.collapsed);
    };

    document.addEventListener('toggle-all-comments', handleToggleAllComments);
    return () => {
      document.removeEventListener(
        'toggle-all-comments',
        handleToggleAllComments
      );
    };
  }, []);

  const handleDelete = () => {
    deleteComment(comment.id);
  };

  const handleEditComplete = () => {
    setIsEditing(false);
  };

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const originalCode = originalCodeProp ?? comment.suggestion?.originalCode;

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
      className='rounded-lg border border-foreground/15 bg-card text-sm group shadow-sm'
      data-testid={`comment-${comment.id}`}
    >
      <div className='flex items-center justify-between px-3 py-2'>
        <div className='flex items-center gap-2'>
          <Button
            variant='ghost'
            size='sm'
            onClick={toggleCollapse}
            className='h-5 w-5 p-0 -ml-1'
            data-testid={`comment-collapse-toggle-${comment.id}`}
          >
            {isCollapsed ? (
              <ChevronDown className='h-3.5 w-3.5' />
            ) : (
              <ChevronUp className='h-3.5 w-3.5' />
            )}
            <span className='sr-only'>
              {isCollapsed ? 'Expand' : 'Collapse'}
            </span>
          </Button>
          <span className='flex items-center gap-1 text-xs font-semibold text-foreground max-w-[200px] truncate'>
            {comment.author ? (
              <>
                <Bot className='h-3.5 w-3.5 shrink-0' />
                {comment.author}
              </>
            ) : (
              <>
                <User className='h-3.5 w-3.5 shrink-0' />
                You
              </>
            )}
          </span>
          {comment.lineRange && (
            <span className='text-[11px] text-muted-foreground'>
              {comment.lineRange.start === comment.lineRange.end
                ? `line ${comment.lineRange.start}`
                : `lines ${comment.lineRange.start}\u2013${comment.lineRange.end}`}
            </span>
          )}
          {comment.category &&
            (categoryDef ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant='secondary'
                    className='category-badge h-5 px-1.5 text-[10px] font-medium'
                    style={{
                      backgroundColor: `${categoryDef.color}20`,
                      color: categoryDef.color,
                      borderColor: `${categoryDef.color}40`,
                      borderWidth: '1px',
                    }}
                  >
                    {comment.category}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side='bottom'>
                  {categoryDef.description}
                </TooltipContent>
              </Tooltip>
            ) : (
              <Badge
                variant='secondary'
                className='category-badge h-5 px-1.5 text-[10px] font-medium'
                style={{ borderWidth: '1px' }}
              >
                {comment.category}
              </Badge>
            ))}
          {comment.severity && (
            <SignalBadge
              label={comment.severity}
              styles={SEVERITY_STYLES[comment.severity]}
              testId={`comment-severity-${comment.severity}`}
            />
          )}
          {comment.confidence && (
            <SignalBadge
              label={`${comment.confidence} confidence`}
              styles={CONFIDENCE_STYLES[comment.confidence]}
              testId={`comment-confidence-${comment.confidence}`}
            />
          )}
          {comment.orphaned && (
            <Badge
              variant='secondary'
              className='h-5 px-1.5 text-[10px] bg-orange-500/15 text-orange-600 dark:text-orange-400'
            >
              Orphaned
            </Badge>
          )}
        </div>
        {!isCollapsed && (
          <div className='flex gap-0.5'>
            <div className='opacity-0 group-hover:opacity-100 transition-opacity'>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => setIsEditing(true)}
                className='h-6 w-6 p-0'
              >
                <Pencil className='h-3 w-3' />
                <span className='sr-only'>Edit</span>
              </Button>
            </div>
            <Button
              variant='ghost'
              size='sm'
              onClick={handleDelete}
              data-hint-action='delete-comment'
              className='h-6 w-6 p-0 text-muted-foreground hover:text-destructive'
            >
              <Trash2 className='h-3 w-3' />
              <span className='sr-only'>Delete</span>
            </Button>
          </div>
        )}
      </div>

      {!isCollapsed && (
        <>
          <div className={`px-3 pb-3 text-sm text-foreground leading-relaxed ${PROSE_CLASSES}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkEmoji]}>
              {comment.body}
            </ReactMarkdown>
          </div>

          {comment.suggestion && (
            <div className='px-3 pb-3'>
              <SuggestionBlock
                suggestion={comment.suggestion}
                language='typescript'
              />
            </div>
          )}

          {comment.attachments && comment.attachments.length > 0 && (
            <div className='flex gap-2 flex-wrap px-3 pb-3'>
              {comment.attachments.map((att) => (
                <AttachmentImage key={att.id} attachment={att} />
              ))}
            </div>
          )}

          {/*
            The thread lives inside the `!isCollapsed` fragment on purpose: the
            chevron toggle and the global `toggle-all-comments` event then hide
            replies with the rest of the comment body, with no extra wiring.
          */}
          {comment.replies && comment.replies.length > 0 && (
            <div
              className='ml-4 border-l-2 border-border/60'
              data-testid={`thread-${comment.id}`}
            >
              {comment.replies.map((reply) => (
                <ReplyDisplay
                  key={reply.id}
                  commentId={comment.id}
                  reply={reply}
                />
              ))}
            </div>
          )}

          {isReplying ? (
            <div className='ml-4 px-3 pb-3 pt-2'>
              <ReplyInput
                commentId={comment.id}
                onCancel={() => setIsReplying(false)}
                onSubmit={() => setIsReplying(false)}
              />
            </div>
          ) : (
            <div className='px-3 pb-3'>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => setIsReplying(true)}
                data-testid={`reply-btn-${comment.id}`}
                className='h-7 gap-1.5 text-xs text-muted-foreground'
              >
                <ReplyIcon className='h-3.5 w-3.5' />
                Reply
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
