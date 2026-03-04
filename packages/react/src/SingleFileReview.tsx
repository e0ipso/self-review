import React, { useMemo, useCallback } from 'react';
import type { AppConfig, DiffFile, DiffSource, ReviewComment, DiffLoadPayload } from '@self-review/core';
import type { ReviewAdapter } from './adapter';
import { ReviewAdapterProvider } from './context/ReviewAdapterContext';
import { ConfigProvider } from './context/ConfigContext';
import { ReviewProvider } from './context/ReviewContext';
import { DiffNavigationProvider } from './context/DiffNavigationContext';
import { TooltipProvider } from './components/ui/tooltip';
import FileSection from './components/DiffViewer/FileSection';

export interface SingleFileReviewProps {
  /** The diff file to review. */
  file: DiffFile;
  /** Optional diff source metadata. */
  source?: DiffSource;
  /** Optional partial config (theme, categories, etc.). */
  config?: Partial<AppConfig>;
  /** Called when review comments change. */
  onReviewChange?: (comments: ReviewComment[]) => void;
  /** CSS class applied to the root container. */
  className?: string;
  /** Default view mode for markdown files: 'raw' shows diff, 'rendered' shows rendered markdown. */
  defaultViewMode?: 'split' | 'unified';
  /** Prism CSS string for light theme. */
  prismLightCss?: string;
  /** Prism CSS string for dark theme. */
  prismDarkCss?: string;
}

/**
 * Single-file review component for reviewing a single file.
 * Defaults to rendered markdown view for .md files.
 *
 * ```tsx
 * import { SingleFileReview } from '@self-review/react';
 * import '@self-review/react/styles.css';
 *
 * <SingleFileReview
 *   file={diffFile}
 *   config={{ theme: 'dark' }}
 * />
 * ```
 */
export function SingleFileReview({
  file,
  source,
  config,
  onReviewChange,
  className,
  defaultViewMode = 'unified',
  prismLightCss,
  prismDarkCss,
}: SingleFileReviewProps) {
  // Create a minimal adapter that provides the single file
  const adapter: ReviewAdapter = useMemo(() => ({
    loadDiff: async (): Promise<DiffLoadPayload> => ({
      files: [file],
      source: source || { type: 'file', sourcePath: file.newPath || file.oldPath },
    }),
  }), [file, source]);

  return (
    <ReviewAdapterProvider adapter={adapter}>
      <ConfigProvider
        initialConfig={{ ...config, diffView: defaultViewMode }}
        prismLightCss={prismLightCss}
        prismDarkCss={prismDarkCss}
      >
        <ReviewProvider>
          <DiffNavigationProvider>
            <TooltipProvider>
              <div className={className}>
                <FileSection
                  file={file}
                  viewMode={defaultViewMode}
                  expanded={true}
                />
              </div>
            </TooltipProvider>
          </DiffNavigationProvider>
        </ReviewProvider>
      </ConfigProvider>
    </ReviewAdapterProvider>
  );
}
