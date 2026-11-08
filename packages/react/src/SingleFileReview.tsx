import React, { forwardRef, useMemo, useRef } from 'react';
import type {
  AppConfig,
  DiffFile,
  DiffSource,
  ReviewComment,
  DiffLoadPayload,
} from '@self-review/types';
import type { ReviewAdapter } from './adapter';
import { ReviewAdapterProvider } from './context/ReviewAdapterContext';
import { ConfigProvider } from './context/ConfigContext';
import { ReviewProvider, reviewSessionIdentity } from './context/ReviewContext';
import { DiffNavigationProvider } from './context/DiffNavigationContext';
import { TooltipProvider } from './components/ui/tooltip';
import FileSection from './components/DiffViewer/FileSection';
import { type ReviewHandle, useReviewBridge } from './hooks/useReviewBridge';

export type SingleFileReviewHandle = ReviewHandle;

export interface SingleFileReviewProps {
  /** A different path starts a fresh session; a new object for the same path keeps it. */
  file: DiffFile;
  /** Defaults to `{ type: 'file' }` at the file's path. Compared by value. */
  source?: DiffSource;
  /** Optional partial config (theme, categories, etc.). */
  config?: Partial<AppConfig>;
  /** Called when review comments change. */
  onReviewChange?: (comments: ReviewComment[]) => void;
  /**
   * Optional partial `ReviewAdapter`. Consumers use this to wire optional adapter methods
   * such as `expandContext`, `loadFileContent`, `loadImage`, `readAttachment`,
   * `loadResumedReview`, `submitReview`, and `changeOutputPath`.
   *
   * A consumer-supplied `loadDiff` is ignored: `file` and `source` are the source of truth.
   * Memoize this object, since a new adapter object starts a new session.
   */
  adapter?: Partial<ReviewAdapter>;
  /** CSS class applied to the root container. */
  className?: string;
  /** Default view mode for markdown files: 'raw' shows diff, 'rendered' shows rendered markdown. */
  defaultViewMode?: 'split' | 'unified';
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
  }
);

interface SingleFileSessionProps extends SingleFileReviewInnerProps {
  source: DiffSource;
  adapter?: Partial<ReviewAdapter>;
}

/** Keyed on path and source identity, so a different file never exports the previous one's state. */
const SingleFileSession = forwardRef<ReviewHandle, SingleFileSessionProps>(
  function SingleFileSession({ file, source, adapter, ...inner }, ref) {
    // Read at load time: a new adapter object would start a new session on a same-path update.
    const payloadRef = useRef<DiffLoadPayload>({ files: [file], source });
    payloadRef.current = { files: [file], source };

    // Spread order is load-bearing: the internal loadDiff must win.
    const mergedAdapter: ReviewAdapter = useMemo(
      () => ({
        ...adapter,
        loadDiff: async (): Promise<DiffLoadPayload> => payloadRef.current,
      }),
      [adapter]
    );

    return (
      <ReviewAdapterProvider adapter={mergedAdapter}>
        <ReviewProvider>
          <DiffNavigationProvider>
            <TooltipProvider>
              <SingleFileReviewInner ref={ref} file={file} {...inner} />
            </TooltipProvider>
          </DiffNavigationProvider>
        </ReviewProvider>
      </ReviewAdapterProvider>
    );
  }
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
  function SingleFileReview(
    { file, source, config, onReviewChange, adapter, className, defaultViewMode = 'unified' },
    ref
  ) {
    const resolvedSource: DiffSource = source || {
      type: 'file',
      sourcePath: file.newPath || file.oldPath,
    };
    const sessionKey = JSON.stringify([
      file.newPath || file.oldPath,
      reviewSessionIdentity(resolvedSource),
    ]);

    return (
      <ConfigProvider initialConfig={{ ...config, diffView: defaultViewMode }}>
        <SingleFileSession
          key={sessionKey}
          ref={ref}
          file={file}
          source={resolvedSource}
          adapter={adapter}
          viewMode={defaultViewMode}
          onReviewChange={onReviewChange}
          className={className}
        />
      </ConfigProvider>
    );
  }
);
