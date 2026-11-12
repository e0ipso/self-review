import { useLocalization } from '../../localization/LocalizationContext';
import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { reviewElement } from '../../utils/review-root';
import { useReviewExpansion } from '../../context/ReviewDisplayContext';
export { COLLAPSE_THRESHOLD } from '../../context/ReviewDisplayContext';
import { useDiffReview } from '../../context/ReviewContext';
import { useAppearance, usePortalContainer } from '../../context/ConfigContext';
import { useGuide } from '../../context/GuideContext';
import { useOptionalDiffNavigation } from '../../context/DiffNavigationContext';
import { keyDiffEntries } from '../../utils/diff-entry-keys';
import { buildGuideDisplaySections } from '../../utils/guide-display';
import FileSection from './FileSection';
import PreviewErrorBoundary from './PreviewErrorBoundary';
import { EmptyDiffMessage } from './EmptyDiffMessage';
import { DiffDiagnostics } from './DiffDiagnostics';
import GuideOverviewPanel from './GuideOverviewPanel';
import GuideChapterDivider from './GuideChapterDivider';

export default function DiffViewer() {
  const { t } = useLocalization();
  const { diffFiles, diffSource, diagnostics = [], sessionId } = useDiffReview();
  const config = useAppearance();
  const portalContainer = usePortalContainer();
  const { guide, mode: guideMode } = useGuide();
  const containerRef = useRef<HTMLDivElement>(null);
  const navigation = useOptionalDiffNavigation();

  // In guided mode the diff stream follows the walkthrough: file sections
  // render in guide order, grouped into chapters. Flat mode (or no guide)
  // yields a single headerless section in diff order — today's stream.
  const displaySections = useMemo(
    () =>
      keyDiffEntries(
        diffFiles,
        buildGuideDisplaySections(diffFiles, guide?.groups ?? null, guideMode)
      ),
    [diffFiles, guide, guideMode]
  );
  const totalStops = displaySections.filter(section => section.header).length;
  const implicitLast = Boolean(displaySections[displaySections.length - 1]?.header?.implicit);

  const { expanded: expandedState, setExpanded } = useReviewExpansion();
  const isExpanded = (filePath: string) => expandedState.get(filePath) ?? false;

  // Pending scroll adjustment to apply after React commits the DOM change
  const scrollAdjustRef = useRef<number>(0);

  // Apply scroll compensation synchronously after DOM update, before paint
  useLayoutEffect(() => {
    if (scrollAdjustRef.current > 0) {
      const scrollContainer = reviewElement<HTMLElement>(
        portalContainer,
        '[data-scroll-container="diff"]'
      );
      if (scrollContainer) {
        scrollContainer.scrollTop -= scrollAdjustRef.current;
      }
      scrollAdjustRef.current = 0;
    }
  }, [expandedState]);

  const handleToggleExpanded = (filePath: string) => {
    const isCurrentlyExpanded = isExpanded(filePath);

    // Compensate scroll position when collapsing a file above the viewport
    if (isCurrentlyExpanded) {
      const scrollContainer = reviewElement<HTMLElement>(
        portalContainer,
        '[data-scroll-container="diff"]'
      );
      // Filenames can hold quotes, backslashes and newlines: sections register by path.
      const sectionEl = navigation?.getFileElement(filePath);

      if (scrollContainer && sectionEl) {
        const containerRect = scrollContainer.getBoundingClientRect();
        const sectionRect = sectionEl.getBoundingClientRect();

        // Compensate if the section top is above the viewport top
        if (sectionRect.top < containerRect.top) {
          const HEADER_HEIGHT = 40; // h-10 = 2.5rem = 40px
          const delta = sectionEl.scrollHeight - HEADER_HEIGHT;

          if (delta > 0) {
            scrollAdjustRef.current = delta;
          }
        }
      }
    }

    setExpanded(filePath, !isCurrentlyExpanded);
  };

  if (diffFiles.length === 0) {
    return <EmptyDiffMessage diffSource={diffSource} diagnostics={diagnostics} />;
  }

  return (
    <div
      ref={containerRef}
      // Bottom padding keeps the last file clear of the floating route HUD.
      className={`flex-1${totalStops > 0 ? ' pb-16' : ''}`}
      data-testid='diff-viewer'
      data-diff-viewer
    >
      {diagnostics.length > 0 && (
        <div className='px-4 pt-4'>
          <DiffDiagnostics
            diagnostics={diagnostics}
            title={t('Part of this diff could not be reviewed')}
          />
        </div>
      )}
      <GuideOverviewPanel />
      {displaySections.map((section, sectionIndex) => (
        <React.Fragment key={`chapter-${sectionIndex}-${section.header?.name ?? 'flat'}`}>
          {section.header && (
            <GuideChapterDivider
              header={section.header}
              index={sectionIndex}
              totalStops={totalStops}
              implicitLast={implicitLast}
              entries={section.entries}
            />
          )}
          {section.entries.map(({ file, key }) => {
            const filePath = file.newPath || file.oldPath;
            // Net for failures outside FileSection's own preview boundary.
            return (
              <PreviewErrorBoundary
                key={`${sessionId}:${key}`}
                filePath={filePath}
                resetKeys={[file]}
              >
                <FileSection
                  file={file}
                  viewMode={config.diffView}
                  expanded={isExpanded(filePath)}
                  onToggleExpanded={handleToggleExpanded}
                />
              </PreviewErrorBoundary>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
}
