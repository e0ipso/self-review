import React from 'react';
import type { DiffFile } from '@self-review/types';
import type { RenderedTextMode } from '../../utils/file-type-utils';
import type { ContentPreview } from '../../services/content-preview';
import type { LazyLoadState } from './useLazyFileContent';
import { normalizePreviewProps } from './preview-compat';
import { ContentStatusBoundary } from './ContentStatusBoundary';
import { FilePreview } from './FilePreview';
import { RawDiffContent } from './RawDiffContent';

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

/** @deprecated Prefer PreviewContentArea with one preview discriminator. Legacy flags remain supported. */
export interface DiffContentAreaProps extends Omit<PreviewContentAreaProps, 'preview'> {
  preview?: ContentPreview;
  isEligibleForRenderedView: boolean;
  renderedTextMode: RenderedTextMode | null;
  showImagePreview: boolean;
  showSvgPreview: boolean;
}
export function DiffContentArea(props: DiffContentAreaProps) {
  return <PreviewContentArea {...normalizePreviewProps(props)} />;
}

/** Compatibility boundary: broad public props are distributed to focused content branches here. */
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
  return (
    <ContentStatusBoundary
      omittedReason={file.omittedReason}
      contentLoaded={file.contentLoaded}
      contentLoad={contentLoad}
      onRetry={onRetry}
    >
      <FilePreview
        file={file}
        filePath={filePath}
        preview={preview}
        mode={renderViewMode}
        commentRange={commentRange}
        onCommentRange={onCommentRange}
        onCancelComment={onCancelComment}
        onCommentSaved={onCommentSaved}
      >
        <RawDiffContent
          file={file}
          viewMode={viewMode}
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
      </FilePreview>
    </ContentStatusBoundary>
  );
}
