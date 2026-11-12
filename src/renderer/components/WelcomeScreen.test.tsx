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
      expect(api.openRemoteUrl).toHaveBeenCalledWith('https://github.com/owner/repo/pull/42');
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

it('restores controls after native large-payload cancellation and allows retry', async () => {
  const api = installElectronApiStub({ pickDirectory: vi.fn(async () => '/picked') });
  render(<WelcomeScreen />);
  fireEvent.click(screen.getByTestId('browse-button'));
  const start = await screen.findByRole('button', { name: 'Start Review' });
  fireEvent.click(start);
  await waitFor(() =>
    expect(
      (screen.getByRole('button', { name: 'Start Review' }) as HTMLButtonElement).disabled
    ).toBe(false)
  );
  fireEvent.click(screen.getByRole('button', { name: 'Start Review' }));
  await waitFor(() => expect(api.startDirectoryReview).toHaveBeenCalledTimes(2));
  expect((screen.getByTestId('browse-button') as HTMLButtonElement).disabled).toBe(false);
});

it.each([
  ['Review cancelled.', 'Revisión cancelada.'],
  ['Opening the PR/MR was cancelled.', 'Se canceló la apertura del PR/MR.'],
  ['Enter a GitHub PR or GitLab MR URL.', 'Introduce una URL de PR de GitHub o MR de GitLab.'],
  ['The desktop operation timed out.', 'Se agotó el tiempo de la operación de escritorio.'],
  [
    'opening the PR/MR took longer than 10 minutes',
    'La apertura del PR/MR tardó más de 10 minutos.',
  ],
])('translates the known application failure %s at presentation', async (error, expected) => {
  const { LocalizationProvider } =
    await import('../../../packages/react/src/localization/LocalizationContext');
  installElectronApiStub({ openRemoteUrl: vi.fn(async () => ({ ok: false as const, error })) });
  render(
    <LocalizationProvider locale='es'>
      <WelcomeScreen />
    </LocalizationProvider>
  );
  submitUrl('https://github.com/owner/repo/pull/42');
  expect((await screen.findByRole('alert')).textContent).toBe(expected);
});

it('relocalizes a returned application error when the presentation locale changes', async () => {
  const { LocalizationProvider } =
    await import('../../../packages/react/src/localization/LocalizationContext');
  installElectronApiStub({
    openRemoteUrl: vi.fn(async () => ({ ok: false as const, error: 'Review cancelled.' })),
  });
  const view = render(
    <LocalizationProvider locale='en'>
      <WelcomeScreen />
    </LocalizationProvider>
  );
  submitUrl('https://github.com/owner/repo/pull/42');
  expect((await screen.findByRole('alert')).textContent).toBe('Review cancelled.');
  view.rerender(
    <LocalizationProvider locale='es'>
      <WelcomeScreen />
    </LocalizationProvider>
  );
  expect(screen.getByRole('alert').textContent).toBe('Revisión cancelada.');
});
