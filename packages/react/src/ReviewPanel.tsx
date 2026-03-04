import React from 'react';
import type { AppConfig } from '@self-review/core';
import type { ReviewAdapter } from './adapter';
import { ReviewAdapterProvider } from './context/ReviewAdapterContext';
import { ConfigProvider } from './context/ConfigContext';
import { ReviewProvider } from './context/ReviewContext';
import { DiffNavigationProvider } from './context/DiffNavigationContext';
import { TooltipProvider } from './components/ui/tooltip';
import Layout from './components/Layout';
import Toolbar from './components/Toolbar';
import { KeyboardNavigationManager } from './components/KeyboardNavigationManager';

export interface ReviewPanelProps {
  /** Platform adapter for data loading and lifecycle hooks. */
  adapter: ReviewAdapter;
  /** Optional partial config to merge with defaults (theme, categories, etc.). */
  config?: Partial<AppConfig>;
  /** Called when user clicks "Finish Review". If not provided, the button is hidden. */
  onFinishReview?: () => void;
  /** CSS class applied to the root container. */
  className?: string;
  /** Prism CSS string for light theme (for non-webpack environments). */
  prismLightCss?: string;
  /** Prism CSS string for dark theme (for non-webpack environments). */
  prismDarkCss?: string;
}

/**
 * Multi-file review panel with file tree sidebar and diff viewer.
 *
 * Embeds a complete code review UI. Provide a `ReviewAdapter` to
 * load diff data, submit reviews, expand context, etc.
 *
 * ```tsx
 * import { ReviewPanel } from '@self-review/react';
 * import '@self-review/react/styles.css';
 *
 * <ReviewPanel
 *   adapter={{
 *     loadDiff: async () => fetchDiffFromServer(),
 *     onSubmitReview: async (state) => saveToDB(state),
 *   }}
 *   config={{ theme: 'dark' }}
 *   onFinishReview={() => handleFinish()}
 * />
 * ```
 */
export function ReviewPanel({
  adapter,
  config,
  onFinishReview,
  className,
  prismLightCss,
  prismDarkCss,
}: ReviewPanelProps) {
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
              <div className={className}>
                <KeyboardNavigationManager />
                <Toolbar onFinishReview={onFinishReview} />
                <Layout />
              </div>
            </TooltipProvider>
          </DiffNavigationProvider>
        </ReviewProvider>
      </ConfigProvider>
    </ReviewAdapterProvider>
  );
}
