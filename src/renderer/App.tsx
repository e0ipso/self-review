import React, { useState, useCallback, useEffect } from 'react';
import { useConfig } from '../../packages/react/src/context/ConfigContext';
import { useReview } from '../../packages/react/src/context/ReviewContext';
import { ReviewProviders } from '../../packages/react/src/ReviewProviders';
import { Button } from '../../packages/react/src/components/ui/button';
import Toolbar from '../../packages/react/src/components/Toolbar';
import Layout from '../../packages/react/src/components/Layout';
import CloseConfirmDialog from './components/CloseConfirmDialog';
import AboutDialog from './components/AboutDialog';
import { KeyboardNavigationManager } from '../../packages/react/src/components/KeyboardNavigationManager';
import { FindBar } from './components/FindBar';
import WelcomeScreen from './components/WelcomeScreen';
import UpdateBanner from './components/UpdateBanner';
import RemoteDriftBanner from '../../packages/react/src/components/RemoteDriftBanner';
import ImportDiagnosticsBanner from '../../packages/react/src/components/ImportDiagnosticsBanner';
import type { AppConfig, OutputPathInfo, ApplicationLocale } from '../shared/types';

import { resolveApplicationLocale, resolveDesktopCatalog } from '../shared/localization';
import { ElectronRequests } from './electron-requests';
import { createElectronAdapter } from './electron-adapter';
import { receiveDesktopContent } from './desktop-content';
import { useDesktopLocalization } from './useDesktopLocalization';
import { useSaveReview, SaveReviewBoundary } from './useSaveReview';
import {
  LocalizationProvider,
  useLocalization,
} from '../../packages/react/src/localization/LocalizationContext';

function AppContent() {
  const { t } = useDesktopLocalization();
  const { diffSource } = useReview();
  const { setOutputPathInfo } = useConfig();
  const [isFindBarOpen, setIsFindBarOpen] = useState(false);

  const toggleFindBar = useCallback(() => {
    setIsFindBarOpen(prev => !prev);
  }, []);

  // Handle Ctrl/Cmd+F to toggle find bar
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        toggleFindBar();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggleFindBar]);

  // Forward IPC output-path changes into the package config context
  useEffect(() => {
    return window.electronAPI.onOutputPathChanged(info => {
      setOutputPathInfo(info);
    });
  }, [setOutputPathInfo]);

  const handleFinishReview = useSaveReview(window.electronAPI);

  if (diffSource.type === 'welcome') {
    return <WelcomeScreen />;
  }

  if (diffSource.type === 'loading') {
    return (
      <div
        role='status'
        aria-label={t('Loading review')}
        className='flex items-center justify-center h-screen bg-background'
      >
        <svg
          aria-hidden='true'
          className='animate-spin motion-reduce:animate-none h-8 w-8 text-muted-foreground'
          xmlns='http://www.w3.org/2000/svg'
          fill='none'
          viewBox='0 0 24 24'
        >
          <circle
            className='opacity-25'
            cx='12'
            cy='12'
            r='10'
            stroke='currentColor'
            strokeWidth='4'
          />
          <path
            className='opacity-75'
            fill='currentColor'
            d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
          />
        </svg>
      </div>
    );
  }

  return (
    <>
      <KeyboardNavigationManager />
      <div className='flex flex-col h-screen overflow-hidden bg-background text-foreground antialiased'>
        <UpdateBanner />
        <RemoteDriftBanner />
        <ImportDiagnosticsBanner />
        <Toolbar onFinishReview={handleFinishReview} />
        <div className='flex-1 min-h-0'>
          <Layout />
        </div>
      </div>
      <FindBar isOpen={isFindBarOpen} onClose={() => setIsFindBarOpen(false)} />
      <CloseConfirmDialog />
      <AboutDialog />
    </>
  );
}

function DesktopApp() {
  const { t } = useDesktopLocalization();
  const [host, setHost] = useState<{
    bridge: ReturnType<typeof createElectronAdapter>;
    config: AppConfig;
    outputPathInfo?: OutputPathInfo;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const { locale, direction } = useLocalization();
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = direction;
  }, [locale, direction]);

  // Each effect setup owns a new adapter, including StrictMode's setup/cleanup replay.
  useEffect(() => {
    let active = true;
    const bridge = createElectronAdapter(window.electronAPI);
    const offConfig = window.electronAPI.onConfigLoad((config, outputPathInfo) => {
      if (active)
        setHost(previous =>
          previous?.bridge === bridge
            ? { bridge, config, outputPathInfo: outputPathInfo ?? previous.outputPathInfo }
            : previous
        );
    });
    setHost(null);
    setError(null);
    void receiveDesktopContent<{ config: AppConfig; outputPathInfo?: OutputPathInfo }>(
      bridge.requests,
      window.electronAPI,
      'config',
      callback =>
        window.electronAPI.onConfigLoad((config, outputPathInfo) =>
          callback({ config, outputPathInfo })
        ),
      window.electronAPI.requestConfig
    ).then(
      value => {
        if (active) setHost({ bridge, ...value });
      },
      reason => {
        if (active) setError(reason instanceof Error ? reason.message : String(reason));
      }
    );
    return () => {
      active = false;
      offConfig();
      bridge.dispose();
    };
  }, [attempt]);

  if (error)
    return (
      <div role='alert'>
        {error}
        <Button onClick={() => setAttempt(value => value + 1)}>{t('Retry')}</Button>
      </div>
    );
  if (!host) return null;
  return (
    <ReviewProviders
      adapter={host.bridge.adapter}
      config={host.config}
      initialOutputPath={host.outputPathInfo}
    >
      <SaveReviewBoundary>
        <AppContent />
      </SaveReviewBoundary>
    </ReviewProviders>
  );
}

export default function App() {
  const [locale, setLocale] = useState<ApplicationLocale | null>(null);
  useEffect(() => {
    let active = true;
    const requests = new ElectronRequests();
    const request =
      (window.electronAPI.getApplicationLocale
        ? requests.invoke(() => window.electronAPI.getApplicationLocale!())
        : undefined) ?? Promise.resolve({ locale: 'en', direction: 'ltr' as const });
    void request.then(
      value => {
        if (active)
          setLocale({ ...resolveApplicationLocale(value.locale), direction: value.direction });
      },
      () => {
        if (active) setLocale({ locale: 'en', direction: 'ltr' });
      }
    );
    return () => {
      active = false;
      requests.dispose();
    };
  }, []);
  if (!locale) return null;
  return (
    <LocalizationProvider
      locale={locale.locale}
      direction={locale.direction}
      messages={resolveDesktopCatalog(locale.locale)}
    >
      <DesktopApp />
    </LocalizationProvider>
  );
}
