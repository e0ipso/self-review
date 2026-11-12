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
import { ReviewServicesProvider, type ReviewServices } from './context/ReviewServicesContext';
import { TooltipProvider } from './components/ui/tooltip';

export interface ReviewProvidersProps
  extends
    ReviewProviderProps,
    Pick<PreviewRenderingProviderProps, 'previewRenderer' | 'diagramRenderer'> {
  adapter: ReviewAdapter;
  /** Optional per-review metadata services. Defaults retain browser UUIDs and wall-clock time. */
  services?: Partial<ReviewServices>;
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
  services,
  ...session
}: ReviewProvidersProps) {
  return (
    <ReviewAdapterProvider adapter={adapter}>
      <ReviewServicesProvider services={services}>
        <ConfigProvider
          initialConfig={initialConfig ?? config}
          initialOutputPath={initialOutputPath}
        >
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
      </ReviewServicesProvider>
    </ReviewAdapterProvider>
  );
}
