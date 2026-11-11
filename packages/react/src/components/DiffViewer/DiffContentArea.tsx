import { useLocalization } from '../../localization/LocalizationContext';
import React, { useCallback } from 'react';
import type { DiffFile } from '@self-review/types';
import { Button } from '../ui/button';
import { AlertTriangle, Loader2 } from 'lucide-react';
import SplitView from './SplitView';
import UnifiedView from './UnifiedView';
import RenderedMarkdownView from './RenderedMarkdownView';
import RenderedImageView from './RenderedImageView';
import RenderedSvgView from './RenderedSvgView';
import { useOptionalSnapshotKey } from '../../context/ReviewContext';
import { useAdapter } from '../../context/ReviewAdapterContext';
import type { RenderedTextMode } from '../../utils/file-type-utils';
import type { ContentPreview } from './content-preview';
import { previewFromFlags } from './preview-compat';
import type { LazyLoadState } from './useLazyFileContent';

export interface PreviewContentAreaProps {
  preview: ContentPreview;
  file: DiffFile;
  filePath: string;
  viewMode: 'split' | 'unified';
  renderViewMode: 'raw' | 'rendered';
  /** On-demand content state; only meaningful while `file.contentLoaded === false`. */
  contentLoad: LazyLoadState;
  onRetry: () => void;
  commentRange: { start: number; end: number; side: 'old' | 'new' } | null;
  dragState: { startLine: number; currentLine: number; side: 'old' | 'new' } | null;
  onDragStart: (lineNumber: number, side: 'old' | 'new', keyboard?: boolean) => void;
  onCancelComment: () => void;
  onCommentSaved: () => void;
  onCommentRange: (start: number, end: number, side: 'old' | 'new') => void;
  isExpandable: boolean;
  expandLoading: boolean;
  totalLines: number | null;
  handleExpandContext: (
    direction: 'up' | 'down' | 'all',
    hunkIndex: number,
    position: 'top' | 'between' | 'bottom'
  ) => void;
}

/** Public 2.0.4 call forms are normalized here, before entering the content dispatcher. */
export interface DiffContentAreaProps extends Omit<PreviewContentAreaProps, 'preview'> {
  preview?: ContentPreview;
  isEligibleForRenderedView?: boolean;
  renderedTextMode?: RenderedTextMode | null;
  showImagePreview?: boolean;
  showSvgPreview?: boolean;
}
export function DiffContentArea({
  preview,
  isEligibleForRenderedView = false,
  renderedTextMode = null,
  showImagePreview = false,
  showSvgPreview = false,
  ...props
}: DiffContentAreaProps) {
  return (
    <PreviewContentArea
      {...props}
      preview={
        preview ??
        previewFromFlags({
          isEligibleForRenderedView,
          renderedTextMode,
          showImagePreview,
          showSvgPreview,
        })
      }
    />
  );
}

export function PreviewContentArea({
  preview,
  file,
  filePath,
  viewMode,
  renderViewMode,
  contentLoad,
  onRetry,
  commentRange,
  dragState,
  onDragStart,
  onCancelComment,
  onCommentSaved,
  onCommentRange,
  isExpandable,
  expandLoading,
  totalLines,
  handleExpandContext,
}: PreviewContentAreaProps) {
  const { t } = useLocalization();
  const adapter = useAdapter();
  const snapshotKey = useOptionalSnapshotKey();
  // Passed to rendered blocks through context; a stable identity keeps that value memoized.
  const handleGutterMouseDown = useCallback(
    (startLine: number, endLine: number) => {
      onCommentRange(startLine, endLine, 'new');
    },
    [onCommentRange]
  );

  // Listed without content on purpose (a safety budget): "No changes" would misstate why.
  if (file.omittedReason) {
    return (
      <div
        role='status'
        data-testid='content-omitted'
        className='m-3 flex items-start gap-2 text-sm text-muted-foreground p-3 border rounded'
      >
        <AlertTriangle className='h-4 w-4 mt-0.5 shrink-0' aria-hidden='true' />
        <p className='min-w-0 flex-1 break-words'>{file.omittedReason}</p>
      </div>
    );
  }

  if (
    contentLoad.kind === 'loading' ||
    (contentLoad.kind === 'idle' && file.contentLoaded === false)
  ) {
    return (
      <div
        role='status'
        className='flex items-center justify-center py-12 text-sm text-muted-foreground'
      >
        <Loader2 className='h-4 w-4 animate-spin mr-2' />
        {t('Loading file content...')}
      </div>
    );
  }

  if (contentLoad.kind === 'error') {
    return (
      <div
        role='alert'
        data-testid='content-load-error'
        className='m-3 flex items-start gap-2 text-destructive text-sm p-3 border border-destructive/20 rounded'
      >
        <AlertTriangle className='h-4 w-4 mt-0.5 shrink-0' aria-hidden='true' />
        <div className='min-w-0 flex-1 space-y-1'>
          <p>{t('The content of this file could not be loaded.')}</p>
          <p className='text-xs text-muted-foreground break-words'>{contentLoad.message}</p>
          <p className='text-xs text-muted-foreground'>
            {t(
              'Nothing will be requested again until you retry. If the review host stopped, restart it and then retry.'
            )}
          </p>
        </div>
        <Button variant='outline' size='sm' onClick={onRetry}>
          {t('Retry')}
        </Button>
      </div>
    );
  }

  const renderPreview =
    renderViewMode === 'rendered' &&
    preview.kind !== 'none' &&
    (preview.kind !== 'text' || (!file.isBinary && file.hunks.length > 0));
  if (renderPreview) {
    switch (preview.kind) {
      case 'image':
        return (
          <RenderedImageView
            key={snapshotKey}
            filePath={filePath}
            onLoadImage={adapter?.loadImage}
          />
        );
      case 'svg':
        return <RenderedSvgView file={file} />;
      case 'text':
        return (
          <RenderedMarkdownView
            file={file}
            contentMode={preview.mode}
            commentRange={commentRange}
            onCancelComment={onCancelComment}
            onCommentSaved={onCommentSaved}
            onGutterMouseDown={handleGutterMouseDown}
          />
        );
    }
  }

  if (file.isBinary) {
    return (
      <div className='flex items-center justify-center py-12 text-sm text-muted-foreground'>
        {t('Binary file \u2014 no diff available')}
      </div>
    );
  }

  if (file.hunks.length === 0 && file.contentLoaded !== false) {
    return (
      <div className='flex items-center justify-center py-12 text-sm text-muted-foreground'>
        {t('No changes to display')}
      </div>
    );
  }

  if (viewMode === 'split' && file.changeType !== 'added' && file.changeType !== 'deleted') {
    return (
      <SplitView
        file={file}
        commentRange={commentRange}
        dragState={dragState}
        onDragStart={onDragStart}
        onCancelComment={onCancelComment}
        onCommentSaved={onCommentSaved}
        onExpandContext={isExpandable ? handleExpandContext : undefined}
        isExpandable={isExpandable}
        expandLoading={expandLoading}
        totalLines={totalLines}
      />
    );
  }

  return (
    <UnifiedView
      file={file}
      commentRange={commentRange}
      dragState={dragState}
      onDragStart={onDragStart}
      onCancelComment={onCancelComment}
      onCommentSaved={onCommentSaved}
      onExpandContext={isExpandable ? handleExpandContext : undefined}
      isExpandable={isExpandable}
      expandLoading={expandLoading}
      totalLines={totalLines}
    />
  );
}
