import type { LifecyclePresentation } from './lifecycle-handlers';
import { app, dialog, shell, type BrowserWindow } from 'electron';
import type { AppConfig, DiffLoadPayload } from '../shared/types';
import { computePayloadStats, countTotalLines } from './payload-sizing';

/** Cancel leaves the session untouched. The host commits only after this resolves true. */
export async function confirmPayload(
  payload: DiffLoadPayload,
  config: AppConfig,
  window?: BrowserWindow
): Promise<boolean> {
  const stats = computePayloadStats(payload.files.length, countTotalLines(payload.files), config);
  if (!stats.exceedsAny) return true;
  const options: Electron.MessageBoxOptions = {
    type: 'warning',
    buttons: ['Continue', 'Cancel'],
    defaultId: 1,
    title: 'Large Review Detected',
    message: `This review contains ${stats.fileCount} files and approximately ${stats.totalLines} lines.`,
    detail: `Thresholds: ${config.maxFiles} files, ${config.maxTotalLines} lines.\n\nLarge reviews may be slow. Continue in large-payload mode?`,
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
  versionUpdate: ReviewPresentation['versionUpdate']
): ReviewPresentation {
  return {
    pickDirectory: async (window, destination) => {
      const result = await dialog.showOpenDialog(window, {
        properties: destination ? ['openDirectory', 'createDirectory'] : ['openDirectory'],
        ...(destination && { title: 'Choose a directory to apply suggestions into' }),
        defaultPath: app.getPath('home'),
      });
      return result.canceled ? null : (result.filePaths[0] ?? null);
    },
    confirmPayload,
    appInfo: async () => ({ version: app.getVersion(), iconDataUri: await icon() }),
    versionUpdate,
    openExternal: async url => {
      await shell.openExternal(url);
    },
  };
}

export function createLifecyclePresentation(): LifecyclePresentation {
  return {
    async pickOutputPath(window, defaultPath) {
      const result = await dialog.showSaveDialog(window, {
        title: 'Save Review As',
        defaultPath,
        filters: [{ name: 'XML Files', extensions: ['xml'] }],
      });
      return result.canceled ? null : (result.filePath ?? null);
    },
    async reportSaveFailure(window, failure) {
      console.error(`[main] Error saving review (${failure.code}): ${failure.message}`);
      if (window.isDestroyed()) return;
      await dialog.showMessageBox(window, {
        type: 'error',
        title: 'Review not saved',
        message: failure.message,
        detail: failure.detail,
        buttons: ['OK'],
        defaultId: 0,
      });
    },
  };
}
