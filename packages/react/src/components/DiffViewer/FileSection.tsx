import { useLocalization } from '../../localization/LocalizationContext';
import React, { useState, useEffect, useRef, useMemo, useCallback, useId } from 'react';
import { useDragSelection } from './useDragSelection';
import { useExpandContext } from './useExpandContext';
import { useLazyFileContent } from './useLazyFileContent';
import type { DiffFile } from '@self-review/types';
import { useReviewCommands, useFileReview, useReviewSource } from '../../context/ReviewContext';
import { useGuide } from '../../context/GuideContext';
import { useOptionalDiffNavigation } from '../../context/DiffNavigationContext';
import { usePreviewRenderer } from '../../context/PreviewRenderingContext';
import { getContentPreview, initialPreviewMode } from './content-preview';
import { getGuideAccent } from '../../utils/guide-accents';
import { useReviewExpansion } from '../../context/ReviewDisplayContext';
import { FileSectionHeaderPresentation } from './FileSectionHeader';
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
  const { t } = useLocalization();
  const { toggleViewed } = useReviewCommands();
  const diffSource = useReviewSource();
  const fileState = useFileReview(file.newPath || file.oldPath);
  const { mode: guideMode, getFileDescription, getFileGroupIndex } = useGuide();
  const { expanded: expansion, setExpanded } = useReviewExpansion();
  const expanded = controlledExpanded ?? expansion.get(file.newPath || file.oldPath) ?? false;
  const [commentRange, setCommentRange] = useState<{
    start: number;
    end: number;
    side: 'old' | 'new';
  } | null>(null);
  const [showingFileComment, setShowingFileComment] = useState(false);
  const bodyId = useId();
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const navigation = useOptionalDiffNavigation();
  const registerFileElement = navigation?.registerFileElement;
  const unregisterFileElement = navigation?.unregisterFileElement;

  const preview = getContentPreview(file);
  const renderer = usePreviewRenderer();
  const hostPreview = file.changeType === 'added' && !!renderer?.supports(file, preview);
  const isPreviewable = preview.kind !== 'none' || hostPreview;
  const initialViewMode =
    preview.kind === 'none' && hostPreview
      ? (renderer?.defaultMode ?? 'raw')
      : initialPreviewMode(preview);
  const [renderViewMode, setRenderViewMode] = useState<'raw' | 'rendered'>(initialViewMode);

  const filePath = file.newPath || file.oldPath;
  const guideDescription = guideMode === 'guided' ? getFileDescription(filePath) : undefined;
  const comments = fileState?.comments ?? [];
  const fileComments = comments.filter(c => c.lineRange === null);
  const hasAnchor = useMemo(() => createCommentAnchorMatcher(file), [file]);
  const orphanedComments = comments.filter(c => !hasAnchor(c));
  const isViewed = fileState?.viewed || false;

  // Registered by path so navigation never builds a CSS selector from the filename.
  const setSectionElement = useCallback(
    (element: HTMLDivElement | null) => {
      const previous = sectionRef.current;
      sectionRef.current = element;
      if (previous && previous !== element) unregisterFileElement?.(filePath, previous);
      if (element) registerFileElement?.(filePath, element);
    },
    [filePath, registerFileElement, unregisterFileElement]
  );

  const { state: contentLoad, retry: retryContentLoad } = useLazyFileContent({
    file,
    filePath,
    expanded,
  });

  // Expand context state
  const isExpandable = diffSource.type === 'git' && !file.isUntracked && !file.isBinary;

  const { expandLoading, expandError, totalLines, handleExpandContext } = useExpandContext({
    file,
    filePath,
    isExpandable,
    sectionRef,
    expanded,
  });

  // Effective view mode: added/deleted files are forced to unified view
  const effectiveViewMode =
    viewMode === 'split' && (file.changeType === 'added' || file.changeType === 'deleted')
      ? 'unified'
      : viewMode;

  // Stable identities: the rendered view hands these to every block through context.
  const handleCommentRange = useCallback((start: number, end: number, side: 'old' | 'new') => {
    setCommentRange({
      start: Math.min(start, end),
      end: Math.max(start, end),
      side,
    });
  }, []);
  const clearCommentRange = useCallback(() => setCommentRange(null), []);

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
      <FileSectionHeaderPresentation
        bodyId={bodyId}
        file={file}
        filePath={filePath}
        expanded={expanded}
        isViewed={isViewed}
        isPreviewable={isPreviewable}
        renderViewMode={renderViewMode}
        commentCount={comments.length}
        onToggle={() => {
          if (onToggleExpanded) {
            onToggleExpanded(filePath);
          } else {
            setExpanded(filePath, !expanded);
          }
        }}
        onViewedToggle={handleViewedToggle}
        onAddFileComment={() => {
          if (!expanded) {
            if (onToggleExpanded) onToggleExpanded(filePath);
            else setExpanded(filePath, true);
          }
          setShowingFileComment(true);
        }}
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

      <div id={bodyId} hidden={!expanded}>
        {expanded && expandError && (
          <p role='alert' className='m-3 text-sm text-destructive'>
            {t('Context could not be loaded. Use an expand button to try again.')}
          </p>
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
              preview,
              filePath,
              viewMode: effectiveViewMode,
              renderViewMode,
              contentLoad,
              onRetry: retryContentLoad,
              commentRange,
              dragState,
              onDragStart: handleDragStart,
              onCancelComment: clearCommentRange,
              onCommentSaved: clearCommentRange,
              onCommentRange: handleCommentRange,
              isExpandable,
              expandLoading,
              totalLines,
              handleExpandContext,
            }}
          />
        )}
      </div>
    </div>
  );
}
