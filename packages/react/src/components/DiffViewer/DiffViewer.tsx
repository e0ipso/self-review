import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { DiffFile } from '@self-review/types';
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

/**
 * When the file count exceeds this threshold, all sections start collapsed.
 * A large-payload session starts collapsed whatever its file count.
 */
export const COLLAPSE_THRESHOLD = 50;

/** Record `defaultExpanded` for every path in `diffFiles` that `prev` lacks. */
function withDefaultExpansion(
  prev: Record<string, boolean>,
  diffFiles: DiffFile[],
  defaultExpanded: boolean
): Record<string, boolean> {
  let updated: Record<string, boolean> | null = null;
  for (const file of diffFiles) {
    const filePath = file.newPath || file.oldPath;
    if (filePath in prev) continue;
    updated ??= { ...prev };
    updated[filePath] = defaultExpanded;
  }
  return updated ?? prev;
}

export default function DiffViewer() {
  const {
    diffFiles,
    diffSource,
    diagnostics = [],
    isLargePayload = false,
    sessionId,
  } = useReview();
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

  // Sections start expanded for a small review and collapsed for a large
  // one. Large means the host sent the session in large-payload mode, which
  // either threshold (file count or total lines) triggers: there every
  // expanded section fetches its own content, so a handful of huge files
  // must not all be opened and fetched at once. Too many files to show at
  // once collapses them too.
  const defaultExpanded = !isLargePayload && diffFiles.length <= COLLAPSE_THRESHOLD;

  const [expandedState, setExpandedState] = useState<Record<string, boolean>>(() =>
    withDefaultExpansion({}, diffFiles, defaultExpanded)
  );

  // A new session starts from its own payload mode, not from the expansion
  // the previous review's files were left in. Reset during render so no
  // section of the new session is ever committed (and fetched) expanded
  // under the old state.
  const [expansionSessionId, setExpansionSessionId] = useState(sessionId);
  if (expansionSessionId !== sessionId) {
    setExpansionSessionId(sessionId);
    setExpandedState({});
  }

  // A path seen for the first time keeps the default it was shown with, so a
  // later update that changes the default does not fold or unfold it.
  useEffect(() => {
    setExpandedState(prev => withDefaultExpansion(prev, diffFiles, defaultExpanded));
  }, [diffFiles, defaultExpanded]);

  // Until that effect records it, a path is shown with the current default.
  const isExpanded = (filePath: string) => expandedState[filePath] ?? defaultExpanded;

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
    const isCurrentlyExpanded = isExpanded(filePath);

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
      [filePath]: !(prev[filePath] ?? defaultExpanded),
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
