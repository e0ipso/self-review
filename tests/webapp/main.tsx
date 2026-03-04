import React from 'react';
import { createRoot } from 'react-dom/client';
import { ReviewPanel } from '../../packages/react/src/index';
import type { ReviewAdapter } from '../../packages/react/src/adapter';
import type { AppConfig, ReviewState, DiffLoadPayload, CategoryDef } from '../../packages/core/src/types';
import { createFixturePayload, defaultCategories, commentingCategories } from './fixture-data';
import './styles.css';

/**
 * Mock webapp for e2e testing the @self-review/react library.
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

// Store the last submitted review state for test assertions
let lastReviewState: ReviewState | null = null;
(window as unknown as Record<string, unknown>).__getLastReviewState = () => lastReviewState;

const adapter: ReviewAdapter = {
  loadDiff: async (): Promise<DiffLoadPayload> => {
    return createFixturePayload();
  },
  submitReview: async (state: ReviewState) => {
    lastReviewState = state;
    // Store in a DOM-accessible way for test assertions
    const el = document.createElement('script');
    el.type = 'application/json';
    el.id = 'review-state';
    el.textContent = JSON.stringify(state);
    document.body.appendChild(el);
  },
};

function App() {
  const handleFinishReview = () => {
    // Trigger submitReview via the adapter — ReviewPanel calls it
    // For the mock, we just store the state (already handled by submitReview)
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ReviewPanel
        adapter={adapter}
        config={getConfig()}
        onFinishReview={handleFinishReview}
        className="flex-1 flex flex-col overflow-hidden"
      />
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
