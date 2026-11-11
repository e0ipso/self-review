import { createDesktopLocalization, type DesktopLocalization } from '../shared/localization';
import type { RendererFailure } from './renderer-recovery';
import type { LifecyclePresentation } from './lifecycle-handlers';
import { app, dialog, shell, type BrowserWindow } from 'electron';
import type { AppConfig, DiffLoadPayload } from '../shared/types';
import { computePayloadStats, countTotalLines } from './payload-sizing';

/** Cancel leaves the session untouched. The host commits only after this resolves true. */
export async function confirmPayload(
  payload: DiffLoadPayload,
  config: AppConfig,
  window?: BrowserWindow,
  messages = createDesktopLocalization()
): Promise<boolean> {
  const stats = computePayloadStats(payload.files.length, countTotalLines(payload.files), config);
  if (!stats.exceedsAny) return true;
  const options: Electron.MessageBoxOptions = {
    type: 'warning',
    buttons: [messages.t('Continue'), messages.t('Cancel')],
    defaultId: 1,
    title: messages.t('Large Review Detected'),
    message: messages.t('Review size', { files: stats.fileCount, lines: stats.totalLines }),
    detail: messages.t('Review thresholds', {
      files: config.maxFiles,
      lines: config.maxTotalLines,
    }),
  };
  const result = window
    ? await dialog.showMessageBox(window, options)
    : await dialog.showMessageBox(options);
  if (result.response === 1) return false;
  payload.isLargePayload = true;
  return true;
}

/** Native operations required by the review IPC handlers, supplied by the composition root. */
export interface ReviewPresentation {
  pickDirectory: (window: BrowserWindow, destination?: boolean) => Promise<string | null>;
  confirmPayload: typeof confirmPayload;
  appInfo: () => Promise<import('../shared/types').AppInfo>;
  versionUpdate: () => import('../shared/types').VersionUpdateInfo | null;
  openExternal: (url: string) => Promise<void>;
}

export function createReviewPresentation(
  icon: () => Promise<string | null>,
  versionUpdate: ReviewPresentation['versionUpdate'],
  messages = createDesktopLocalization()
): ReviewPresentation {
  return {
    pickDirectory: async (window, destination) => {
      const result = await dialog.showOpenDialog(window, {
        properties: destination ? ['openDirectory', 'createDirectory'] : ['openDirectory'],
        ...(destination && { title: messages.t('Choose a directory to apply suggestions into') }),
        defaultPath: app.getPath('home'),
      });
      return result.canceled ? null : (result.filePaths[0] ?? null);
    },
    confirmPayload: (payload, config, window) => confirmPayload(payload, config, window, messages),
    appInfo: async () => ({ version: app.getVersion(), iconDataUri: await icon() }),
    versionUpdate,
    openExternal: async url => {
      await shell.openExternal(url);
    },
  };
}

export function createLifecyclePresentation(
  messages = createDesktopLocalization()
): LifecyclePresentation {
  return {
    async pickOutputPath(window, defaultPath) {
      const result = await dialog.showSaveDialog(window, {
        title: messages.t('Save Review As'),
        defaultPath,
        filters: [{ name: messages.t('XML Files'), extensions: ['xml'] }],
      });
      return result.canceled ? null : (result.filePath ?? null);
    },
    async reportSaveFailure(window, failure) {
      console.error(`[main] Error saving review (${failure.code}): ${failure.message}`);
      if (window.isDestroyed()) return;
      await dialog.showMessageBox(window, {
        type: 'error',
        title: messages.t('Review not saved'),
        message: failure.message,
        detail: failure.detail,
        buttons: [messages.t('OK')],
        defaultId: 0,
      });
    },
  };
}

export async function confirmRendererDiscard(
  window: BrowserWindow,
  failure: RendererFailure,
  messages: DesktopLocalization
): Promise<boolean> {
  if (window.isDestroyed()) return false;
  const result = await dialog.showMessageBox(window, {
    type: 'warning',
    title: messages.t('Review window unavailable'),
    message: messages.t(
      failure === 'crashed'
        ? 'The review window stopped unexpectedly.'
        : 'The review window is not responding.'
    ),
    detail: messages.t(
      'The current review cannot be saved from this window. Discard the review and quit, or cancel to keep the window open.'
    ),
    buttons: [messages.t('Cancel'), messages.t('Discard & Quit')],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });
  return result.response === 1;
}
