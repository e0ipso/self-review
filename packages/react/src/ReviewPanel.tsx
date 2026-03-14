import React, { forwardRef, type ReactNode } from 'react';
import type { AppConfig, ReviewComment } from '@self-review/types';
import type { ReviewAdapter } from './adapter';
import { ReviewAdapterProvider } from './context/ReviewAdapterContext';
import { ConfigProvider } from './context/ConfigContext';
import { ReviewProvider } from './context/ReviewContext';
import { DiffNavigationProvider } from './context/DiffNavigationContext';
import { TooltipProvider } from './components/ui/tooltip';
import Layout from './components/Layout';
import { KeyboardNavigationManager } from './components/KeyboardNavigationManager';
import { type ReviewHandle, useReviewBridge } from './hooks/useReviewBridge';

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
export type ReviewPanelHandle = ReviewHandle;

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
  /** Called when review comments change. */
  onReviewChange?: (comments: ReviewComment[]) => void;
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
    { adapter, config, className, prismLightCss, prismDarkCss, children, onReviewChange },
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
                <ReviewPanelInner ref={ref} className={className} onReviewChange={onReviewChange}>
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
 * use useReviewBridge() to expose state through the imperative handle
 * and reactive callback.
 */
const ReviewPanelInner = forwardRef<ReviewPanelHandle, { className?: string; children?: ReactNode; onReviewChange?: (comments: ReviewComment[]) => void }>(
  function ReviewPanelInner({ className, children, onReviewChange }, ref) {
    useReviewBridge(ref, onReviewChange);

    return (
      <div className={className}>
        <KeyboardNavigationManager />
        {children}
        <Layout />
      </div>
    );
  },
);
