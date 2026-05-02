import React, { forwardRef, useMemo } from 'react';
import type { AppConfig, DiffFile, DiffSource, ReviewComment, DiffLoadPayload } from '@self-review/types';
import type { ReviewAdapter } from './adapter';
import { ReviewAdapterProvider } from './context/ReviewAdapterContext';
import { ConfigProvider } from './context/ConfigContext';
import { ReviewProvider } from './context/ReviewContext';
import { DiffNavigationProvider } from './context/DiffNavigationContext';
import { TooltipProvider } from './components/ui/tooltip';
import FileSection from './components/DiffViewer/FileSection';
import { type ReviewHandle, useReviewBridge } from './hooks/useReviewBridge';

export type SingleFileReviewHandle = ReviewHandle;

export interface SingleFileReviewProps {
  /** The diff file to review. */
  file: DiffFile;
  /** Optional diff source metadata. */
  source?: DiffSource;
  /** Optional partial config (theme, categories, etc.). */
  config?: Partial<AppConfig>;
  /** Called when review comments change. */
  onReviewChange?: (comments: ReviewComment[]) => void;
  /**
   * Optional partial `ReviewAdapter`. Consumers use this to wire optional adapter methods
   * such as `expandContext`, `loadFileContent`, `loadImage`, `readAttachment`,
   * `loadResumedComments`, `submitReview`, and `changeOutputPath`.
   *
   * Note: a consumer-supplied `loadDiff` is intentionally ignored — `file` and `source`
   * are the source of truth in single-file mode. Memoize this object on the consumer side
   * to avoid unnecessary re-renders, the same way `ReviewPanel` expects.
   */
  adapter?: Partial<ReviewAdapter>;
  /** CSS class applied to the root container. */
  className?: string;
  /** Default view mode for markdown files: 'raw' shows diff, 'rendered' shows rendered markdown. */
  defaultViewMode?: 'split' | 'unified';
  /** Prism CSS string for light theme. */
  prismLightCss?: string;
  /** Prism CSS string for dark theme. */
  prismDarkCss?: string;
}

interface SingleFileReviewInnerProps {
  file: DiffFile;
  viewMode: 'split' | 'unified';
  onReviewChange?: (comments: ReviewComment[]) => void;
  className?: string;
}

const SingleFileReviewInner = forwardRef<ReviewHandle, SingleFileReviewInnerProps>(
  function SingleFileReviewInner({ file, viewMode, onReviewChange, className }, ref) {
    useReviewBridge(ref, onReviewChange);
    return (
      <div className={className}>
        <FileSection file={file} viewMode={viewMode} expanded={true} />
      </div>
    );
  },
);

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
export const SingleFileReview = forwardRef<ReviewHandle, SingleFileReviewProps>(
  function SingleFileReview({
    file,
    source,
    config,
    onReviewChange,
    adapter,
    className,
    defaultViewMode = 'unified',
    prismLightCss,
    prismDarkCss,
  }, ref) {
    // Merge consumer-supplied adapter under the internally-generated loadDiff.
    // Spread order is load-bearing: the internal loadDiff must always win, since
    // file/source are the source of truth in single-file mode.
    const mergedAdapter: ReviewAdapter = useMemo(() => ({
      ...adapter,
      loadDiff: async (): Promise<DiffLoadPayload> => ({
        files: [file],
        source: source || { type: 'file', sourcePath: file.newPath || file.oldPath },
      }),
    }), [file, source, adapter]);

    return (
      <ReviewAdapterProvider adapter={mergedAdapter}>
        <ConfigProvider
          initialConfig={{ ...config, diffView: defaultViewMode }}
          prismLightCss={prismLightCss}
          prismDarkCss={prismDarkCss}
        >
          <ReviewProvider>
            <DiffNavigationProvider>
              <TooltipProvider>
                <SingleFileReviewInner
                  ref={ref}
                  file={file}
                  viewMode={defaultViewMode}
                  onReviewChange={onReviewChange}
                  className={className}
                />
              </TooltipProvider>
            </DiffNavigationProvider>
          </ReviewProvider>
        </ConfigProvider>
      </ReviewAdapterProvider>
    );
  },
);
