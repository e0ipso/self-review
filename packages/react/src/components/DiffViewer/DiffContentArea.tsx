import React from 'react';
import type { DiffFile } from '@self-review/core';
import { Button } from '../ui/button';
import { Loader2 } from 'lucide-react';
import SplitView from './SplitView';
import UnifiedView from './UnifiedView';
import RenderedMarkdownView from './RenderedMarkdownView';
import RenderedImageView from './RenderedImageView';
import RenderedSvgView from './RenderedSvgView';
import { useAdapter } from '../../context/ReviewAdapterContext';

export interface DiffContentAreaProps {
  file: DiffFile;
  filePath: string;
  viewMode: 'split' | 'unified';
  renderViewMode: 'raw' | 'rendered';
  isEligibleForRenderedView: boolean;
  showImagePreview: boolean;
  showSvgPreview: boolean;
  contentLoading: boolean;
  contentError: boolean;
  onRetry: () => void;
  commentRange: { start: number; end: number; side: 'old' | 'new' } | null;
  dragState: { startLine: number; currentLine: number; side: 'old' | 'new' } | null;
  onDragStart: (lineNumber: number, side: 'old' | 'new') => void;
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

export function DiffContentArea({
  file,
  filePath,
  viewMode,
  renderViewMode,
  isEligibleForRenderedView,
  showImagePreview,
  showSvgPreview,
  contentLoading,
  contentError,
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
}: DiffContentAreaProps) {
  const adapter = useAdapter();

  if (contentLoading) {
    return (
      <div className='flex items-center justify-center py-12 text-sm text-muted-foreground'>
        <Loader2 className='h-4 w-4 animate-spin mr-2' />
        Loading file content...
      </div>
    );
  }

  if (contentError) {
    return (
      <div className='flex flex-col items-center justify-center py-12 text-sm text-muted-foreground gap-2'>
        <span>Failed to load file content</span>
        <Button variant='outline' size='sm' onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }

  if (showImagePreview && renderViewMode === 'rendered') {
    return (
      <RenderedImageView
        filePath={filePath ?? ''}
        onLoadImage={adapter?.loadImage}
      />
    );
  }

  if (showSvgPreview && renderViewMode === 'rendered') {
    return <RenderedSvgView file={file} />;
  }

  if (file.isBinary) {
    return (
      <div className='flex items-center justify-center py-12 text-sm text-muted-foreground'>
        Binary file — no diff available
      </div>
    );
  }

  if (file.hunks.length === 0 && file.contentLoaded !== false) {
    return (
      <div className='flex items-center justify-center py-12 text-sm text-muted-foreground'>
        No changes to display
      </div>
    );
  }

  if (renderViewMode === 'rendered' && isEligibleForRenderedView) {
    return (
      <RenderedMarkdownView
        file={file}
        commentRange={commentRange}
        onCancelComment={onCancelComment}
        onCommentSaved={onCommentSaved}
        onGutterMouseDown={(startLine, endLine) => {
          onCommentRange(startLine, endLine, 'new');
        }}
      />
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
