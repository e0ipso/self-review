import { useLocalization } from '../../localization/LocalizationContext';
import React from 'react';
import type { ReviewComment } from '@self-review/types';
import CommentDisplay from '../Comments/CommentDisplay';
import CommentInput from '../Comments/CommentInput';
import {
  PreviewContentArea,
  type DiffContentAreaProps,
  type PreviewContentAreaProps,
} from './DiffContentArea';
import { normalizePreviewProps } from './preview-compat';
import PreviewErrorBoundary from './PreviewErrorBoundary';

export interface FileSectionBodyProps {
  filePath: string;
  fileComments: ReviewComment[];
  orphanedComments?: ReviewComment[];
  showingFileComment: boolean;
  onCancelFileComment: () => void;
  onFileCommentSubmit: () => void;
  contentAreaProps: DiffContentAreaProps;
}

type PreviewFileSectionBodyProps = Omit<FileSectionBodyProps, 'contentAreaProps'> & {
  contentAreaProps: PreviewContentAreaProps;
};

export function FileSectionBody(props: PreviewFileSectionBodyProps): React.JSX.Element;
// Keep the legacy signature last so ComponentProps retains the original public property types.
export function FileSectionBody(props: FileSectionBodyProps): React.JSX.Element;
export function FileSectionBody({
  filePath,
  fileComments,
  orphanedComments = [],
  showingFileComment,
  onCancelFileComment,
  onFileCommentSubmit,
  contentAreaProps,
}: FileSectionBodyProps | PreviewFileSectionBodyProps) {
  const { t } = useLocalization();
  return (
    <div className='bg-background file-diff-content rounded-b-lg overflow-hidden'>
      {orphanedComments.length > 0 && (
        <section
          aria-label={t('Comments outside the current diff')}
          className='p-3 space-y-2 bg-amber-500/10 border-b border-border'
        >
          <h3 className='text-sm font-medium'>{t('Comments outside the current diff')}</h3>
          <p className='text-xs text-muted-foreground'>
            {t(
              'These recorded line ranges are not in the loaded diff. Their original locations are preserved when you save.'
            )}
          </p>
          {orphanedComments.map(comment => (
            <CommentDisplay key={comment.id} comment={comment} />
          ))}
        </section>
      )}

      {/* File-level comments */}
      {fileComments.length > 0 && (
        <div className='p-3 space-y-2 bg-muted/20 border-b border-border'>
          {fileComments.map(comment => (
            <CommentDisplay key={comment.id} comment={comment} />
          ))}
        </div>
      )}

      {/* File comment input */}
      {showingFileComment && (
        <div className='p-3 bg-muted/20 border-b border-border'>
          <CommentInput
            filePath={filePath}
            lineRange={null}
            onCancel={onCancelFileComment}
            onSubmit={onFileCommentSubmit}
          />
        </div>
      )}

      {/* A preview that throws is contained to this file; a view or content change retries it. */}
      <PreviewErrorBoundary
        filePath={filePath}
        resetKeys={[
          contentAreaProps.file,
          contentAreaProps.renderViewMode,
          contentAreaProps.viewMode,
        ]}
      >
        <PreviewContentArea {...normalizePreviewProps(contentAreaProps)} />
      </PreviewErrorBoundary>
    </div>
  );
}
