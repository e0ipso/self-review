import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useReview } from '../../context/ReviewContext';
import { useConfig } from '../../context/ConfigContext';
import FileSection from './FileSection';
import { EmptyDiffMessage } from './EmptyDiffMessage';

/** When the file count exceeds this threshold, all sections start collapsed. */
export const COLLAPSE_THRESHOLD = 50;

export default function DiffViewer() {
  const { diffFiles, diffSource } = useReview();
  const { config } = useConfig();
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize files as expanded (small sets) or collapsed (large sets)
  const [expandedState, setExpandedState] = useState<Record<string, boolean>>(
    () => {
      const defaultExpanded = diffFiles.length <= COLLAPSE_THRESHOLD;
      const initial: Record<string, boolean> = {};
      diffFiles.forEach(file => {
        initial[file.newPath || file.oldPath] = defaultExpanded;
      });
      return initial;
    }
  );

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
      const scrollContainer = document.querySelector<HTMLElement>(
        '[data-scroll-container="diff"]'
      );
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
      const scrollContainer = document.querySelector<HTMLElement>(
        '[data-scroll-container="diff"]'
      );
      // Scope query to scroll container to avoid matching FileTree elements
      const sectionEl = scrollContainer?.querySelector<HTMLElement>(
        `[data-file-path="${filePath}"]`
      );

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
    return <EmptyDiffMessage diffSource={diffSource} />;
  }

  return (
    <div
      ref={containerRef}
      className='flex-1'
      data-testid='diff-viewer'
      data-diff-viewer
    >
      {diffFiles.map(file => {
        const filePath = file.newPath || file.oldPath;
        return (
          <FileSection
            key={filePath}
            file={file}
            viewMode={config.diffView}
            expanded={expandedState[filePath]}
            onToggleExpanded={handleToggleExpanded}
          />
        );
      })}
    </div>
  );
}
