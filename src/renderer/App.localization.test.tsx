import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type {
  ApplicationLocale,
  ElectronAPI,
  DiffLoadPayload,
  AppConfig,
  ResumeLoadPayload,
} from '../shared/types';
import { DEFAULT_CONFIG } from '../../packages/react/src/config-defaults';
import {
  LocalizationProvider,
  useLocalization,
} from '../../packages/react/src/localization/LocalizationContext';
import { resolveDesktopCatalog, resolveApplicationLocale } from '../shared/localization';
import { ENGLISH } from '../../packages/react/src/localization/english';
import { SPANISH_REVIEW } from '../shared/spanish-review';
import App from './App';

// Keep the real shell and Toolbar, but avoid unrelated diff layout work in a locale test.
vi.mock('../../packages/react/src/components/Layout', () => ({ default: () => null }));

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});
afterEach(() => vi.unstubAllGlobals());

function api(locale: ApplicationLocale | undefined, welcome: boolean) {
  const configs = new Set<(value: AppConfig) => void>();
  const diffs = new Set<(value: DiffLoadPayload) => void>();
  const resumes = new Set<(value: ResumeLoadPayload) => void>();
  const subscribe =
    <T,>(listeners: Set<(value: T) => void>) =>
    (callback: (value: T) => void) => {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    };
  return {
    ...(locale && { getApplicationLocale: vi.fn(async () => locale) }),
    onConfigLoad: subscribe(configs),
    requestConfig: () =>
      queueMicrotask(() => configs.forEach(callback => callback(DEFAULT_CONFIG))),
    onDiffLoad: subscribe(diffs),
    requestDiffData: () =>
      queueMicrotask(() =>
        diffs.forEach(callback =>
          callback({
            files: [],
            source: welcome ? { type: 'welcome' } : { type: 'directory', sourcePath: '/review' },
          })
        )
      ),
    onResumeLoad: subscribe(resumes),
    requestResumeData: () =>
      queueMicrotask(() =>
        resumes.forEach(callback => callback({ comments: [], viewedFiles: [] }))
      ),
    onGuideLoad: () => () => {},
    onOutputPathChanged: () => () => {},
    onCloseRequested: () => () => {},
    onShowAbout: () => () => {},
    getAppInfo: async () => ({ version: '2.0.4', iconDataUri: null }),
    onVersionUpdate: () => () => {},
    requestVersionUpdate: vi.fn(),
    stopFindInPage: vi.fn(),
    submitReview: vi.fn(),
    saveAndQuit: vi.fn(),
    discardAndQuit: vi.fn(),
  } as unknown as ElectronAPI;
}

it.each(['es-ES', 'es-MX'])(
  'delivers the Spanish %s catalog to the real shared toolbar and shell',
  async locale => {
    window.electronAPI = api(resolveApplicationLocale(locale), false);
    const view = render(<App />);
    await screen.findByRole('button', { name: 'Finalizar revisión' });
    expect(screen.getByRole('button', { name: 'Contraer comentarios' })).toBeTruthy();
    expect(document.documentElement.lang).toBe(locale);
    expect(document.documentElement.dir).toBe('ltr');
    view.unmount();
    window.electronAPI = api(resolveApplicationLocale(locale), true);
    render(<App />);
    await screen.findByRole('button', { name: 'Examinar...' });
    expect(
      screen.getByRole('textbox', { name: 'URL de PR de GitHub o MR de GitLab' })
    ).toBeTruthy();
    expect(screen.getByText('Modo remoto')).toBeTruthy();
  }
);

it.each(['en-GB', 'fr-FR', 'bad_locale', undefined])(
  'preserves English UI fallback for %s and old bridges without locale support',
  async locale => {
    window.electronAPI = api(locale ? { locale, direction: 'ltr' } : undefined, true);
    render(<App />);
    await screen.findByRole('button', { name: 'Browse...' });
    expect(document.documentElement.lang).toBe(locale === 'bad_locale' || !locale ? 'en' : locale);
    expect(document.documentElement.dir).toBe('ltr');
  }
);

it('preserves unsupported locale direction through the actual renderer boundary', async () => {
  window.electronAPI = api(resolveApplicationLocale('ar-EG'), true);
  render(<App />);
  await screen.findByRole('button', { name: 'Browse...' });
  await waitFor(() => expect(document.documentElement.dir).toBe('rtl'));
});

function Counts({ count, files }: { count: number; files: number }) {
  const { t } = useLocalization();
  return (
    <div>
      {t('comments across files', { count, files })}
      <span>{t('Directory: {path}', { path: '<img src=x onerror=alert(1)>' })}</span>
    </div>
  );
}
it.each([
  [1, 1, '1 comentario en 1 archivo'],
  [1, 2, '1 comentario en 2 archivos'],
  [2, 1, '2 comentarios en 1 archivo'],
  [2, 2, '2 comentarios en 2 archivos'],
])(
  'formats independent renderer counts %i and %i with safe text interpolation',
  (count, files, expected) => {
    const view = render(
      <LocalizationProvider locale='es-MX' messages={resolveDesktopCatalog('es-MX')}>
        <Counts count={Number(count)} files={Number(files)} />
      </LocalizationProvider>
    );
    expect(view.container.textContent).toContain(expected);
    expect(view.container.textContent).toContain('Directorio: <img src=x onerror=alert(1)>');
    expect(view.container.querySelector('img')).toBeNull();
  }
);

it('keeps the built-in review catalog complete and lets nested custom overrides win', () => {
  expect(Object.keys(SPANISH_REVIEW).sort()).toEqual(Object.keys(ENGLISH).sort());
  function Labels() {
    const { t } = useLocalization();
    return (
      <>
        {t('Cancel')} / {t('Finish Review')}
      </>
    );
  }
  render(
    <LocalizationProvider locale='es' messages={resolveDesktopCatalog('es')}>
      <LocalizationProvider messages={{ Cancel: 'Mi acción' }}>
        <Labels />
      </LocalizationProvider>
    </LocalizationProvider>
  );
  expect(screen.getByText('Mi acción / Finalizar revisión')).toBeTruthy();
});
