import React, { forwardRef, useRef, useImperativeHandle, type ReactNode } from 'react';
import type { AppConfig, ReviewState } from '@self-review/core';
import type { ReviewAdapter } from './adapter';
import { ReviewAdapterProvider } from './context/ReviewAdapterContext';
import { ConfigProvider } from './context/ConfigContext';
import { ReviewProvider, useReview } from './context/ReviewContext';
import { DiffNavigationProvider } from './context/DiffNavigationContext';
import { TooltipProvider } from './components/ui/tooltip';
import Layout from './components/Layout';
import { KeyboardNavigationManager } from './components/KeyboardNavigationManager';

/**
 * Imperative handle exposed by ReviewPanel via React ref.
 *
 * Allows the host application to read the current review state
 * without the library owning any "submit" UI.
 *
 * ```tsx
 * const ref = useRef<ReviewPanelHandle>(null);
 *
 * <ReviewPanel ref={ref} adapter={adapter} />
 * <button onClick={() => {
 *   const state = ref.current?.getReviewState();
 *   sendToBackend(JSON.stringify(state));
 * }}>Submit Review</button>
 * ```
 */
export interface ReviewPanelHandle {
  /** Return the current review state (comments, viewed flags, source metadata). */
  getReviewState: () => ReviewState;
}

export interface ReviewPanelProps {
  /** Platform adapter for data loading and lifecycle hooks. */
  adapter: ReviewAdapter;
  /** Optional partial config to merge with defaults (theme, categories, etc.). */
  config?: Partial<AppConfig>;
  /** CSS class applied to the root container. */
  className?: string;
  /** Prism CSS string for light theme (for non-webpack environments). */
  prismLightCss?: string;
  /** Prism CSS string for dark theme (for non-webpack environments). */
  prismDarkCss?: string;
  /**
   * Optional children rendered inside the provider tree, above the
   * diff viewer. Use this to slot in host-owned chrome like a Toolbar.
   *
   * Children have access to all review context hooks (useReview,
   * useConfig, useDiffNavigationContext, etc.).
   */
  children?: ReactNode;
}

/**
 * Multi-file review panel with file tree sidebar and diff viewer.
 *
 * Renders the diff viewer, file tree, and inline commenting experience.
 * Does **not** include any application chrome (toolbar, finish button).
 * The host application owns the "finish review" flow and reads the
 * review state via the imperative ref handle.
 *
 * ```tsx
 * import { ReviewPanel, ReviewPanelHandle, Toolbar } from '@self-review/react';
 * import '@self-review/react/styles.css';
 *
 * const ref = useRef<ReviewPanelHandle>(null);
 *
 * <ReviewPanel
 *   ref={ref}
 *   adapter={{ loadDiff: async () => fetchDiff() }}
 *   config={{ theme: 'dark' }}
 * >
 *   <Toolbar />
 * </ReviewPanel>
 * <button onClick={() => {
 *   const state = ref.current?.getReviewState();
 *   // state is a plain object — serialize however you like
 * }}>Finish Review</button>
 * ```
 */
export const ReviewPanel = forwardRef<ReviewPanelHandle, ReviewPanelProps>(
  function ReviewPanel(
    { adapter, config, className, prismLightCss, prismDarkCss, children },
    ref,
  ) {
    return (
      <ReviewAdapterProvider adapter={adapter}>
        <ConfigProvider
          initialConfig={config}
          prismLightCss={prismLightCss}
          prismDarkCss={prismDarkCss}
        >
          <ReviewProvider>
            <DiffNavigationProvider>
              <TooltipProvider>
                <ReviewPanelInner ref={ref} className={className}>
                  {children}
                </ReviewPanelInner>
              </TooltipProvider>
            </DiffNavigationProvider>
          </ReviewProvider>
        </ConfigProvider>
      </ReviewAdapterProvider>
    );
  },
);

/**
 * Inner component that lives inside all providers and can therefore
 * use useReview() to expose state through the imperative handle.
 */
const ReviewPanelInner = forwardRef<ReviewPanelHandle, { className?: string; children?: ReactNode }>(
  function ReviewPanelInner({ className, children }, ref) {
    const { files, diffSource } = useReview();
    const filesRef = useRef(files);
    const diffSourceRef = useRef(diffSource);
    filesRef.current = files;
    diffSourceRef.current = diffSource;

    useImperativeHandle(ref, () => ({
      getReviewState: (): ReviewState => ({
        timestamp: new Date().toISOString(),
        source: diffSourceRef.current,
        files: filesRef.current,
      }),
    }));

    return (
      <div className={className}>
        <KeyboardNavigationManager />
        {children}
        <Layout />
      </div>
    );
  },
);
