import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useDragSelection } from './useDragSelection';
import { useExpandContext } from './useExpandContext';
import type { DiffFile } from '@self-review/types';
import { useReview } from '../../context/ReviewContext';
import { useAdapter } from '../../context/ReviewAdapterContext';
import { useGuide } from '../../context/GuideContext';
import { useOptionalDiffNavigation } from '../../context/DiffNavigationContext';
import {
  getRenderedTextMode,
  isPreviewableImage,
  isPreviewableSvg,
} from '../../utils/file-type-utils';
import { getGuideAccent } from '../../utils/guide-accents';
import { FileSectionHeader } from './FileSectionHeader';
import { FileSectionBody } from './FileSectionBody';
import { createCommentAnchorMatcher } from '../../utils/comment-anchors';

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
  const { mode: guideMode, getFileDescription, getFileGroupIndex } = useGuide();
  const [internalExpanded, setInternalExpanded] = useState(true);
  const expanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  const [commentRange, setCommentRange] = useState<{
    start: number;
    end: number;
    side: 'old' | 'new';
  } | null>(null);
  const [showingFileComment, setShowingFileComment] = useState(false);
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const navigation = useOptionalDiffNavigation();
  const registerFileElement = navigation?.registerFileElement;
  const unregisterFileElement = navigation?.unregisterFileElement;

  const isAddedFile = file.changeType === 'added';
  const filePath_ = file.newPath || file.oldPath || '';
  const showImagePreview = isAddedFile && file.isBinary === true && isPreviewableImage(filePath_);
  const showSvgPreview = isAddedFile && isPreviewableSvg(filePath_);
  const renderedTextMode = isAddedFile ? getRenderedTextMode(filePath_) : null;
  const isEligibleForRenderedView = renderedTextMode !== null;
  const isPreviewable = showImagePreview || showSvgPreview || isEligibleForRenderedView;

  const initialViewMode = showSvgPreview ? 'raw' : isPreviewable ? 'rendered' : 'raw';
  const [renderViewMode, setRenderViewMode] = useState<'raw' | 'rendered'>(initialViewMode);

  const filePath = file.newPath || file.oldPath;
  const guideDescription = guideMode === 'guided' ? getFileDescription(filePath) : undefined;
  const comments = getCommentsForFile(filePath);
  const fileComments = comments.filter(c => c.lineRange === null);
  const hasAnchor = useMemo(() => createCommentAnchorMatcher(file), [file]);
  const orphanedComments = comments.filter(c => !hasAnchor(c));
  const fileState = files.find(f => f.path === filePath);
  const isViewed = fileState?.viewed || false;

  // Register this section with the navigation provider (when there is one) so
  // scroll-to-file and collapse compensation find it by path, never through a
  // CSS selector built from the filename.
  const setSectionElement = useCallback(
    (element: HTMLDivElement | null) => {
      const previous = sectionRef.current;
      sectionRef.current = element;
      if (previous && previous !== element) unregisterFileElement?.(filePath, previous);
      if (element) registerFileElement?.(filePath, element);
    },
    [filePath, registerFileElement, unregisterFileElement]
  );

  // Lazy content loading state (for large-payload mode)
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState(false);

  useEffect(() => {
    if (!expanded || file.contentLoaded !== false || contentLoading) return;
    if (!adapter?.loadFileContent) return;

    setContentLoading(true);
    setContentError(false);

    adapter
      .loadFileContent(filePath)
      .then(hunks => {
        if (hunks) {
          updateFileHunks(filePath, hunks);
        } else {
          setContentError(true);
        }
        setContentLoading(false);
      })
      .catch(() => {
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
  const effectiveViewMode =
    viewMode === 'split' && (file.changeType === 'added' || file.changeType === 'deleted')
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
      ref={setSectionElement}
      className={`mx-2 mt-2 border border-border rounded-lg shadow-sm${dragState ? ' select-none' : ''}`}
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

      {guideDescription && (
        <div className='flex items-start gap-2.5 border-b border-border bg-muted/30 px-3 py-2'>
          {/* Waypoint dot in the file's group color, tying the file to its
              chapter's leg of the route. */}
          <span
            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full bg-background ring-2 ${getGuideAccent(getFileGroupIndex(filePath) ?? 0).ring}`}
            aria-hidden='true'
          />
          <span
            className='text-xs leading-relaxed text-muted-foreground'
            data-testid={`file-guide-description-${filePath}`}
          >
            {guideDescription}
          </span>
        </div>
      )}

      {expanded && (
        <FileSectionBody
          filePath={filePath}
          fileComments={fileComments}
          orphanedComments={orphanedComments}
          showingFileComment={showingFileComment}
          onCancelFileComment={() => setShowingFileComment(false)}
          onFileCommentSubmit={() => setShowingFileComment(false)}
          contentAreaProps={{
            file,
            filePath,
            viewMode: effectiveViewMode,
            renderViewMode,
            isEligibleForRenderedView,
            renderedTextMode,
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
