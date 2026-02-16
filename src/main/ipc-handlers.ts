// src/main/ipc-handlers.ts
// IPC handler registration

import * as fs from 'fs';
import { execSync } from 'child_process';
import { ipcMain, BrowserWindow, dialog, app } from 'electron';
import { IPC } from '../shared/ipc-channels';
import {
  DiffLoadPayload,
  ResumeLoadPayload,
  AppConfig,
  ReviewState,
  ReviewComment,
} from '../shared/types';
import { scanDirectory, scanFile } from './directory-scanner';

let reviewStateCache: ReviewState | null = null;
let diffDataCache: DiffLoadPayload | null = null;
let configCache: AppConfig | null = null;
let resumeCommentsCache: ReviewComment[] = [];

export function setDiffData(data: DiffLoadPayload): void {
  diffDataCache = data;
}

export function setConfigData(data: AppConfig): void {
  configCache = data;
}

export function setResumeComments(comments: ReviewComment[]): void {
  resumeCommentsCache = comments;
}

export function registerIpcHandlers(): void {
  // Handle diff data request from renderer
  ipcMain.on(IPC.DIFF_REQUEST, event => {
    if (diffDataCache) {
      event.sender.send(IPC.DIFF_LOAD, diffDataCache);
    }
  });

  // Handle config request from renderer
  ipcMain.on(IPC.CONFIG_REQUEST, event => {
    if (configCache) {
      event.sender.send(IPC.CONFIG_LOAD, configCache);
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
  ipcMain.on('resume:request', event => {
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

        diffDataCache = payload;
        const window = BrowserWindow.fromWebContents(event.sender);
        if (window) {
          window.webContents.send(IPC.DIFF_LOAD, payload);
        }

        console.error(
          '[ipc] File review started:',
          payload.files.length,
          'files'
        );
        return;
      }

      // Check if the selected directory is a git repo
      let isGitRepo = false;
      try {
        execSync('git rev-parse --git-dir', {
          cwd: directoryPath,
          stdio: 'ignore',
        });
        isGitRepo = true;
      } catch {
        // Not a git repo — use directory mode
      }

      let payload: DiffLoadPayload;

      if (isGitRepo) {
        // Git mode: import and use git functions
        const { runGitDiffAsync, getRepoRootAsync, getUntrackedFilesAsync, generateUntrackedDiffs } = await import('./git');
        const { parseDiff } = await import('./diff-parser');

        const repository = await getRepoRootAsync();
        const rawDiff = await runGitDiffAsync([]);
        const files = parseDiff(rawDiff);

        const untrackedPaths = await getUntrackedFilesAsync();
        let allFiles = files;
        if (untrackedPaths.length > 0) {
          const untrackedDiffStr = generateUntrackedDiffs(
            untrackedPaths,
            repository
          );
          if (untrackedDiffStr.length > 0) {
            const untrackedFiles = parseDiff(untrackedDiffStr);
            for (const file of untrackedFiles) {
              file.isUntracked = true;
            }
            allFiles = [...files, ...untrackedFiles];
          }
        }

        payload = {
          files: allFiles,
          source: { type: 'git', gitDiffArgs: '', repository },
        };
      } else {
        // Directory mode: scan all files as new additions
        const files = await scanDirectory(directoryPath);
        payload = {
          files,
          source: { type: 'directory', sourcePath: directoryPath },
        };
      }

      // Update the cache and send to renderer
      diffDataCache = payload;
      const window = BrowserWindow.fromWebContents(event.sender);
      if (window) {
        window.webContents.send(IPC.DIFF_LOAD, payload);
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
  window.webContents.send(IPC.DIFF_LOAD, payload);
}

export function sendConfigLoad(window: BrowserWindow, config: AppConfig): void {
  window.webContents.send(IPC.CONFIG_LOAD, config);
}

export function sendResumeLoad(
  window: BrowserWindow,
  payload: ResumeLoadPayload
): void {
  window.webContents.send(IPC.RESUME_LOAD, payload);
}

export function requestReviewFromRenderer(
  window: BrowserWindow
): Promise<ReviewState> {
  return new Promise(resolve => {
    // Clear cached state
    reviewStateCache = null;

    // Send request to renderer
    console.error('[ipc] Sending review:request to renderer');
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
        resolve(reviewStateCache);
      }
    }, 100);
  });
}
