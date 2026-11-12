import React, { forwardRef, type ReactNode } from 'react';
import type { AppConfig, ReviewComment } from '@self-review/types';
import type { ReviewAdapter } from './adapter';
import type { ReviewServices } from './context/ReviewServicesContext';
import type { PreviewRenderingProviderProps } from './context/PreviewRenderingContext';
import { ReviewProviders } from './ReviewProviders';
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

export interface ReviewPanelProps extends Pick<
  PreviewRenderingProviderProps,
  'previewRenderer' | 'diagramRenderer'
> {
  /** A different adapter object starts a new session: define it at module scope or memoize it. */
  adapter: ReviewAdapter;
  /** Optional metadata dependencies scoped to this review. */
  services?: Partial<ReviewServices>;
  /** Initial configuration, merged once per mount. Later prop changes are ignored. */
  initialConfig?: Partial<AppConfig>;
  /** @deprecated Use initialConfig. Initial-only alias, ignored when initialConfig is supplied. */
  config?: Partial<AppConfig>;
  /** CSS class applied to the root container. */
  className?: string;
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
export const ReviewPanel = forwardRef<ReviewPanelHandle, ReviewPanelProps>(function ReviewPanel(
  {
    adapter,
    config,
    initialConfig,
    className,
    children,
    onReviewChange,
    previewRenderer,
    diagramRenderer,
    services,
  },
  ref
) {
  return (
    <ReviewProviders
      adapter={adapter}
      config={config}
      initialConfig={initialConfig}
      previewRenderer={previewRenderer}
      diagramRenderer={diagramRenderer}
      services={services}
    >
      <ReviewPanelInner ref={ref} className={className} onReviewChange={onReviewChange}>
        {children}
      </ReviewPanelInner>
    </ReviewProviders>
  );
});

/**
 * Inner component that lives inside all providers and can therefore
 * use useReviewBridge() to expose state through the imperative handle
 * and reactive callback.
 */
const ReviewPanelInner = forwardRef<
  ReviewPanelHandle,
  { className?: string; children?: ReactNode; onReviewChange?: (comments: ReviewComment[]) => void }
>(function ReviewPanelInner({ className, children, onReviewChange }, ref) {
  useReviewBridge(ref, onReviewChange);

  return (
    <div className={className}>
      <KeyboardNavigationManager />
      {children}
      <Layout />
    </div>
  );
});
