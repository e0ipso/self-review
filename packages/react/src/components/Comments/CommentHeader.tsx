import React from 'react';
import type { ReviewComment, CommentSeverity, CommentConfidence } from '@self-review/types';
import { useLocalization, type MessageKey } from '../../localization/LocalizationContext';
import { useCategories } from '../../context/ConfigContext';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';
import { Pencil, Trash2, ChevronDown, ChevronUp, Bot, User } from 'lucide-react';

/**
 * Presentation for the thresholding signals carried by a comment. The values
 * are fixed by the XSD rather than configured, so unlike categories they use
 * fixed classes instead of a colour from config. Descriptions restate the
 * schema documentation, because these are exactly the values the human is
 * being asked to sanity-check.
 */
const SEVERITY_STYLES: Record<CommentSeverity, { className: string; description: MessageKey }> = {
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

const CONFIDENCE_STYLES: Record<CommentConfidence, { className: string; description: MessageKey }> =
  {
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
  styles?: { className: string; description: MessageKey };
  testId: string;
}) {
  const { t } = useLocalization();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant='secondary'
          className={`h-5 px-1.5 text-[10px] font-medium ${styles?.className ?? 'bg-muted text-muted-foreground'}`}
          data-testid={testId}
        >
          {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side='bottom'>{t(styles?.description ?? 'Unknown signal')}</TooltipContent>
    </Tooltip>
  );
}

type CommentMetadata = Pick<
  ReviewComment,
  'id' | 'author' | 'lineRange' | 'category' | 'severity' | 'confidence' | 'orphaned'
>;

/** Metadata and thread actions do not depend on the Markdown body or editor drafts. */
export function CommentHeader({
  comment,
  contentId,
  isCollapsed,
  anchorFullyVisible,
  onEdit,
  onDelete,
  onToggleCollapse,
}: {
  comment: CommentMetadata;
  contentId: string;
  isCollapsed: boolean;
  anchorFullyVisible: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleCollapse: () => void;
}) {
  const { t } = useLocalization();
  const categories = useCategories();
  const categoryDef = categories?.find(cat => cat.name === comment.category);
  return (
    <div className='flex items-center justify-between px-3 py-2'>
      <div className='flex items-center gap-2'>
        <Button
          variant='ghost'
          size='sm'
          onClick={onToggleCollapse}
          aria-expanded={!isCollapsed}
          aria-controls={contentId}
          className='h-5 w-5 p-0 -ms-1'
          data-testid={`comment-collapse-toggle-${comment.id}`}
        >
          {isCollapsed ? (
            <ChevronDown className='h-3.5 w-3.5' />
          ) : (
            <ChevronUp className='h-3.5 w-3.5' />
          )}
          <span className='sr-only'>{t(isCollapsed ? 'Expand' : 'Collapse')}</span>
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
              {t('You')}
            </>
          )}
        </span>
        {comment.lineRange && (
          <span className='text-[11px] text-muted-foreground'>
            {comment.lineRange.start === comment.lineRange.end
              ? t('line {line}', { line: comment.lineRange.start })
              : t('lines {start}–{end}', {
                  start: comment.lineRange.start,
                  end: comment.lineRange.end,
                })}
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
              <TooltipContent side='bottom'>{categoryDef.description}</TooltipContent>
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
            label={
              Object.prototype.hasOwnProperty.call(SEVERITY_STYLES, comment.severity)
                ? t(comment.severity)
                : String(comment.severity)
            }
            styles={SEVERITY_STYLES[comment.severity]}
            testId={`comment-severity-${comment.severity}`}
          />
        )}
        {comment.confidence && (
          <SignalBadge
            label={
              Object.prototype.hasOwnProperty.call(CONFIDENCE_STYLES, comment.confidence)
                ? t(`${comment.confidence} confidence`)
                : String(comment.confidence)
            }
            styles={CONFIDENCE_STYLES[comment.confidence]}
            testId={`comment-confidence-${comment.confidence}`}
          />
        )}
        {comment.orphaned && (
          <Badge
            variant='secondary'
            className='h-5 px-1.5 text-[10px] bg-orange-500/15 text-orange-600 dark:text-orange-400'
          >
            {t('Orphaned')}
          </Badge>
        )}
        {comment.lineRange && !anchorFullyVisible && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant='secondary'
                className='h-5 px-1.5 text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-400'
                data-testid='comment-anchor-partial'
              >
                {t('Partly hidden')}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side='bottom'>
              {t(
                'Some lines of this range are not in the loaded diff. The recorded original code is kept for its suggestion.'
              )}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      {!isCollapsed && (
        <div className='flex gap-0.5'>
          <div className='opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity'>
            <Button variant='ghost' size='sm' onClick={onEdit} className='h-6 w-6 p-0'>
              <Pencil className='h-3 w-3' />
              <span className='sr-only'>{t('Edit')}</span>
            </Button>
          </div>
          <Button
            variant='ghost'
            size='sm'
            onClick={onDelete}
            data-hint-action='delete-comment'
            className='h-6 w-6 p-0 text-muted-foreground hover:text-destructive'
          >
            <Trash2 className='h-3 w-3' />
            <span className='sr-only'>{t('Delete')}</span>
          </Button>
        </div>
      )}
    </div>
  );
}
