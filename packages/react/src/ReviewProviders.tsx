import React, { type ReactNode } from 'react';
import type { AppConfig } from '@self-review/types';
import type { ReviewAdapter } from './adapter';
import { ReviewAdapterProvider } from './context/ReviewAdapterContext';
import { ConfigProvider } from './context/ConfigContext';
import { GuideProvider } from './context/GuideContext';
import { ReviewProvider, type ReviewProviderProps } from './context/ReviewContext';
import { DiffNavigationProvider } from './context/DiffNavigationContext';
import { TooltipProvider } from './components/ui/tooltip';

export interface ReviewProvidersProps extends ReviewProviderProps {
  adapter: ReviewAdapter;
  config?: Partial<AppConfig>;
  children: ReactNode;
}

/** Shared host composition. Children may render a review, loading view, or welcome screen. */
export function ReviewProviders({ adapter, config, children, ...session }: ReviewProvidersProps) {
  return (
    <ReviewAdapterProvider adapter={adapter}>
      <ConfigProvider initialConfig={config}>
        <GuideProvider>
          <ReviewProvider {...session}>
            <DiffNavigationProvider>
              <TooltipProvider>{children}</TooltipProvider>
            </DiffNavigationProvider>
          </ReviewProvider>
        </GuideProvider>
      </ConfigProvider>
    </ReviewAdapterProvider>
  );
}
