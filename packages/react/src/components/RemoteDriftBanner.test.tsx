import React from 'react';
import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  DiffFile,
  DiffLoadPayload,
  ResumeLoadPayload,
} from '@self-review/types';

import { installBrowserApiStubs } from '../test-helpers';
import { ConfigProvider } from '../context/ConfigContext';
import { ReviewProvider } from '../context/ReviewContext';
import { ReviewAdapterProvider } from '../context/ReviewAdapterContext';
import type { ReviewAdapter } from '../adapter';
import RemoteDriftBanner from './RemoteDriftBanner';

installBrowserApiStubs();

function diffFile(path: string): DiffFile {
  return {
    oldPath: path,
    newPath: path,
    changeType: 'modified',
    isBinary: false,
    hunks: [],
  };
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
          <RemoteDriftBanner />
        </ReviewProvider>
      </ConfigProvider>
    </ReviewAdapterProvider>
  );
}

describe('RemoteDriftBanner', () => {
  it('shows a warning with short SHAs when the remote head has drifted', async () => {
    renderBanner({
      comments: [],
      remoteDrift: {
        recordedHeadSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        liveHeadSha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        drifted: true,
      },
    });

    const banner = await screen.findByTestId('remote-drift-banner');
    expect(banner.textContent).toContain('aaaaaaa');
    expect(banner.textContent).toContain('bbbbbbb');
    expect(banner.textContent).toMatch(/changed since/i);
  });

  it('renders nothing when the recorded and live SHAs match', async () => {
    renderBanner({
      comments: [],
      remoteDrift: {
        recordedHeadSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        liveHeadSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        drifted: false,
      },
    });

    // Let the resume payload land before asserting absence.
    await waitFor(() => {
      expect(screen.queryByTestId('remote-drift-banner')).toBeNull();
    });
  });

  it('renders nothing when the resume payload carries no drift info', async () => {
    renderBanner({ comments: [] });

    await waitFor(() => {
      expect(screen.queryByTestId('remote-drift-banner')).toBeNull();
    });
  });

  it('renders nothing for a purely local review with no resume payload', async () => {
    renderBanner();

    await waitFor(() => {
      expect(screen.queryByTestId('remote-drift-banner')).toBeNull();
    });
  });

  it('is dismissible and stays dismissed', async () => {
    renderBanner({
      comments: [],
      remoteDrift: {
        recordedHeadSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        liveHeadSha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        drifted: true,
      },
    });

    await screen.findByTestId('remote-drift-banner');
    fireEvent.click(screen.getByTestId('remote-drift-banner-dismiss'));

    expect(screen.queryByTestId('remote-drift-banner')).toBeNull();
  });
});
