import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { DiffFile, DiffLoadPayload, ResumeLoadPayload } from '@self-review/types';

import { installBrowserApiStubs } from '../test-helpers';
import { ConfigProvider } from '../context/ConfigContext';
import { ReviewProvider, useReview } from '../context/ReviewContext';
import { ReviewAdapterProvider } from '../context/ReviewAdapterContext';
import type { ReviewAdapter } from '../adapter';
import ImportDiagnosticsBanner from './ImportDiagnosticsBanner';

import { SessionStoreContext, ReviewContext } from '../context/review-context';

installBrowserApiStubs();

function diffFile(path: string): DiffFile {
  return { oldPath: path, newPath: path, changeType: 'modified', isBinary: false, hunks: [] };
}

const payload: DiffLoadPayload = {
  files: [diffFile('src/a.ts')],
  source: { type: 'git', gitDiffArgs: '', repository: '/repo' },
};

function renderBanner(resumed?: ResumeLoadPayload) {
  const adapter: ReviewAdapter = {
    loadDiff: async () => payload,
    ...(resumed ? { loadResumedReview: async () => resumed } : {}),
  };

  return render(
    <ReviewAdapterProvider adapter={adapter}>
      <ConfigProvider initialConfig={{}}>
        <ReviewProvider>
          <ImportDiagnosticsBanner />
        </ReviewProvider>
      </ConfigProvider>
    </ReviewAdapterProvider>
  );
}

describe('ImportDiagnosticsBanner', () => {
  it('lists every import diagnostic from the resumed review', async () => {
    renderBanner({
      comments: [],
      importDiagnostics: [
        'src/a.ts: comment 1 anchor new-line range is reversed (5 > 3); kept as file-level feedback',
        'src/a.ts: comment 2 anchor suggestion has no line anchor; kept as file-level feedback',
      ],
    });

    const banner = await screen.findByTestId('import-diagnostics-banner');
    expect(banner.textContent).toContain('2 resumed comments');
    expect(banner.textContent).toContain('reversed (5 > 3)');
    expect(banner.textContent).toContain('suggestion has no line anchor');
  });

  it('can be dismissed', async () => {
    renderBanner({
      comments: [],
      importDiagnostics: ['src/a.ts: comment 1 anchor x; kept as file-level feedback'],
    });

    await screen.findByTestId('import-diagnostics-banner');
    fireEvent.click(screen.getByTestId('import-diagnostics-banner-dismiss'));

    await waitFor(() => {
      expect(screen.queryByTestId('import-diagnostics-banner')).toBeNull();
    });
  });

  it('renders nothing for a clean resume or no resume at all', async () => {
    const { unmount } = renderBanner({ comments: [], importDiagnostics: [] });
    await waitFor(() => expect(screen.queryByTestId('import-diagnostics-banner')).toBeNull());
    unmount();

    renderBanner();
    await waitFor(() => expect(screen.queryByTestId('import-diagnostics-banner')).toBeNull());
  });
});

it('subscribes only to diagnostics and resets dismissal on session replacement', () => {
  let review!: import('../context/ReviewContext').ReviewContextValue;
  let store!: import('../context/review-session').ReviewSessionStore;
  function Capture() {
    review = useReview();
    store = React.useContext(SessionStoreContext)!;
    return null;
  }
  const commits = vi.fn();
  render(
    <ConfigProvider>
      <ReviewProvider initialFiles={payload.files} initialSource={payload.source}>
        <Capture />
        <React.Profiler id='diagnostics' onRender={commits}>
          <ImportDiagnosticsBanner />
        </React.Profiler>
      </ReviewProvider>
    </ConfigProvider>
  );
  act(() =>
    store.dispatch({
      type: 'resume',
      resumed: { comments: [], importDiagnostics: ['First diagnostic'] },
    })
  );
  expect(screen.getByText('First diagnostic')).toBeTruthy();
  const before = commits.mock.calls.length;
  act(() => review.addComment('src/a.ts', null, 'body', 'note', null));
  act(() => review.toggleViewed('src/a.ts'));
  expect(commits).toHaveBeenCalledTimes(before);
  fireEvent.click(screen.getByTestId('import-diagnostics-banner-dismiss'));
  act(() =>
    store.dispatch({
      type: 'payload',
      payload: { ...payload, source: { type: 'directory', sourcePath: '/other' } },
    })
  );
  act(() =>
    store.dispatch({
      type: 'resume',
      resumed: { comments: [], importDiagnostics: ['Replacement diagnostic'] },
    })
  );
  expect(screen.getByText('Replacement diagnostic')).toBeTruthy();
});

it('keeps context-only legacy diagnostics and replacement behavior', () => {
  let review!: import('../context/ReviewContext').ReviewContextValue;
  function Capture() {
    review = useReview();
    return null;
  }
  const initial = render(
    <ConfigProvider>
      <ReviewProvider initialFiles={payload.files}>
        <Capture />
      </ReviewProvider>
    </ConfigProvider>
  );
  const value = review;
  initial.unmount();
  const tree = (sessionId: number, diagnostic: string) => (
    <ReviewContext.Provider value={{ ...value, sessionId, importDiagnostics: [diagnostic] }}>
      <ImportDiagnosticsBanner />
    </ReviewContext.Provider>
  );
  const view = render(tree(1, 'Legacy diagnostic'));
  expect(screen.getByText('Legacy diagnostic')).toBeTruthy();
  fireEvent.click(screen.getByTestId('import-diagnostics-banner-dismiss'));
  view.rerender(tree(2, 'Next diagnostic'));
  expect(screen.getByText('Next diagnostic')).toBeTruthy();
});
