import React, { useEffect, useRef, useState } from 'react';
import { useReview } from '../../context/ReviewContext';
import { useConfig } from '../../context/ConfigContext';
import FileSection from './FileSection';

export default function DiffViewer() {
  const { diffFiles, gitDiffArgs } = useReview();
  const { config } = useConfig();
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize all files as expanded
  const [expandedState, setExpandedState] = useState<Record<string, boolean>>(
    () => {
      const initial: Record<string, boolean> = {};
      diffFiles.forEach(file => {
        initial[file.newPath || file.oldPath] = true;
      });
      return initial;
    }
  );

  // Update expanded state when diffFiles changes
  useEffect(() => {
    setExpandedState(prev => {
      const updated = { ...prev };
      diffFiles.forEach(file => {
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

  const handleToggleExpanded = (filePath: string) => {
    setExpandedState(prev => ({
      ...prev,
      [filePath]: !prev[filePath],
    }));
  };

  if (diffFiles.length === 0) {
    return (
      <div
        className='flex-1 flex items-center justify-center p-8'
        data-testid='empty-diff-help'
      >
        <div className='max-w-lg space-y-6'>
          <h2 className='text-lg font-semibold text-foreground text-center'>
            No changes found
          </h2>
          <p className='text-sm text-muted-foreground'>
            All arguments are passed directly to{' '}
            <code className='px-1 py-0.5 rounded bg-muted text-xs font-mono'>
              git diff
            </code>
            .
            {gitDiffArgs && (
              <span>
                {' '}
                The arguments{' '}
                <code className='px-1 py-0.5 rounded bg-muted text-xs font-mono'>
                  {gitDiffArgs}
                </code>{' '}
                were passed to git diff. Try different arguments to see your
                changes.
              </span>
            )}
          </p>
          <div>
            <h3 className='text-sm font-medium text-foreground mb-3'>
              Common usage examples:
            </h3>
            <table className='w-full text-sm'>
              <tbody className='text-muted-foreground'>
                <tr className='border-b border-border/50'>
                  <td className='py-1.5 pr-4 font-mono text-xs text-foreground'>
                    self-review
                  </td>
                  <td className='py-1.5'>
                    Unstaged working tree changes (default)
                  </td>
                </tr>
                <tr className='border-b border-border/50'>
                  <td className='py-1.5 pr-4 font-mono text-xs text-foreground'>
                    self-review --staged
                  </td>
                  <td className='py-1.5'>Changes staged for commit</td>
                </tr>
                <tr className='border-b border-border/50'>
                  <td className='py-1.5 pr-4 font-mono text-xs text-foreground'>
                    self-review HEAD~1
                  </td>
                  <td className='py-1.5'>Changes in the last commit</td>
                </tr>
                <tr className='border-b border-border/50'>
                  <td className='py-1.5 pr-4 font-mono text-xs text-foreground'>
                    self-review main..HEAD
                  </td>
                  <td className='py-1.5'>
                    All changes since branching from main
                  </td>
                </tr>
                <tr>
                  <td className='py-1.5 pr-4 font-mono text-xs text-foreground'>
                    self-review -- src/
                  </td>
                  <td className='py-1.5'>Limit diff to a specific directory</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
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
