// src/main/ipc-handlers.ts
// IPC handler registration

import * as fs from 'fs';
import { ipcMain, BrowserWindow, dialog, app, shell } from 'electron';
import { IPC } from '../shared/ipc-channels';
import path from 'path';
import {
  DiffLoadPayload,
  DiffHunk,
  ResumeLoadPayload,
  AppConfig,
  OutputPathInfo,
  ReviewState,
  ReviewComment,
  ExpandContextRequest,
  FindInPageRequest,
  ImageLoadResult,
} from '../shared/types';
import { scanDirectory, scanFile } from './directory-scanner';
import { getVersionUpdate } from './version-checker';
import { computePayloadStats, countTotalLines } from './payload-sizing';

let reviewStateCache: ReviewState | null = null;
let diffDataCache: DiffLoadPayload | null = null;
let configCache: AppConfig | null = null;
let outputPathInfoCache: OutputPathInfo | null = null;
let resumeCommentsCache: ReviewComment[] = [];

export function setDiffData(data: DiffLoadPayload): void {
  diffDataCache = data;
}

export function setConfigData(data: AppConfig): void {
  configCache = data;
}

export function setOutputPathInfo(info: OutputPathInfo): void {
  outputPathInfoCache = info;
}

export function setResumeComments(comments: ReviewComment[]): void {
  resumeCommentsCache = comments;
}

export function registerIpcHandlers(): void {
  // Handle diff data request from renderer
  ipcMain.on(IPC.DIFF_REQUEST, event => {
    if (diffDataCache) {
      event.sender.send(IPC.DIFF_LOAD, preparePayload(diffDataCache));
    }
  });

  // Handle image loading for rendered preview
  ipcMain.handle(IPC.DIFF_LOAD_IMAGE, async (_event, filePath: string): Promise<ImageLoadResult> => {
    const MIME_MAP: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.ico': 'image/x-icon',
      '.bmp': 'image/bmp',
      '.svg': 'image/svg+xml',
    };
    const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
    const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = MIME_MAP[ext] ?? 'application/octet-stream';

    try {
      const stat = await fs.promises.stat(resolved);
      if (stat.size > MAX_SIZE) {
        return { error: 'File too large to preview (>10 MB)' };
      }
      const data = await fs.promises.readFile(resolved);
      return { dataUri: `data:${mimeType};base64,${data.toString('base64')}` };
    } catch {
      return { error: 'Image preview unavailable — file not found on disk.' };
    }
  });

  // Handle single-file content loading for lazy (large-payload) mode
  ipcMain.handle(IPC.DIFF_LOAD_FILE, async (_event, filePath: string) => {
    if (!diffDataCache) return null;
    const file = diffDataCache.files.find(f => (f.newPath || f.oldPath) === filePath);
    if (!file) return null;
    return file.hunks;
  });

  // Handle config request from renderer
  ipcMain.on(IPC.CONFIG_REQUEST, event => {
    if (configCache) {
      event.sender.send(IPC.CONFIG_LOAD, configCache, outputPathInfoCache);
    }
  });

  // Handle review submission from renderer
  ipcMain.on(IPC.REVIEW_SUBMIT, (_event, state: ReviewState) => {
    console.error(
      '[ipc] Received REVIEW_SUBMIT from renderer:',
      JSON.stringify({
        timestamp: state.timestamp,
        source: state.source,
        fileCount: state.files.length,
      })
    );
    reviewStateCache = state;
  });

  // Handle attachment file read from renderer
  ipcMain.handle(IPC.ATTACHMENT_READ, async (_event, filePath: string) => {
    try {
      const buffer = await fs.promises.readFile(filePath);
      return buffer.buffer; // Convert Node.js Buffer to ArrayBuffer
    } catch {
      console.error(`[attachment:read] Failed to read file: ${filePath}`);
      return null;
    }
  });

  // Send resume comments when renderer is ready (after diff data is loaded)
  ipcMain.on(IPC.RESUME_REQUEST, event => {
    if (resumeCommentsCache.length > 0) {
      event.sender.send(IPC.RESUME_LOAD, { comments: resumeCommentsCache });
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
    async (_event, request: ExpandContextRequest) => {
      if (!diffDataCache || diffDataCache.source.type !== 'git') {
        return null;
      }

      try {
        const { runGitDiffAsync } = await import('./git');
        const { parseDiff } = await import('./diff-parser');

        const source = diffDataCache.source as { type: 'git'; gitDiffArgs: string; repository: string };
        const originalArgs = source.gitDiffArgs
          .split(/\s+/)
          .filter(a => a.length > 0);

        // Strip -U/--unified flags. Stop at `--` — paths after it were the
        // original path restriction; the specific file is supplied below.
        const filteredArgs: string[] = [];
        for (let i = 0; i < originalArgs.length; i++) {
          const arg = originalArgs[i];
          if (arg.match(/^-U\d+$/) || arg.match(/^--unified=\d+$/)) {
            continue;
          }
          if (arg === '-U' || arg === '--unified') {
            i++; // skip next arg (the number)
            continue;
          }
          if (arg === '--') {
            break;
          }
          filteredArgs.push(arg);
        }

        const expandArgs = [
          ...filteredArgs,
          `-U${request.contextLines}`,
          '--',
          request.filePath,
        ];

        const rawDiff = await runGitDiffAsync(expandArgs);
        const parsedFiles = parseDiff(rawDiff);

        if (parsedFiles.length === 0) {
          return null;
        }

        const expandedFile = parsedFiles[0];

        // Count total lines in the working tree file for gap detection
        let totalLines = 0;
        try {
          const content = await fs.promises.readFile(request.filePath, 'utf-8');
          totalLines = content.split('\n').length;
          // If file ends with newline, last split element is empty — don't count it
          if (content.endsWith('\n')) totalLines--;
        } catch {
          // Can't determine line count — leave as 0 (bars will stay visible)
        }

        // Update the cache
        diffDataCache = {
          ...diffDataCache,
          files: diffDataCache.files.map(f => {
            const fPath = f.newPath || f.oldPath;
            if (fPath === request.filePath) {
              return { ...f, hunks: expandedFile.hunks };
            }
            return f;
          }),
        };

        return { hunks: expandedFile.hunks, totalLines };
      } catch (error) {
        console.error(
          `[ipc] Failed to expand context for ${request.filePath}:`,
          error
        );
        return null;
      }
    }
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
        if (configCache) {
          const stats = computePayloadStats(
            payload.files.length,
            countTotalLines(payload.files),
            configCache
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
                detail: `Thresholds: ${configCache.maxFiles} files, ${configCache.maxTotalLines} lines.\n\nLarge reviews may be slow. Continue in large-payload mode?`,
              });
              if (result === 1) {
                console.error('[ipc] User cancelled large file review');
                return;
              }
              payload.isLargePayload = true;
            }
          }
        }

        diffDataCache = payload;
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
      const ignorePatterns = configCache?.ignore ?? [];
      const files = await scanDirectory(directoryPath, ignorePatterns);
      const payload: DiffLoadPayload = {
        files,
        source: { type: 'directory', sourcePath: directoryPath },
      };

      // Large payload guard
      if (configCache) {
        const stats = computePayloadStats(
          payload.files.length,
          countTotalLines(payload.files),
          configCache
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
              detail: `Thresholds: ${configCache.maxFiles} files, ${configCache.maxTotalLines} lines.\n\nLarge reviews may be slow. Continue in large-payload mode?`,
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
      diffDataCache = payload;
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

/**
 * Prepare a DiffLoadPayload for IPC transmission.
 * In large-payload mode, strips hunks from files to reduce initial transfer size.
 * The full data stays in diffDataCache for on-demand loading via DIFF_LOAD_FILE.
 */
function preparePayload(payload: DiffLoadPayload): DiffLoadPayload {
  if (payload.isLargePayload) {
    return {
      ...payload,
      files: payload.files.map(f => ({ ...f, hunks: [] as DiffHunk[], contentLoaded: false })),
    };
  }
  return {
    ...payload,
    files: payload.files.map(f => ({ ...f, contentLoaded: true })),
  };
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
    if (reviewStateCache) {
      console.error('[ipc] Using pre-submitted review state (host-driven)');
      const state = reviewStateCache;
      reviewStateCache = null;
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
      if (reviewStateCache) {
        console.error('[ipc] Review state received from renderer');
        clearTimeout(timeout);
        clearInterval(interval);
        const state = reviewStateCache;
        reviewStateCache = null;
        resolve(state);
      }
    }, 100);
  });
}
