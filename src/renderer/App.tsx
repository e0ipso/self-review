import React, { useState, useCallback, useEffect } from 'react';
import { ConfigProvider } from './context/ConfigContext';
import { ReviewProvider, useReview } from './context/ReviewContext';
import { DiffNavigationProvider } from './context/DiffNavigationContext';
import { TooltipProvider } from './components/ui/tooltip';
import Toolbar from './components/Toolbar';
import Layout from './components/Layout';
import CloseConfirmDialog from './components/CloseConfirmDialog';
import { KeyboardNavigationManager } from './components/KeyboardNavigationManager';
import { FindBar } from './components/FindBar';
import WelcomeScreen from './components/WelcomeScreen';
import UpdateBanner from './components/UpdateBanner';

function AppContent() {
  const { diffSource } = useReview();
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
        <div className='flex flex-col h-screen bg-background text-foreground antialiased'>
          <UpdateBanner />
          <Toolbar />
          <Layout />
        </div>
        <FindBar isOpen={isFindBarOpen} onClose={() => setIsFindBarOpen(false)} />
        <CloseConfirmDialog />
      </TooltipProvider>
    </DiffNavigationProvider>
  );
}

export default function App() {
  return (
    <ConfigProvider>
      <ReviewProvider>
        <AppContent />
      </ReviewProvider>
    </ConfigProvider>
  );
}
