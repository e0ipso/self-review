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

/** Legacy contentAreaProps remain supported; prefer the preview discriminator overload. */
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
/** @deprecated Pass preview-based contentAreaProps for new compositions. */
// Keep the legacy signature last so ComponentProps retains the original public property types.
export function FileSectionBody(props: FileSectionBodyProps): React.JSX.Element;
export function FileSectionBody({
  contentAreaProps,
  ...props
}: FileSectionBodyProps | PreviewFileSectionBodyProps) {
  return (
    <FileSectionBodyLayout {...props}>
      <PreviewErrorBoundary
        filePath={props.filePath}
        resetKeys={[
          contentAreaProps.file,
          contentAreaProps.renderViewMode,
          contentAreaProps.viewMode,
        ]}
      >
        <PreviewContentArea {...normalizePreviewProps(contentAreaProps)} />
      </PreviewErrorBoundary>
    </FileSectionBodyLayout>
  );
}

/** Internal arrangement depends only on its comments and a content slot. */
export function FileSectionBodyLayout({
  filePath,
  fileComments,
  orphanedComments = [],
  showingFileComment,
  onCancelFileComment,
  onFileCommentSubmit,
  children,
}: Omit<FileSectionBodyProps, 'contentAreaProps'> & { children: React.ReactNode }) {
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

      {children}
    </div>
  );
}
