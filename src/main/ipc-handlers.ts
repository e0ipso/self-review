// src/main/ipc-handlers.ts
// IPC handler registration

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
import { getVersionUpdate } from './version-checker';
import { getAppIconDataUri } from './app-assets';
import {
  commitReviewStart,
  createReviewSession,
  expandContext,
  getConfigLoad,
  getDiffLoad,
  getFileHunks,
  getResumeLoad,
  loadImage,
  prepareDirectoryReview,
  preparePayload,
  readAttachment,
  submitReviewState,
  takeReviewState,
} from './review-handlers';

// The desktop application's own session. A single module-scope `const` holding
// it is expected: the mutable state lives inside the session value, which is
// passed explicitly to every extracted handler.
const desktopSession = createReviewSession();

export function setDiffData(data: DiffLoadPayload): void {
  desktopSession.diffData = data;
}

export function setGuideData(data: GuideLoadPayload | null): void {
  desktopSession.guideData = data;
}

export function setConfigData(data: AppConfig): void {
  desktopSession.config = data;
}

export function setOutputPathInfo(info: OutputPathInfo): void {
  desktopSession.outputPathInfo = info;
}

export function setResumeData(
  comments: ReviewComment[],
  viewedFiles: string[] = [],
  remoteDrift: RemoteDriftInfo | null = null
): void {
  desktopSession.resumeComments = comments;
  desktopSession.resumeViewedFiles = viewedFiles;
  desktopSession.resumeRemoteDrift = remoteDrift;
}

export function registerIpcHandlers(): void {
  // Handle diff data request from renderer
  ipcMain.on(IPC.DIFF_REQUEST, event => {
    const load = getDiffLoad(desktopSession);
    if (load) {
      event.sender.send(IPC.DIFF_LOAD, load.diff);
      // The guide rides after the diff payload, and only when there is one.
      if (load.guide) {
        event.sender.send(IPC.GUIDE_LOAD, load.guide);
      }
    }
  });

  // Handle image loading for rendered preview
  ipcMain.handle(
    IPC.DIFF_LOAD_IMAGE,
    async (_event, filePath: string): Promise<ImageLoadResult> =>
      loadImage(desktopSession, filePath)
  );

  // Handle single-file content loading for lazy (large-payload) mode
  ipcMain.handle(IPC.DIFF_LOAD_FILE, async (_event, filePath: string) =>
    getFileHunks(desktopSession, filePath)
  );

  // Handle config request from renderer
  ipcMain.on(IPC.CONFIG_REQUEST, event => {
    const load = getConfigLoad(desktopSession);
    if (load) {
      event.sender.send(IPC.CONFIG_LOAD, load.config, load.outputPathInfo);
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
    submitReviewState(desktopSession, state);
  });

  // Handle attachment file read from renderer
  ipcMain.handle(IPC.ATTACHMENT_READ, async (_event, filePath: string) =>
    readAttachment(filePath)
  );

  // Send resumed comments and viewed files when the renderer is ready
  // (after diff data is loaded)
  ipcMain.on(IPC.RESUME_REQUEST, event => {
    const payload = getResumeLoad(desktopSession);
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
      expandContext(desktopSession, request)
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
      const { payload, stats, exceedsThresholds } = await prepareDirectoryReview(
        desktopSession,
        directoryPath
      );

      // Large payload guard
      if (exceedsThresholds && stats && desktopSession.config) {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win) {
          const result = dialog.showMessageBoxSync(win, {
            type: 'warning',
            buttons: ['Continue', 'Cancel'],
            defaultId: 1,
            title: 'Large Review Detected',
            message: `This review contains ${stats.fileCount} files and approximately ${stats.totalLines} lines.`,
            detail: `Thresholds: ${desktopSession.config.maxFiles} files, ${desktopSession.config.maxTotalLines} lines.\n\nLarge reviews may be slow. Continue in large-payload mode?`,
          });
          if (result === 1) {
            // Nothing is committed and nothing is sent: the review the user was
            // already looking at stays on screen.
            console.error(
              payload.source.type === 'file'
                ? '[ipc] User cancelled large file review'
                : '[ipc] User cancelled large directory review'
            );
            return;
          }
          payload.isLargePayload = true;
        }
      }

      // Update the cache and send to renderer
      const outgoing = commitReviewStart(desktopSession, payload);
      const window = BrowserWindow.fromWebContents(event.sender);
      if (window) {
        window.webContents.send(IPC.DIFF_LOAD, outgoing);
      }

      if (payload.source.type === 'file') {
        console.error(
          '[ipc] File review started:',
          payload.files.length,
          'files'
        );
      } else {
        console.error(
          '[ipc] Directory review started:',
          payload.source.type,
          'mode with',
          payload.files.length,
          'files'
        );
      }
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
    // If the session already holds a state, use it directly.
    const preSubmitted = takeReviewState(desktopSession);
    if (preSubmitted) {
      console.error('[ipc] Using pre-submitted review state (host-driven)');
      resolve(preSubmitted);
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

    // Poll for the submitted state
    const interval = setInterval(() => {
      const state = takeReviewState(desktopSession);
      if (state) {
        console.error('[ipc] Review state received from renderer');
        clearTimeout(timeout);
        clearInterval(interval);
        resolve(state);
      }
    }, 100);
  });
}
