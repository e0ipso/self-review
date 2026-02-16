import React from 'react';
import { ConfigProvider } from './context/ConfigContext';
import { ReviewProvider, useReview } from './context/ReviewContext';
import { DiffNavigationProvider } from './context/DiffNavigationContext';
import { TooltipProvider } from './components/ui/tooltip';
import Toolbar from './components/Toolbar';
import Layout from './components/Layout';
import CloseConfirmDialog from './components/CloseConfirmDialog';
import { KeyboardNavigationManager } from './components/KeyboardNavigationManager';
import WelcomeScreen from './components/WelcomeScreen';

function AppContent() {
  const { diffSource } = useReview();

  if (diffSource.type === 'welcome') {
    return <WelcomeScreen />;
  }

  return (
    <DiffNavigationProvider>
      <TooltipProvider>
        <KeyboardNavigationManager />
        <div className='flex flex-col h-screen bg-background text-foreground antialiased'>
          <Toolbar />
          <Layout />
        </div>
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
