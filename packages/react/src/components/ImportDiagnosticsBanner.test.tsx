import React from 'react';
import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { DiffFile, DiffLoadPayload, ResumeLoadPayload } from '@self-review/types';

import { installBrowserApiStubs } from '../test-helpers';
import { ConfigProvider } from '../context/ConfigContext';
import { ReviewProvider } from '../context/ReviewContext';
import { ReviewAdapterProvider } from '../context/ReviewAdapterContext';
import type { ReviewAdapter } from '../adapter';
import ImportDiagnosticsBanner from './ImportDiagnosticsBanner';

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
