import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ReviewComment } from '../../../shared/types';
import { useReview } from '../../context/ReviewContext';
import { useConfig } from '../../context/ConfigContext';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';
import { Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import CommentInput from './CommentInput';
import SuggestionBlock from './SuggestionBlock';

export interface CommentDisplayProps {
  comment: ReviewComment;
  originalCode?: string;
}

export default function CommentDisplay({ comment, originalCode: originalCodeProp }: CommentDisplayProps) {
  const { deleteComment } = useReview();
  const { config } = useConfig();
  const [isEditing, setIsEditing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

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
      className='rounded-lg border border-border bg-card text-sm group'
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
          <span className='text-xs font-semibold text-foreground'>You</span>
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
          <div className='flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity'>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => setIsEditing(true)}
              className='h-6 w-6 p-0'
            >
              <Pencil className='h-3 w-3' />
              <span className='sr-only'>Edit</span>
            </Button>
            <Button
              variant='ghost'
              size='sm'
              onClick={handleDelete}
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
          <div className='px-3 pb-3 text-sm text-foreground leading-relaxed [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_pre]:my-2 [&_pre]:p-3 [&_pre]:bg-muted [&_pre]:rounded-md [&_pre]:overflow-x-auto [&_code]:text-[0.85em] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:bg-muted [&_h1]:text-base [&_h1]:font-bold [&_h1]:my-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:my-2 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:my-2 [&_a]:text-blue-600 [&_a]:underline dark:[&_a]:text-blue-400 [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_hr]:my-2 [&_hr]:border-border [&_pre_code]:bg-transparent [&_pre_code]:p-0'>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
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
        </>
      )}
    </div>
  );
}
