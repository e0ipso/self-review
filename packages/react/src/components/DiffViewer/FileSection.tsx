import { useLocalization } from '../../localization/LocalizationContext';
import React, { useRef, useMemo, useCallback, useId } from 'react';
import { effectiveDiffLayout } from './effective-layout';
import { useFileCommentSelection } from './useFileCommentSelection';
import { useFilePreviewMode } from './useFilePreviewMode';
import { useExpandContext } from './useExpandContext';
import { useLazyFileContent } from './useLazyFileContent';
import type { DiffFile } from '@self-review/types';
import { useReviewCommands, useFileReview, useReviewSource } from '../../context/ReviewContext';
import { useGuide } from '../../context/GuideContext';
import { useOptionalDiffNavigation } from '../../context/DiffNavigationContext';
import { usePreviewRenderer } from '../../context/PreviewRenderingContext';
import { resolveFilePreview } from '../../services/content-preview';
import { getGuideAccent } from '../../utils/guide-accents';
import { useFileSectionExpansion } from './useFileSectionExpansion';
import { FileSectionHeaderPresentation } from './FileSectionHeader';
import { FileSectionBodyLayout } from './FileSectionBody';
import { ContentStatusBoundary } from './ContentStatusBoundary';
import { FilePreview } from './FilePreview';
import { RawDiffContent } from './RawDiffContent';
import PreviewErrorBoundary from './PreviewErrorBoundary';
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
  const bodyId = useId();
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const navigation = useOptionalDiffNavigation();
  const registerFileElement = navigation?.registerFileElement;
  const unregisterFileElement = navigation?.unregisterFileElement;

  const renderer = usePreviewRenderer();
  const preview = resolveFilePreview(file, renderer);
  const { renderViewMode, setRenderViewMode } = useFilePreviewMode(file, preview);

  const filePath = file.newPath || file.oldPath;
  const guideDescription = guideMode === 'guided' ? getFileDescription(filePath) : undefined;
  const comments = fileState?.comments ?? [];
  const fileComments = comments.filter(c => c.lineRange === null);
  const hasAnchor = useMemo(() => createCommentAnchorMatcher(file), [file]);
  const orphanedComments = comments.filter(c => !hasAnchor(c));
  const isViewed = fileState?.viewed || false;
  const { expanded, changeExpanded } = useFileSectionExpansion(
    filePath,
    isViewed,
    controlledExpanded,
    onToggleExpanded
  );

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

  const effectiveViewMode = effectiveDiffLayout(viewMode, file.changeType);

  const { lineComments, rawSelection, onCommentRange, fileComment } = useFileCommentSelection(
    file,
    sectionRef,
    effectiveViewMode
  );

  const handleViewedToggle = () => toggleViewed(filePath);

  return (
    <div
      ref={setSectionElement}
      className={`mx-2 mt-2 border border-border rounded-lg shadow-sm${rawSelection.dragState ? ' select-none' : ''}`}
      data-file-path={filePath}
      data-testid={`file-section-${filePath}`}
    >
      <FileSectionHeaderPresentation
        bodyId={bodyId}
        file={file}
        filePath={filePath}
        expanded={expanded}
        isViewed={isViewed}
        isPreviewable={preview.available}
        renderViewMode={renderViewMode}
        commentCount={comments.length}
        onToggle={() => changeExpanded(!expanded)}
        onViewedToggle={handleViewedToggle}
        onAddFileComment={() => {
          changeExpanded(true);
          fileComment.openFileComment();
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
          <FileSectionBodyLayout
            filePath={filePath}
            fileComments={fileComments}
            orphanedComments={orphanedComments}
            showingFileComment={fileComment.showingFileComment}
            onCancelFileComment={fileComment.closeFileComment}
            onFileCommentSubmit={fileComment.closeFileComment}
          >
            <PreviewErrorBoundary
              filePath={filePath}
              resetKeys={[file, renderViewMode, effectiveViewMode]}
            >
              <ContentStatusBoundary
                omittedReason={file.omittedReason}
                contentLoaded={file.contentLoaded}
                contentLoad={contentLoad}
                onRetry={retryContentLoad}
              >
                <FilePreview
                  file={file}
                  preview={preview.builtIn}
                  descriptor={preview}
                  filePath={filePath}
                  mode={renderViewMode}
                  {...lineComments}
                  onCommentRange={onCommentRange}
                >
                  <RawDiffContent
                    file={file}
                    viewMode={effectiveViewMode}
                    {...lineComments}
                    {...rawSelection}
                    isExpandable={isExpandable}
                    expandLoading={expandLoading}
                    totalLines={totalLines}
                    onExpandContext={isExpandable ? handleExpandContext : undefined}
                  />
                </FilePreview>
              </ContentStatusBoundary>
            </PreviewErrorBoundary>
          </FileSectionBodyLayout>
        )}
      </div>
    </div>
  );
}
