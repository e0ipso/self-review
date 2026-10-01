import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useReview } from '../../context/ReviewContext';
import { useConfig } from '../../context/ConfigContext';
import { useGuide } from '../../context/GuideContext';
import { useOptionalDiffNavigation } from '../../context/DiffNavigationContext';
import { buildGuideDisplaySections } from '../../utils/guide-display';
import FileSection from './FileSection';
import PreviewErrorBoundary from './PreviewErrorBoundary';
import { EmptyDiffMessage } from './EmptyDiffMessage';
import { DiffDiagnostics } from './DiffDiagnostics';
import GuideOverviewPanel from './GuideOverviewPanel';
import GuideChapterDivider from './GuideChapterDivider';

/** When the file count exceeds this threshold, all sections start collapsed. */
export const COLLAPSE_THRESHOLD = 50;

export default function DiffViewer() {
  const { diffFiles, diffSource, diagnostics = [] } = useReview();
  const { config } = useConfig();
  const { guide, mode: guideMode } = useGuide();
  const containerRef = useRef<HTMLDivElement>(null);
  const navigation = useOptionalDiffNavigation();

  // In guided mode the diff stream follows the walkthrough: file sections
  // render in guide order, grouped into chapters. Flat mode (or no guide)
  // yields a single headerless section in diff order — today's stream.
  const displaySections = useMemo(
    () => buildGuideDisplaySections(diffFiles, guide?.groups ?? null, guideMode),
    [diffFiles, guide, guideMode]
  );
  const totalStops = displaySections.filter(section => section.header).length;
  const implicitLast = Boolean(displaySections[displaySections.length - 1]?.header?.implicit);

  // Initialize files as expanded (small sets) or collapsed (large sets)
  const [expandedState, setExpandedState] = useState<Record<string, boolean>>(() => {
    const defaultExpanded = diffFiles.length <= COLLAPSE_THRESHOLD;
    const initial: Record<string, boolean> = {};
    diffFiles.forEach(file => {
      initial[file.newPath || file.oldPath] = defaultExpanded;
    });
    return initial;
  });

  // Update expanded state when diffFiles changes
  useEffect(() => {
    setExpandedState(prev => {
      const defaultExpanded = diffFiles.length <= COLLAPSE_THRESHOLD;
      const updated = { ...prev };
      diffFiles.forEach(file => {
        const filePath = file.newPath || file.oldPath;
        if (!(filePath in updated)) {
          updated[filePath] = defaultExpanded;
        }
      });
      return updated;
    });
  }, [diffFiles]);

  // Listen for toggle-all-sections custom events
  useEffect(() => {
    const handleToggleAll = (event: Event) => {
      const customEvent = event as CustomEvent<{ expanded: boolean }>;
      const newState: Record<string, boolean> = {};
      diffFiles.forEach(file => {
        const filePath = file.newPath || file.oldPath;
        newState[filePath] = customEvent.detail?.expanded ?? true;
      });
      setExpandedState(newState);
    };

    document.addEventListener('toggle-all-sections', handleToggleAll);

    return () => {
      document.removeEventListener('toggle-all-sections', handleToggleAll);
    };
  }, [diffFiles]);

  // Pending scroll adjustment to apply after React commits the DOM change
  const scrollAdjustRef = useRef<number>(0);

  // Apply scroll compensation synchronously after DOM update, before paint
  useLayoutEffect(() => {
    if (scrollAdjustRef.current > 0) {
      const scrollContainer = document.querySelector<HTMLElement>('[data-scroll-container="diff"]');
      if (scrollContainer) {
        scrollContainer.scrollTop -= scrollAdjustRef.current;
      }
      scrollAdjustRef.current = 0;
    }
  }, [expandedState]);

  const handleToggleExpanded = (filePath: string) => {
    const isCurrentlyExpanded = expandedState[filePath];

    // Compensate scroll position when collapsing a file above the viewport
    if (isCurrentlyExpanded) {
      const scrollContainer = document.querySelector<HTMLElement>('[data-scroll-container="diff"]');
      // The section registers itself by path; a selector built from the
      // filename would throw or mismatch on quotes, backslashes or newlines.
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

    setExpandedState(prev => ({
      ...prev,
      [filePath]: !prev[filePath],
    }));
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
            title='Part of this diff could not be reviewed'
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
          {section.entries.map(({ file }) => {
            const filePath = file.newPath || file.oldPath;
            // FileSection contains preview failures itself and keeps its
            // header usable; this outer boundary is the net for a failure
            // anywhere else in the section, so it can't blank the review.
            return (
              <PreviewErrorBoundary key={filePath} filePath={filePath} resetKeys={[file]}>
                <FileSection
                  file={file}
                  viewMode={config.diffView}
                  expanded={expandedState[filePath]}
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
