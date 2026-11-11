import React, { useState, useCallback, useEffect } from 'react';
import { ConfigProvider, useConfig } from '../../packages/react/src/context/ConfigContext';
import { ReviewProvider, useReview } from '../../packages/react/src/context/ReviewContext';
import { DiffNavigationProvider } from '../../packages/react/src/context/DiffNavigationContext';
import { ReviewAdapterProvider } from '../../packages/react/src/context/ReviewAdapterContext';
import { GuideProvider } from '../../packages/react/src/context/GuideContext';
import { TooltipProvider } from '../../packages/react/src/components/ui/tooltip';
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
import type { AppConfig, OutputPathInfo } from '../shared/types';

import { createElectronAdapter } from './electron-adapter';
import {
  LocalizationProvider,
  useLocalization,
} from '../../packages/react/src/localization/LocalizationContext';

function AppContent() {
  const { diffSource, files } = useReview();
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

  // Main never pulls state: a save with no pushed state is reported and writes nothing.
  const handleFinishReview = useCallback(() => {
    window.electronAPI.submitReview({
      timestamp: new Date().toISOString(),
      source: diffSource,
      files,
    });
    window.electronAPI.saveAndQuit();
  }, [diffSource, files]);

  if (diffSource.type === 'welcome') {
    return <WelcomeScreen />;
  }

  if (diffSource.type === 'loading') {
    return (
      <div
        role='status'
        aria-label='Loading review'
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
    <DiffNavigationProvider>
      <TooltipProvider>
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
      </TooltipProvider>
    </DiffNavigationProvider>
  );
}

export default function App() {
  const [bridge] = useState(() => createElectronAdapter(window.electronAPI));
  const { locale, direction } = useLocalization();
  useEffect(() => () => bridge.dispose(), [bridge]);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = direction;
  }, [locale, direction]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [outputPathInfo, setOutputPathInfo] = useState<OutputPathInfo | null>(null);

  // Load config via IPC before mounting package providers
  useEffect(() => {
    const unsubscribe = window.electronAPI.onConfigLoad((cfg, pathInfo) => {
      setConfig(cfg);
      if (pathInfo) setOutputPathInfo(pathInfo);
    });
    window.electronAPI.requestConfig();
    return unsubscribe;
  }, []);

  if (!config) return null;

  return (
    <LocalizationProvider>
      <ReviewAdapterProvider adapter={bridge.adapter}>
        <ConfigProvider initialConfig={config} initialOutputPath={outputPathInfo ?? undefined}>
          <GuideProvider>
            <ReviewProvider>
              <AppContent />
            </ReviewProvider>
          </GuideProvider>
        </ConfigProvider>
      </ReviewAdapterProvider>
    </LocalizationProvider>
  );
}
