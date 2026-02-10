// src/main/main.ts
// Electron main process entry point

import { app, BrowserWindow } from 'electron';
import { parseCliArgs } from './cli';
import { runGitDiff, getRepoRoot } from './git';
import { parseDiff } from './diff-parser';
import { loadConfig } from './config';
import { parseReviewXml } from './xml-parser';
import { serializeReview } from './xml-serializer';
import {
  registerIpcHandlers,
  sendDiffLoad,
  sendConfigLoad,
  sendResumeLoad,
  requestReviewFromRenderer,
} from './ipc-handlers';
import { DiffLoadPayload, ReviewState } from '../shared/types';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

// Handle Squirrel startup events on Windows
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let diffData: DiffLoadPayload | null = null;
let resumeComments: any[] = [];
let appConfig: any = null;

async function main() {
  // Parse CLI arguments
  const cliArgs = parseCliArgs();

  // Load configuration
  appConfig = loadConfig();

  // Determine git diff args (use config default if none provided)
  let gitDiffArgs = cliArgs.gitDiffArgs;
  if (gitDiffArgs.length === 0 && appConfig.defaultDiffArgs) {
    gitDiffArgs = appConfig.defaultDiffArgs.split(' ').filter((arg: string) => arg.length > 0);
  }
  if (gitDiffArgs.length === 0) {
    gitDiffArgs = ['--staged'];
  }

  // Get repository root
  const repository = getRepoRoot();

  // Run git diff
  const rawDiff = runGitDiff(gitDiffArgs);

  // Parse diff into structured format
  const files = parseDiff(rawDiff);

  // Store diff data for sending to renderer
  diffData = {
    files,
    gitDiffArgs: gitDiffArgs.join(' '),
    repository,
  };

  // If --resume-from, parse the XML file
  if (cliArgs.resumeFrom) {
    try {
      const parsed = parseReviewXml(cliArgs.resumeFrom);
      resumeComments = parsed.comments;
    } catch (error) {
      // Error already logged by parseReviewXml
      process.exit(1);
    }
  }

  // Register IPC handlers
  registerIpcHandlers();

  // Create window when app is ready
  await app.whenReady();
  createWindow();
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // Send data to renderer after window loads
  mainWindow.webContents.on('did-finish-load', () => {
    if (!mainWindow) return;

    // Send diff data
    if (diffData) {
      sendDiffLoad(mainWindow, diffData);
    }

    // Send config
    if (appConfig) {
      sendConfigLoad(mainWindow, appConfig);
    }

    // Send resume comments if applicable
    if (resumeComments.length > 0) {
      sendResumeLoad(mainWindow, { comments: resumeComments });
    }
  });

  // Handle window close - this is where we serialize to XML
  mainWindow.on('close', async (event) => {
    if (!mainWindow) return;

    // Prevent default close
    event.preventDefault();

    try {
      // Request review state from renderer
      const reviewState = await requestReviewFromRenderer(mainWindow);

      // Serialize to XML
      const xml = await serializeReview(reviewState);

      // Write to stdout
      process.stdout.write(xml);
      process.stdout.write('\n');

      // Now quit
      mainWindow.destroy();
      mainWindow = null;
      app.quit();
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error during window close: ${error.message}`);
      } else {
        console.error('Error during window close: unknown error');
      }
      process.exit(1);
    }
  });
}

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// On macOS, re-create window when dock icon is clicked
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Start the application
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
