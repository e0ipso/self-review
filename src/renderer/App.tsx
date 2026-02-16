import React from 'react';
import { ConfigProvider } from './context/ConfigContext';
import { ReviewProvider } from './context/ReviewContext';
import { DiffNavigationProvider } from './context/DiffNavigationContext';
import { TooltipProvider } from './components/ui/tooltip';
import Toolbar from './components/Toolbar';
import Layout from './components/Layout';
import CloseConfirmDialog from './components/CloseConfirmDialog';
import { KeyboardNavigationManager } from './components/KeyboardNavigationManager';

export default function App() {
  return (
    <ConfigProvider>
      <ReviewProvider>
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
      </ReviewProvider>
    </ConfigProvider>
  );
}
