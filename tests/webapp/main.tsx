import React, { useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { ReviewPanel, Toolbar } from '../../packages/react/src/index';
import type { ReviewPanelHandle } from '../../packages/react/src/index';
import type { ReviewAdapter } from '../../packages/react/src/adapter';
import type {
  AppConfig,
  ApplyDestinationOutcome,
  CategoryDef,
  DiffLoadPayload,
  SuggestionApplyOutcome,
  SuggestionApplyRequest,
} from '../../packages/core/src/types';
import {
  createFixturePayload,
  createEmptyPayload,
  createMarkdownPayload,
  createRenderedHtmlPayload,
  createGuideFixturePayload,
  createRemoteSession,
  defaultCategories,
  commentingCategories,
} from './fixture-data';
import './styles.css';

/**
 * Mock webapp for e2e testing the @self-review/react library.
 *
 * Demonstrates the embedding pattern: the host app renders its own
 * chrome (Toolbar, Finish Review button) and uses the ref handle to
 * read the review state when ready.
 *
 * URL parameters control behavior:
 * - ?fixture=empty|markdown|rendered-html   — Select fixture dataset (default: full fixture)
 * - ?gitDiffArgs=...          — Pass gitDiffArgs to empty fixture
 * - ?categories=commenting    — Use commenting test categories (bug, nit, question)
 * - ?theme=dark|light         — Set initial theme
 * - ?view=split|unified       — Set initial view mode
 * - ?guide=walkthrough        — Inject the walkthrough guide fixture (pushed
 *                               through adapter.onGuideLoad, same seam the
 *                               Electron app uses for guide:load)
 * - ?remote=temporary|reused  — Mark the session as a remote PR/MR materialized
 *                               into a temporary clone, or into a clone the
 *                               user already owned
 * - ?apply=applied|refused    — Give the adapter an applySuggestion (omitted by
 *                               default, which is why no Apply control renders)
 * - ?destination=chosen|cancelled|rejected — Give the adapter a
 *                               chooseApplyDestination with that answer
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

function getFixturePayload(): DiffLoadPayload {
  const fixture = getUrlParam('fixture');
  const gitDiffArgs = getUrlParam('gitDiffArgs') ?? undefined;
  if (fixture === 'empty') return createEmptyPayload(gitDiffArgs);
  if (fixture === 'markdown') return createMarkdownPayload();
  if (fixture === 'rendered-html') return createRenderedHtmlPayload();
  const remote = getUrlParam('remote');
  if (remote === 'temporary' || remote === 'reused') {
    return { ...createFixturePayload(), remote: createRemoteSession(remote === 'temporary') };
  }
  return createFixturePayload();
}

/**
 * The apply half of the adapter, assembled from URL params.
 *
 * A host is only offered an Apply control when it implements
 * `applySuggestion`, so the default here implements nothing: an embedding
 * with no writable destination is the shipped default, not an oversight.
 *
 * The stubs stand in for the Electron host's answers (the session handlers
 * in packages/core/src/review-handlers.ts), never for the apply engine.
 * They hold one piece of host state — the destination directory a
 * temporary-clone session lacks until the reviewer names one — because the
 * UI branch under test is exactly the sequencing around it.
 */
function createApplyAdapter(): {
  applySuggestion?: (request: SuggestionApplyRequest) => Promise<SuggestionApplyOutcome>;
  chooseApplyDestination?: () => Promise<ApplyDestinationOutcome>;
} {
  const mode = getUrlParam('apply');
  if (mode !== 'applied' && mode !== 'refused') return {};

  let destinationRoot: string | null =
    getUrlParam('remote') === 'temporary' ? null : '/mock-test-repo';

  const applySuggestion = async (
    request: SuggestionApplyRequest
  ): Promise<SuggestionApplyOutcome> => {
    if (!destinationRoot) {
      return {
        status: 'refused',
        filePath: request.filePath,
        reason: 'destination-required',
        detail:
          'This pull request was cloned into a temporary directory that is deleted when the review ends. Choose a destination directory to apply into.',
      };
    }
    if (mode === 'refused') {
      return {
        status: 'refused',
        filePath: request.filePath,
        reason: 'context-mismatch',
        detail: 'Those lines no longer match the code this suggestion was written against.',
      };
    }
    return {
      status: 'applied',
      filePath: request.filePath,
      replacedLines: request.suggestion.originalCode.split('\n').length,
    };
  };

  const answer = getUrlParam('destination');
  if (answer !== 'chosen' && answer !== 'cancelled' && answer !== 'rejected') {
    return { applySuggestion };
  }

  const chooseApplyDestination = async (): Promise<ApplyDestinationOutcome> => {
    if (answer === 'cancelled') return { status: 'cancelled' };
    if (answer === 'rejected') {
      return {
        status: 'rejected',
        reason: 'destination-inside-temporary-clone',
        detail:
          'That directory is inside the temporary clone, which is deleted when the review ends.',
      };
    }
    destinationRoot = '/mock-apply-destination';
    return { status: 'chosen', destinationRoot };
  };

  return { applySuggestion, chooseApplyDestination };
}

const adapter: ReviewAdapter = {
  loadDiff: async (): Promise<DiffLoadPayload> => {
    return getFixturePayload();
  },
  onGuideLoad: callback => {
    if (getUrlParam('guide') === 'walkthrough') {
      callback(createGuideFixturePayload());
    }
    return () => {};
  },
  ...createApplyAdapter(),
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
        className='flex-1 flex flex-col overflow-hidden bg-background text-foreground'
      >
        <Toolbar onFinishReview={handleFinishReview} />
      </ReviewPanel>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
