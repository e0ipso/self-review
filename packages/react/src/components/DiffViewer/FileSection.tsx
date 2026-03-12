import React, { useState, useEffect, useRef } from 'react';
import { useDragSelection } from './useDragSelection';
import { useExpandContext } from './useExpandContext';
import type { DiffFile } from '@self-review/types';
import { useReview } from '../../context/ReviewContext';
import { useAdapter } from '../../context/ReviewAdapterContext';
import { isPreviewableImage, isPreviewableSvg } from '../../utils/file-type-utils';
import { FileSectionHeader } from './FileSectionHeader';
import { FileSectionBody } from './FileSectionBody';

export interface FileSectionProps {
  file: DiffFile;
  viewMode: 'split' | 'unified';
  expanded?: boolean;
  onToggleExpanded?: (filePath: string) => void;
}

export default function FileSection({
  file,
  viewMode,
  expanded: controlledExpanded,
  onToggleExpanded,
}: FileSectionProps) {
  const { toggleViewed, getCommentsForFile, files, diffSource, updateFileHunks } = useReview();
  const adapter = useAdapter();
  const [internalExpanded, setInternalExpanded] = useState(true);
  const expanded =
    controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  const [commentRange, setCommentRange] = useState<{
    start: number;
    end: number;
    side: 'old' | 'new';
  } | null>(null);
  const [showingFileComment, setShowingFileComment] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  const isAddedFile = file.changeType === 'added';
  const filePath_ = file.newPath || file.oldPath || '';
  const showImagePreview = isAddedFile && file.isBinary === true && isPreviewableImage(filePath_);
  const showSvgPreview = isAddedFile && isPreviewableSvg(filePath_);
  const isEligibleForRenderedView = isAddedFile && /\.(md|markdown)$/i.test(filePath_);
  const isPreviewable = showImagePreview || showSvgPreview || isEligibleForRenderedView;

  const initialViewMode = isPreviewable ? 'rendered' : 'raw';
  const [renderViewMode, setRenderViewMode] = useState<'raw' | 'rendered'>(initialViewMode);

  const filePath = file.newPath || file.oldPath;
  const comments = getCommentsForFile(filePath);
  const fileComments = comments.filter(c => c.lineRange === null);
  const fileState = files.find(f => f.path === filePath);
  const isViewed = fileState?.viewed || false;

  // Lazy content loading state (for large-payload mode)
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState(false);

  useEffect(() => {
    if (!expanded || file.contentLoaded !== false || contentLoading) return;
    if (!adapter?.loadFileContent) return;

    setContentLoading(true);
    setContentError(false);

    adapter.loadFileContent(filePath).then(hunks => {
      if (hunks) {
        updateFileHunks(filePath, hunks);
      } else {
        setContentError(true);
      }
      setContentLoading(false);
    }).catch(() => {
      setContentError(true);
      setContentLoading(false);
    });
  }, [expanded, file.contentLoaded, contentLoading, filePath, updateFileHunks, adapter]);

  // Expand context state
  const isExpandable = diffSource.type === 'git' && !file.isUntracked && !file.isBinary;

  const { expandLoading, totalLines, handleExpandContext } = useExpandContext({
    file,
    filePath,
    isExpandable,
    sectionRef,
  });

  // Effective view mode: added/deleted files are forced to unified view
  const effectiveViewMode = viewMode === 'split' && (file.changeType === 'added' || file.changeType === 'deleted')
    ? 'unified'
    : viewMode;

  const handleCommentRange = (start: number, end: number, side: 'old' | 'new') => {
    setCommentRange({
      start: Math.min(start, end),
      end: Math.max(start, end),
      side,
    });
  };

  const { dragState, handleDragStart } = useDragSelection({
    sectionRef,
    effectiveViewMode,
    file,
    filePath,
    onCommentRange: handleCommentRange,
  });

  // Sync viewed state with expansion: when viewed is checked, collapse the file
  useEffect(() => {
    if (isViewed && expanded && onToggleExpanded) {
      onToggleExpanded(filePath);
    }
  }, [isViewed]);

  const handleViewedToggle = () => {
    toggleViewed(filePath);
    if (!isViewed && expanded && onToggleExpanded) {
      onToggleExpanded(filePath);
    }
    if (isViewed && !expanded && onToggleExpanded) {
      onToggleExpanded(filePath);
    }
  };

  return (
    <div
      ref={sectionRef}
      className={`border-b border-border${dragState ? ' select-none' : ''}`}
      data-file-path={filePath}
      data-testid={`file-section-${filePath}`}
    >
      <FileSectionHeader
        file={file}
        filePath={filePath}
        expanded={expanded}
        isViewed={isViewed}
        isPreviewable={isPreviewable}
        renderViewMode={renderViewMode}
        comments={comments}
        onToggle={() => {
          if (onToggleExpanded) {
            onToggleExpanded(filePath);
          } else {
            setInternalExpanded(!expanded);
          }
        }}
        onViewedToggle={handleViewedToggle}
        onAddFileComment={() => setShowingFileComment(true)}
        onRenderViewModeChange={setRenderViewMode}
      />

      {expanded && (
        <FileSectionBody
          filePath={filePath}
          fileComments={fileComments}
          showingFileComment={showingFileComment}
          onCancelFileComment={() => setShowingFileComment(false)}
          onFileCommentSubmit={() => setShowingFileComment(false)}
          contentAreaProps={{
            file,
            filePath,
            viewMode: effectiveViewMode,
            renderViewMode,
            isEligibleForRenderedView,
            showImagePreview,
            showSvgPreview,
            contentLoading,
            contentError,
            onRetry: () => setContentError(false),
            commentRange,
            dragState,
            onDragStart: handleDragStart,
            onCancelComment: () => setCommentRange(null),
            onCommentSaved: () => setCommentRange(null),
            onCommentRange: handleCommentRange,
            isExpandable,
            expandLoading,
            totalLines,
            handleExpandContext,
          }}
        />
      )}
    </div>
  );
}
