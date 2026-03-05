import React, { useRef } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ReviewPanel,
  Toolbar,
} from '../../packages/react/src/index';
import type { ReviewPanelHandle } from '../../packages/react/src/index';
import type { ReviewAdapter } from '../../packages/react/src/adapter';
import type { AppConfig, DiffLoadPayload, CategoryDef } from '../../packages/core/src/types';
import { createFixturePayload, defaultCategories, commentingCategories } from './fixture-data';
import './styles.css';

/**
 * Mock webapp for e2e testing the @self-review/react library.
 *
 * Demonstrates the embedding pattern: the host app renders its own
 * chrome (Toolbar, Finish Review button) and uses the ref handle to
 * read the review state when ready.
 *
 * URL parameters control behavior:
 * - ?categories=commenting  — Use commenting test categories (bug, nit, question)
 * - ?theme=dark|light        — Set initial theme
 * - ?view=split|unified      — Set initial view mode
 */

function getUrlParam(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}

function getCategories(): CategoryDef[] {
  const preset = getUrlParam('categories');
  if (preset === 'commenting') return commentingCategories;
  return defaultCategories;
}

function getConfig(): Partial<AppConfig> {
  const config: Partial<AppConfig> = {
    categories: getCategories(),
    showUntracked: true,
    wordWrap: true,
  };
  const theme = getUrlParam('theme');
  if (theme === 'dark' || theme === 'light' || theme === 'system') {
    config.theme = theme;
  }
  const view = getUrlParam('view');
  if (view === 'split' || view === 'unified') {
    config.diffView = view;
  }
  return config;
}

const adapter: ReviewAdapter = {
  loadDiff: async (): Promise<DiffLoadPayload> => {
    return createFixturePayload();
  },
};

function App() {
  const reviewRef = useRef<ReviewPanelHandle>(null);

  const handleFinishReview = () => {
    const state = reviewRef.current?.getReviewState();
    if (state) {
      // Store in a DOM-accessible way for test assertions
      const el = document.createElement('script');
      el.type = 'application/json';
      el.id = 'review-state';
      el.textContent = JSON.stringify(state);
      document.body.appendChild(el);
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ReviewPanel
        ref={reviewRef}
        adapter={adapter}
        config={getConfig()}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <Toolbar onFinishReview={handleFinishReview} />
      </ReviewPanel>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
