import React, { useEffect, useRef, useState } from 'react';
import { useReview } from '../../context/ReviewContext';
import { useConfig } from '../../context/ConfigContext';
import FileSection from './FileSection';

export default function DiffViewer() {
  const { diffFiles } = useReview();
  const { config } = useConfig();
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize all files as expanded
  const [expandedState, setExpandedState] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    diffFiles.forEach((file) => {
      initial[file.newPath || file.oldPath] = true;
    });
    return initial;
  });

  // Update expanded state when diffFiles changes
  useEffect(() => {
    setExpandedState((prev) => {
      const updated = { ...prev };
      diffFiles.forEach((file) => {
        const filePath = file.newPath || file.oldPath;
        if (!(filePath in updated)) {
          updated[filePath] = true;
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
      diffFiles.forEach((file) => {
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

  const handleToggleExpanded = (filePath: string) => {
    setExpandedState((prev) => ({
      ...prev,
      [filePath]: !prev[filePath],
    }));
  };

  if (diffFiles.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p>No files to review</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto" data-testid="diff-viewer" data-diff-viewer>
      {diffFiles.map((file) => {
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
