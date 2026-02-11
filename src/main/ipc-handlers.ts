// src/main/ipc-handlers.ts
// IPC handler registration

import { ipcMain, BrowserWindow } from 'electron';
import { IPC } from '../shared/ipc-channels';
import { DiffLoadPayload, ResumeLoadPayload, AppConfig, ReviewState } from '../shared/types';

let reviewStateCache: ReviewState | null = null;
let diffDataCache: DiffLoadPayload | null = null;
let configCache: AppConfig | null = null;
let resumeCommentsCache: any[] = [];

export function setDiffData(data: DiffLoadPayload): void {
  diffDataCache = data;
}

export function setConfigData(data: AppConfig): void {
  configCache = data;
}

export function setResumeComments(comments: any[]): void {
  resumeCommentsCache = comments;
}

export function registerIpcHandlers(): void {
  // Handle diff data request from renderer
  ipcMain.on(IPC.DIFF_REQUEST, (event) => {
    if (diffDataCache) {
      event.sender.send(IPC.DIFF_LOAD, diffDataCache);
    }
  });

  // Handle config request from renderer
  ipcMain.on(IPC.CONFIG_REQUEST, (event) => {
    if (configCache) {
      event.sender.send(IPC.CONFIG_LOAD, configCache);
    }
  });

  // Handle review submission from renderer
  ipcMain.on(IPC.REVIEW_SUBMIT, (_event, state: ReviewState) => {
    reviewStateCache = state;
  });

  // Send resume comments when renderer is ready (after diff data is loaded)
  ipcMain.on('resume:request', (event) => {
    if (resumeCommentsCache.length > 0) {
      event.sender.send(IPC.RESUME_LOAD, { comments: resumeCommentsCache });
    }
  });
}

export function sendDiffLoad(window: BrowserWindow, payload: DiffLoadPayload): void {
  window.webContents.send(IPC.DIFF_LOAD, payload);
}

export function sendConfigLoad(window: BrowserWindow, config: AppConfig): void {
  window.webContents.send(IPC.CONFIG_LOAD, config);
}

export function sendResumeLoad(window: BrowserWindow, payload: ResumeLoadPayload): void {
  window.webContents.send(IPC.RESUME_LOAD, payload);
}

export function requestReviewFromRenderer(window: BrowserWindow): Promise<ReviewState> {
  return new Promise((resolve) => {
    // Clear cached state
    reviewStateCache = null;

    // Send request to renderer
    window.webContents.send('review:request');

    // Wait for response with timeout
    const timeout = setTimeout(() => {
      console.error('Warning: Timeout waiting for review state from renderer');
      resolve({
        timestamp: new Date().toISOString(),
        gitDiffArgs: '',
        repository: '',
        files: [],
      });
    }, 5000);

    // Poll for the cached state
    const interval = setInterval(() => {
      if (reviewStateCache) {
        clearTimeout(timeout);
        clearInterval(interval);
        resolve(reviewStateCache);
      }
    }, 100);
  });
}
