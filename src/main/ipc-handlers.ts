// src/main/ipc-handlers.ts
// IPC handler registration
//
// This module is the Electron transport adapter. The transport-agnostic
// handler bodies live in ./review-handlers and hold no state of their own —
// they read the ReviewSession they are handed. The Electron session is created
// here and populated during main-process startup through the setters below, so
// another front end can populate its own session during its own startup
// instead of inheriting this one.
//
// Electron-only handlers (dialogs, window lifecycle, find-in-page, external
// links, version updates) are implemented here in full: they have no
// transport-agnostic equivalent.

import * as fs from 'fs';
import { ipcMain, BrowserWindow, dialog, app, shell } from 'electron';
import { IPC } from '../shared/ipc-channels';
import {
  DiffLoadPayload,
  ResumeLoadPayload,
  GuideLoadPayload,
  AppConfig,
  OutputPathInfo,
  ReviewState,
  ReviewComment,
  ExpandContextRequest,
  FindInPageRequest,
  ImageLoadResult,
  AppInfo,
  RemoteDriftInfo,
} from '../shared/types';
import { scanDirectory, scanFile } from './directory-scanner';
import { getVersionUpdate } from './version-checker';
import { computePayloadStats, countTotalLines } from './payload-sizing';
import { getAppIconDataUri } from './app-assets';
import {
  ReviewSession,
  createReviewSession,
  handleDiffRequest,
  handleExpandContext,
  handleLoadFile,
  handleLoadImage,
  handleReadAttachment,
  handleResumeRequest,
  handleReviewSubmit,
  preparePayload,
} from './review-handlers';

// The desktop app's session. Populated by the setters below during
// main-process startup, before the window is created.
const session: ReviewSession = createReviewSession();

export function setDiffData(data: DiffLoadPayload): void {
  session.diffData = data;
}

export function setGuideData(data: GuideLoadPayload | null): void {
  session.guideData = data;
}

export function setConfigData(data: AppConfig): void {
  session.config = data;
}

export function setOutputPathInfo(info: OutputPathInfo): void {
  session.outputPathInfo = info;
}

export function setResumeData(
  comments: ReviewComment[],
  viewedFiles: string[] = [],
  remoteDrift: RemoteDriftInfo | null = null
): void {
  session.resumeComments = comments;
  session.resumeViewedFiles = viewedFiles;
  session.resumeRemoteDrift = remoteDrift;
}

export function registerIpcHandlers(): void {
  // Handle diff data request from renderer
  ipcMain.on(IPC.DIFF_REQUEST, event => {
    const result = handleDiffRequest(session);
    if (result) {
      event.sender.send(IPC.DIFF_LOAD, result.diff);
      // The guide rides after the diff payload in both normal and
      // large-payload modes — it is metadata-only (paths, names,
      // descriptions) and never triggers eager hunk loading.
      if (result.guide) {
        event.sender.send(IPC.GUIDE_LOAD, result.guide);
      }
    }
  });

  // Handle image loading for rendered preview
  ipcMain.handle(
    IPC.DIFF_LOAD_IMAGE,
    async (_event, filePath: string): Promise<ImageLoadResult> =>
      handleLoadImage(session, filePath)
  );

  // Handle single-file content loading for lazy (large-payload) mode
  ipcMain.handle(IPC.DIFF_LOAD_FILE, async (_event, filePath: string) =>
    handleLoadFile(session, filePath)
  );

  // Handle config request from renderer
  ipcMain.on(IPC.CONFIG_REQUEST, event => {
    if (session.config) {
      event.sender.send(IPC.CONFIG_LOAD, session.config, session.outputPathInfo);
    }
  });

  // Handle app info request from renderer (version + icon for the About dialog)
  ipcMain.handle(IPC.APP_GET_INFO, async (): Promise<AppInfo> => {
    return {
      version: app.getVersion(),
      iconDataUri: await getAppIconDataUri(),
    };
  });

  // Handle review submission from renderer
  ipcMain.on(IPC.REVIEW_SUBMIT, (_event, state: ReviewState) => {
    handleReviewSubmit(session, state);
  });

  // Handle attachment file read from renderer
  ipcMain.handle(IPC.ATTACHMENT_READ, async (_event, filePath: string) =>
    handleReadAttachment(filePath)
  );

  // Send resumed comments and viewed files when the renderer is ready
  // (after diff data is loaded)
  ipcMain.on(IPC.RESUME_REQUEST, event => {
    const payload = handleResumeRequest(session);
    if (payload) {
      event.sender.send(IPC.RESUME_LOAD, payload);
    }
  });

  // Open native directory picker dialog
  ipcMain.handle(IPC.DIALOG_PICK_DIRECTORY, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      defaultPath: app.getPath('home'),
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  // Expand context for a single file by re-running git diff with more context lines
  ipcMain.handle(
    IPC.DIFF_EXPAND_CONTEXT,
    async (_event, request: ExpandContextRequest) =>
      handleExpandContext(session, request)
  );

  // Find in page: forward search request to Chromium
  ipcMain.on(IPC.FIND_IN_PAGE, (event, request: FindInPageRequest) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;

    if (!request.text) {
      win.webContents.stopFindInPage('clearSelection');
      return;
    }

    win.webContents.findInPage(request.text, {
      forward: request.forward,
      findNext: request.findNext,
    });
  });

  // Stop find in page
  ipcMain.on(IPC.FIND_STOP, (event, action: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;

    win.webContents.stopFindInPage(
      action as 'clearSelection' | 'keepSelection' | 'activateSelection'
    );
  });

  // Handle version update request from renderer
  ipcMain.on(IPC.VERSION_UPDATE_REQUEST, event => {
    const update = getVersionUpdate();
    if (update) {
      event.sender.send(IPC.VERSION_UPDATE_AVAILABLE, update);
    }
  });

  // Handle open-external requests from renderer
  ipcMain.handle(IPC.OPEN_EXTERNAL, async (_event, url: string) => {
    // Security: only allow https://github.com/ URLs
    if (typeof url === 'string' && url.startsWith('https://github.com/')) {
      await shell.openExternal(url);
    }
  });

  // Start a directory review from a picked path
  ipcMain.handle(
    IPC.REVIEW_START_DIRECTORY,
    async (event, directoryPath: string) => {
      console.error(
        '[ipc] Starting directory review for:',
        directoryPath
      );

      // Check if the path is a file (not a directory)
      let isFile = false;
      try {
        isFile = fs.statSync(directoryPath).isFile();
      } catch {
        // Failed to stat — proceed as directory
      }

      if (isFile) {
        const files = await scanFile(directoryPath);
        const payload: DiffLoadPayload = {
          files,
          source: { type: 'file', sourcePath: directoryPath },
        };

        // Large payload guard
        if (session.config) {
          const stats = computePayloadStats(
            payload.files.length,
            countTotalLines(payload.files),
            session.config
          );
          if (stats.exceedsAny) {
            const win = BrowserWindow.fromWebContents(event.sender);
            if (win) {
              const result = dialog.showMessageBoxSync(win, {
                type: 'warning',
                buttons: ['Continue', 'Cancel'],
                defaultId: 1,
                title: 'Large Review Detected',
                message: `This review contains ${stats.fileCount} files and approximately ${stats.totalLines} lines.`,
                detail: `Thresholds: ${session.config.maxFiles} files, ${session.config.maxTotalLines} lines.\n\nLarge reviews may be slow. Continue in large-payload mode?`,
              });
              if (result === 1) {
                console.error('[ipc] User cancelled large file review');
                return;
              }
              payload.isLargePayload = true;
            }
          }
        }

        session.diffData = payload;
        const window = BrowserWindow.fromWebContents(event.sender);
        if (window) {
          window.webContents.send(IPC.DIFF_LOAD, preparePayload(payload));
        }

        console.error(
          '[ipc] File review started:',
          payload.files.length,
          'files'
        );
        return;
      }

      // Directory mode: scan all files as new additions
      const ignorePatterns = session.config?.ignore ?? [];
      const files = await scanDirectory(directoryPath, ignorePatterns);
      const payload: DiffLoadPayload = {
        files,
        source: { type: 'directory', sourcePath: directoryPath },
      };

      // Large payload guard
      if (session.config) {
        const stats = computePayloadStats(
          payload.files.length,
          countTotalLines(payload.files),
          session.config
        );
        if (stats.exceedsAny) {
          const win = BrowserWindow.fromWebContents(event.sender);
          if (win) {
            const result = dialog.showMessageBoxSync(win, {
              type: 'warning',
              buttons: ['Continue', 'Cancel'],
              defaultId: 1,
              title: 'Large Review Detected',
              message: `This review contains ${stats.fileCount} files and approximately ${stats.totalLines} lines.`,
              detail: `Thresholds: ${session.config.maxFiles} files, ${session.config.maxTotalLines} lines.\n\nLarge reviews may be slow. Continue in large-payload mode?`,
            });
            if (result === 1) {
              console.error('[ipc] User cancelled large directory review');
              return;
            }
            payload.isLargePayload = true;
          }
        }
      }

      // Update the cache and send to renderer
      session.diffData = payload;
      const window = BrowserWindow.fromWebContents(event.sender);
      if (window) {
        window.webContents.send(IPC.DIFF_LOAD, preparePayload(payload));
      }

      console.error(
        '[ipc] Directory review started:',
        payload.source.type,
        'mode with',
        payload.files.length,
        'files'
      );
    }
  );
}

export function sendDiffLoad(
  window: BrowserWindow,
  payload: DiffLoadPayload
): void {
  window.webContents.send(IPC.DIFF_LOAD, preparePayload(payload));
}

export function sendConfigLoad(window: BrowserWindow, config: AppConfig, outputPathInfo?: OutputPathInfo): void {
  window.webContents.send(IPC.CONFIG_LOAD, config, outputPathInfo);
}

export function sendResumeLoad(
  window: BrowserWindow,
  payload: ResumeLoadPayload
): void {
  window.webContents.send(IPC.RESUME_LOAD, payload);
}

export function sendGuideLoad(
  window: BrowserWindow,
  payload: GuideLoadPayload
): void {
  window.webContents.send(IPC.GUIDE_LOAD, payload);
}

export function registerFindInPageForWindow(window: BrowserWindow): void {
  window.webContents.on('found-in-page', (_event, result) => {
    window.webContents.send(IPC.FIND_RESULT, {
      activeMatchOrdinal: result.activeMatchOrdinal,
      matches: result.matches,
      finalUpdate: result.finalUpdate,
    });
  });
}

export function requestReviewFromRenderer(
  window: BrowserWindow
): Promise<ReviewState> {
  return new Promise(resolve => {
    // Host-driven flow: renderer pushes state before triggering save.
    // If the cache is already populated, use it directly.
    if (session.reviewState) {
      console.error('[ipc] Using pre-submitted review state (host-driven)');
      const state = session.reviewState;
      session.reviewState = null;
      resolve(state);
      return;
    }

    // Fallback: pull-based request for backward compatibility.
    console.error('[ipc] Sending review:request to renderer (fallback)');
    window.webContents.send('review:request');

    // Wait for response with timeout
    const timeout = setTimeout(() => {
      console.error(
        '[ipc] WARNING: Timeout waiting for review state from renderer (5s)'
      );
      console.error('[ipc] Resolving with empty review state');
      resolve({
        timestamp: new Date().toISOString(),
        source: { type: 'git', gitDiffArgs: '', repository: '' },
        files: [],
      });
    }, 5000);

    // Poll for the cached state
    const interval = setInterval(() => {
      if (session.reviewState) {
        console.error('[ipc] Review state received from renderer');
        clearTimeout(timeout);
        clearInterval(interval);
        const state = session.reviewState;
        session.reviewState = null;
        resolve(state);
      }
    }, 100);
  });
}
