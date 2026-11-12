import React, { type ReactNode } from 'react';
import type { AppConfig, OutputPathInfo } from '@self-review/types';
import type { ReviewAdapter } from './adapter';
import { ReviewAdapterProvider } from './context/ReviewAdapterContext';
import { ConfigProvider } from './context/ConfigContext';
import { GuideProvider } from './context/GuideContext';
import { ReviewProvider, type ReviewProviderProps } from './context/ReviewContext';
import { DiffNavigationProvider } from './context/DiffNavigationContext';
import {
  PreviewRenderingProvider,
  type PreviewRenderingProviderProps,
} from './context/PreviewRenderingContext';
import { TooltipProvider } from './components/ui/tooltip';

export interface ReviewProvidersProps
  extends
    ReviewProviderProps,
    Pick<PreviewRenderingProviderProps, 'previewRenderer' | 'diagramRenderer'> {
  adapter: ReviewAdapter;
  /** Initial configuration, merged once per mount. Later prop changes are ignored. */
  initialConfig?: Partial<AppConfig>;
  /** @deprecated Use initialConfig. Initial-only alias, ignored when initialConfig is supplied. */
  config?: Partial<AppConfig>;
  initialOutputPath?: OutputPathInfo;
  children: ReactNode;
}

/** Shared host composition. Children may render a review, loading view, or welcome screen. */
export function ReviewProviders({
  adapter,
  config,
  initialConfig,
  initialOutputPath,
  children,
  previewRenderer,
  diagramRenderer,
  ...session
}: ReviewProvidersProps) {
  return (
    <ReviewAdapterProvider adapter={adapter}>
      <ConfigProvider initialConfig={initialConfig ?? config} initialOutputPath={initialOutputPath}>
        <GuideProvider>
          <ReviewProvider {...session}>
            <DiffNavigationProvider>
              <PreviewRenderingProvider
                previewRenderer={previewRenderer}
                diagramRenderer={diagramRenderer}
              >
                <TooltipProvider>{children}</TooltipProvider>
              </PreviewRenderingProvider>
            </DiffNavigationProvider>
          </ReviewProvider>
        </GuideProvider>
      </ConfigProvider>
    </ReviewAdapterProvider>
  );
}
