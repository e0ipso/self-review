import React, { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ElectronAPI, DiffLoadPayload, ResumeLoadPayload, AppConfig } from '../shared/types';
import { DEFAULT_CONFIG } from '../../packages/react/src/config-defaults';
vi.mock('../../packages/react/src/components/Toolbar', () => ({
  default: ({ onFinishReview }: { onFinishReview: () => void }) => (
    <button onClick={onFinishReview}>Finish</button>
  ),
}));
vi.mock('../../packages/react/src/components/Layout', () => ({
  default: () => <div>Review files</div>,
}));
vi.mock('./components/AboutDialog', () => ({ default: () => null }));
vi.mock('./components/FindBar', () => ({ FindBar: () => null }));
vi.mock('./components/UpdateBanner', () => ({ default: () => null }));
vi.mock('./components/CloseConfirmDialog', () => ({ default: () => null }));
import App from './App';
afterEach(() => vi.unstubAllGlobals());

beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
});

it('recreates effect-owned adapters under StrictMode and submits current state before saving', async () => {
  const diffs = new Set<(value: DiffLoadPayload) => void>();
  const resumes = new Set<(value: ResumeLoadPayload) => void>();
  const configs = new Set<(value: AppConfig) => void>();
  const subscribe =
    <T,>(listeners: Set<(value: T) => void>) =>
    (callback: (value: T) => void) => {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    };
  const order: string[] = [];
  const api = {
    getApplicationLocale: vi.fn(async () => ({ locale: 'ar-EG', direction: 'rtl' as const })),
    onDiffLoad: subscribe(diffs),
    requestDiffData: () =>
      queueMicrotask(() => {
        for (const callback of diffs)
          callback({ files: [], source: { type: 'directory', sourcePath: '/review' } });
      }),
    onResumeLoad: subscribe(resumes),
    requestResumeData: () =>
      queueMicrotask(() => {
        for (const callback of resumes) callback({ comments: [], viewedFiles: [] });
      }),
    onConfigLoad: subscribe(configs),
    requestConfig: () =>
      queueMicrotask(() => {
        for (const callback of configs) callback(DEFAULT_CONFIG);
      }),
    onGuideLoad: () => () => {},
    onOutputPathChanged: () => () => {},
    submitReview: vi.fn(() => {
      order.push('submit');
    }),
    saveAndQuit: () => {
      order.push('save');
    },
  } as unknown as ElectronAPI;
  window.electronAPI = api;
  const view = render(
    <StrictMode>
      <App />
    </StrictMode>
  );
  await screen.findByText('Review files');
  expect(document.documentElement.lang).toBe('ar-EG');
  expect(document.documentElement.dir).toBe('rtl');
  fireEvent.click(screen.getByText('Finish'));
  expect(order).toEqual(['submit', 'save']);
  expect(api.submitReview).toHaveBeenCalledWith(
    expect.objectContaining({ source: { type: 'directory', sourcePath: '/review' } })
  );
  await act(async () => {
    for (const callback of diffs)
      callback({ files: [], source: { type: 'directory', sourcePath: '/replacement' } });
  });
  await waitFor(() => expect(screen.getByText('Finish')).toBeTruthy());
  fireEvent.click(screen.getByText('Finish'));
  expect(api.submitReview).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('alert').textContent).toContain('still loading');
  await act(async () => {
    for (const callback of resumes) callback({ comments: [], viewedFiles: [] });
  });
  fireEvent.click(screen.getByText('Finish'));
  expect(api.submitReview).toHaveBeenCalledTimes(2);
  expect(api.submitReview).toHaveBeenLastCalledWith(
    expect.objectContaining({ source: { type: 'directory', sourcePath: '/replacement' } })
  );
  view.unmount();
  expect(diffs.size + resumes.size + configs.size).toBe(0);
});

it('shows a config refusal immediately, releases listeners and recovers after Retry', async () => {
  const configs = new Set<(value: AppConfig) => void>();
  const refusals = new Set<(value: import('../shared/types').ContentLoadRefusal) => void>();
  const subscribe =
    <T,>(listeners: Set<(value: T) => void>) =>
    (callback: (value: T) => void) => {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    };
  const requestConfig = vi.fn(() => {
    for (const callback of refusals)
      callback({ kind: 'config', message: 'Configuration exceeds desktop delivery limits.' });
  });
  window.electronAPI = {
    onConfigLoad: subscribe(configs),
    onContentRefused: subscribe(refusals),
    requestConfig,
    onResumeLoad: () => () => {},
  } as unknown as ElectronAPI;
  const view = render(<App />);
  expect((await screen.findByRole('alert')).textContent).toContain(
    'Configuration exceeds desktop delivery limits.'
  );
  expect(refusals.size).toBe(0);
  expect(configs.size).toBe(1);
  requestConfig.mockImplementation(() => {
    for (const callback of configs) callback(DEFAULT_CONFIG);
  });
  // Keep this recovered review at its loading boundary; no diff has arrived yet.
  Object.assign(window.electronAPI, {
    onDiffLoad: () => () => {},
    requestDiffData: () => {},
    requestResumeData: () => {},
    onGuideLoad: () => () => {},
    onOutputPathChanged: () => () => {},
  });
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByRole('status', { name: 'Loading review' });
  expect(screen.queryByRole('alert')).toBeNull();
  expect(requestConfig).toHaveBeenCalledTimes(2);
  view.unmount();
  expect(configs.size + refusals.size).toBe(0);
});
