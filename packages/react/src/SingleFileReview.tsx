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
  /**
   * The diff file to review. Its path (`newPath || oldPath`) is part of the
   * session identity: a file at a different path starts a fresh session, so
   * comments, viewed state and the exported source always belong to the
   * file on screen. A new object for the same path keeps the session and
   * the reviewer's comments; the section renders the new object.
   */
  file: DiffFile;
  /**
   * Optional diff source metadata, defaulting to `{ type: 'file' }` at the
   * file's path. Compared by value: a source naming a different review
   * starts a fresh session, an equal inline literal does not.
   */
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
   * Note: a consumer-supplied `loadDiff` is intentionally ignored — `file` and `source`
   * are the source of truth in single-file mode. Memoize this object on the consumer side:
   * as with `ReviewPanel`, a new adapter object starts a new review session.
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
  }
);

interface SingleFileSessionProps extends SingleFileReviewInnerProps {
  source: DiffSource;
  adapter?: Partial<ReviewAdapter>;
}

/**
 * One review session for one file. `SingleFileReview` keys it on the file
 * path and source identity, so a different file discards the previous
 * file's comments, viewed state and source instead of exporting them.
 */
const SingleFileSession = forwardRef<ReviewHandle, SingleFileSessionProps>(
  function SingleFileSession({ file, source, adapter, ...inner }, ref) {
    // Read at load time, so a same-path file update does not need a new
    // adapter — a new adapter object would start a new session. The file on
    // screen always comes from the prop; the session holds its review state.
    const payloadRef = useRef<DiffLoadPayload>({ files: [file], source });
    payloadRef.current = { files: [file], source };

    // Merge consumer-supplied adapter under the internally-generated loadDiff.
    // Spread order is load-bearing: the internal loadDiff must always win, since
    // file/source are the source of truth in single-file mode.
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
    {
      file,
      source,
      config,
      onReviewChange,
      adapter,
      className,
      defaultViewMode = 'unified',
      prismLightCss,
      prismDarkCss,
    },
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
      <ConfigProvider
        initialConfig={{ ...config, diffView: defaultViewMode }}
        prismLightCss={prismLightCss}
        prismDarkCss={prismDarkCss}
      >
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
