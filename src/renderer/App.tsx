import React, { useState, useCallback, useEffect, useRef, useLayoutEffect } from 'react';
import { ConfigProvider, useConfig } from '../../packages/react/src/context/ConfigContext';
import { ReviewProvider, useReview } from '../../packages/react/src/context/ReviewContext';
import { DiffNavigationProvider } from '../../packages/react/src/context/DiffNavigationContext';
import { ReviewAdapterProvider } from '../../packages/react/src/context/ReviewAdapterContext';
import { TooltipProvider } from '../../packages/react/src/components/ui/tooltip';
import Toolbar from '../../packages/react/src/components/Toolbar';
import Layout from '../../packages/react/src/components/Layout';
import CloseConfirmDialog from './components/CloseConfirmDialog';
import { KeyboardNavigationManager } from '../../packages/react/src/components/KeyboardNavigationManager';
import { FindBar } from './components/FindBar';
import WelcomeScreen from './components/WelcomeScreen';
import UpdateBanner from './components/UpdateBanner';
import type { ReviewAdapter } from '../../packages/react/src/adapter';
import type { AppConfig, OutputPathInfo } from '@self-review/core';
import lightThemeCss from 'prismjs/themes/prism.css?raw';
import darkThemeCss from 'prism-themes/themes/prism-one-dark.css?raw';

// Electron platform adapter — wraps window.electronAPI for the package context.
const electronAdapter: ReviewAdapter = {
  loadDiff: () =>
    new Promise(resolve => {
      window.electronAPI.onDiffLoad(resolve);
      window.electronAPI.requestDiffData();
    }),
  loadResumedComments: () =>
    new Promise(resolve => {
      window.electronAPI.onResumeLoad(payload => resolve(payload.comments));
      window.electronAPI.requestResumeData();
    }),
  submitReview: state => {
    window.electronAPI.submitReview(state);
  },
  expandContext: request => window.electronAPI.expandContext(request),
  loadFileContent: filePath => window.electronAPI.loadFileContent(filePath),
  readAttachment: filePath => window.electronAPI.readAttachment(filePath),
  changeOutputPath: () => window.electronAPI.changeOutputPath(),
  loadImage: filePath => window.electronAPI.loadImage(filePath),
};

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
    window.electronAPI.onOutputPathChanged(info => {
      setOutputPathInfo(info);
    });
  }, [setOutputPathInfo]);

  // Keep refs current so the onRequestReview fallback always sends fresh state
  const diffSourceRef = useRef(diffSource);
  const filesRef = useRef(files);
  useLayoutEffect(() => { diffSourceRef.current = diffSource; }, [diffSource]);
  useLayoutEffect(() => { filesRef.current = files; }, [files]);

  // Fallback: respond when main process pulls state via review:request
  // (e.g. when saveAndQuit is called without a prior submitReview)
  useEffect(() => {
    window.electronAPI.onRequestReview(() => {
      window.electronAPI.submitReview({
        timestamp: new Date().toISOString(),
        source: diffSourceRef.current,
        files: filesRef.current,
      });
    });
  }, []);

  // Host-driven finish: push state then trigger save
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
      <div className="flex items-center justify-center h-screen bg-background">
        <svg
          className="animate-spin h-8 w-8 text-muted-foreground"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
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
          <Toolbar onFinishReview={handleFinishReview} />
          <div className='flex-1 min-h-0'>
            <Layout />
          </div>
        </div>
        <FindBar isOpen={isFindBarOpen} onClose={() => setIsFindBarOpen(false)} />
        <CloseConfirmDialog />
      </TooltipProvider>
    </DiffNavigationProvider>
  );
}

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [outputPathInfo, setOutputPathInfo] = useState<OutputPathInfo | null>(null);

  // Load config via IPC before mounting package providers
  useEffect(() => {
    window.electronAPI.onConfigLoad((cfg, pathInfo) => {
      setConfig(cfg);
      if (pathInfo) setOutputPathInfo(pathInfo);
    });
    window.electronAPI.requestConfig();
  }, []);

  if (!config) return null;

  return (
    <ReviewAdapterProvider adapter={electronAdapter}>
      <ConfigProvider
        initialConfig={config}
        initialOutputPath={outputPathInfo ?? undefined}
        prismLightCss={lightThemeCss}
        prismDarkCss={darkThemeCss}
      >
        <ReviewProvider>
          <AppContent />
        </ReviewProvider>
      </ConfigProvider>
    </ReviewAdapterProvider>
  );
}
