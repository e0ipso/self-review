import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import WelcomeScreen from './WelcomeScreen';
import type { ElectronAPI } from '../../shared/types';

function installElectronApiStub(overrides: Partial<ElectronAPI> = {}) {
  const api = {
    onCloseRequested: vi.fn(() => () => {}),
    discardAndQuit: vi.fn(),
    pickDirectory: vi.fn(async () => null),
    startDirectoryReview: vi.fn(async () => {}),
    openRemoteUrl: vi.fn(async () => ({ ok: true as const })),
    ...overrides,
  };
  (window as unknown as { electronAPI: unknown }).electronAPI = api;
  return api;
}

function submitUrl(url: string) {
  fireEvent.change(screen.getByTestId('remote-url-input'), {
    target: { value: url },
  });
  fireEvent.click(screen.getByTestId('remote-url-submit'));
}

describe('WelcomeScreen remote URL entry', () => {
  beforeEach(() => {
    installElectronApiStub();
  });

  it('renders a remote PR/MR URL input', () => {
    render(<WelcomeScreen />);
    expect(screen.getByTestId('remote-url-input')).toBeTruthy();
    expect(screen.getByTestId('remote-url-submit')).toBeTruthy();
  });

  it('shows inline feedback and sends nothing for a non-URL', async () => {
    const api = installElectronApiStub();
    render(<WelcomeScreen />);

    submitUrl('not a url');

    expect(await screen.findByTestId('remote-url-error')).toBeTruthy();
    expect(api.openRemoteUrl).not.toHaveBeenCalled();
  });

  it('shows inline feedback for an http URL that is not a PR/MR path', async () => {
    const api = installElectronApiStub();
    render(<WelcomeScreen />);

    submitUrl('https://github.com/owner/repo/issues/12');

    expect(await screen.findByTestId('remote-url-error')).toBeTruthy();
    expect(api.openRemoteUrl).not.toHaveBeenCalled();
  });

  it('sends a valid GitHub PR URL over the remote:open-url channel', async () => {
    const api = installElectronApiStub();
    render(<WelcomeScreen />);

    submitUrl('https://github.com/owner/repo/pull/42');

    await waitFor(() => {
      expect(api.openRemoteUrl).toHaveBeenCalledWith(
        'https://github.com/owner/repo/pull/42'
      );
    });
    expect(screen.queryByTestId('remote-url-error')).toBeNull();
  });

  it('sends a valid GitLab MR URL, including subgroup namespaces', async () => {
    const api = installElectronApiStub();
    render(<WelcomeScreen />);

    submitUrl('https://gitlab.com/group/subgroup/repo/-/merge_requests/7');

    await waitFor(() => {
      expect(api.openRemoteUrl).toHaveBeenCalledWith(
        'https://gitlab.com/group/subgroup/repo/-/merge_requests/7'
      );
    });
  });

  it('surfaces the main-process error when opening the URL fails', async () => {
    installElectronApiStub({
      openRemoteUrl: vi.fn(async () => ({
        ok: false as const,
        error: 'gh CLI unavailable',
      })),
    });
    render(<WelcomeScreen />);

    submitUrl('https://github.com/owner/repo/pull/42');

    const error = await screen.findByTestId('remote-url-error');
    expect(error.textContent).toContain('gh CLI unavailable');
  });

  it('clears the validation error once a corrected URL is submitted', async () => {
    render(<WelcomeScreen />);

    submitUrl('nope');
    await screen.findByTestId('remote-url-error');

    submitUrl('https://github.com/owner/repo/pull/1');
    await waitFor(() => {
      expect(screen.queryByTestId('remote-url-error')).toBeNull();
    });
  });
});
