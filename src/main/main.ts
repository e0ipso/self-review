// src/main/main.ts
// Electron main process entry point

import { app, BrowserWindow } from 'electron';
import { parseCliArgs, checkEarlyExit } from './cli';
import { runGitDiffAsync, getRepoRootAsync, validateGitAvailable } from './git';
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

// Install signal handlers FIRST, before any app initialization
process.on('SIGTRAP', () => {
  console.error('[main] SIGTRAP received (debugger signal) - exiting gracefully');
  process.exit(0); // Exit 0 since SIGTRAP is from Playwright debugger, not an error
});

process.on('SIGILL', () => {
  console.error('[main] SIGILL received (illegal instruction) - exiting');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.error('[main] SIGTERM received - shutting down');
  if (app) app.quit();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.error('[main] SIGINT received - shutting down');
  if (app) app.quit();
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('[main] Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[main] Unhandled rejection:', reason);
  process.exit(1);
});

// Handle Squirrel startup events on Windows
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Configure Electron for test/headless environments
// This prevents initialization issues in containers with Xvfb
if (process.env.NODE_ENV === 'test' || process.env.DISPLAY === ':99') {
  // Disable hardware acceleration completely
  app.disableHardwareAcceleration();
  // Disable sandbox to work around AppArmor restrictions in containers
  app.commandLine.appendSwitch('no-sandbox');
  // Force X11 backend (not Wayland) for Xvfb compatibility
  app.commandLine.appendSwitch('ozone-platform', 'x11');
  // Disable GPU compositing
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-gpu-compositing');
}

let mainWindow: BrowserWindow | null = null;
let diffData: DiffLoadPayload | null = null;
let resumeComments: any[] = [];
let appConfig: any = null;

/**
 * Initialize the application AFTER Electron is ready.
 * This function is called from the app.whenReady() handler.
 */
async function initializeApp() {
  // Add overall initialization timeout
  const initTimeout = setTimeout(() => {
    console.error('[main] Initialization timeout after 45 seconds');
    process.exit(1);
  }, 45000);

  try {
    console.error('[main] Starting initialization');

    // Phase 1: Parse CLI arguments
    const cliArgs = parseCliArgs();
    console.error('[main] CLI args parsed:', JSON.stringify(cliArgs));

    // Phase 2: Load configuration
    appConfig = loadConfig();
    console.error('[main] Config loaded');

    // Phase 3: Determine git diff args
    let gitDiffArgs = cliArgs.gitDiffArgs;
    if (gitDiffArgs.length === 0 && appConfig.defaultDiffArgs) {
      gitDiffArgs = appConfig.defaultDiffArgs.split(' ').filter((arg: string) => arg.length > 0);
    }
    if (gitDiffArgs.length === 0) {
      gitDiffArgs = ['--staged'];
    }
    console.error('[main] Git diff args:', gitDiffArgs.join(' '));

    // Phase 4: Get repository root (async with timeout)
    console.error('[main] Getting repository root');
    const repository = await getRepoRootAsync();
    console.error('[main] Repository root:', repository);

    // Phase 5: Run git diff (async with timeout)
    console.error('[main] Running git diff');
    const rawDiff = await runGitDiffAsync(gitDiffArgs);
    console.error('[main] Git diff complete, size:', rawDiff.length, 'bytes');

    // Phase 6: Parse diff into structured format
    console.error('[main] Parsing diff');
    const files = parseDiff(rawDiff);
    console.error('[main] Diff parsed:', files.length, 'files');

    // Store diff data for sending to renderer
    diffData = {
      files,
      gitDiffArgs: gitDiffArgs.join(' '),
      repository,
    };

    // Phase 7: Handle --resume-from if specified
    if (cliArgs.resumeFrom) {
      try {
        console.error('[main] Loading resume file:', cliArgs.resumeFrom);
        const parsed = parseReviewXml(cliArgs.resumeFrom);
        resumeComments = parsed.comments;
        console.error('[main] Loaded', resumeComments.length, 'comments from resume file');
      } catch (error) {
        console.error('[main] Error loading resume file');
        clearTimeout(initTimeout);
        process.exit(1);
      }
    }

    // Phase 8: Register IPC handlers
    console.error('[main] Registering IPC handlers');
    registerIpcHandlers();

    // Phase 9: Create window
    console.error('[main] Creating window');
    createWindow();
    console.error('[main] Window created successfully');

    clearTimeout(initTimeout);
    console.error('[main] Initialization complete');

  } catch (error) {
    clearTimeout(initTimeout);
    if (error instanceof Error) {
      console.error(`[main] Initialization error: ${error.message}`);
      console.error(`[main] Stack trace: ${error.stack}`);
    } else {
      console.error('[main] Initialization error: unknown error');
    }
    // Try to quit the app cleanly before exiting
    try {
      app.quit();
    } catch {
      // Ignore quit errors
    }
    process.exit(1);
  }
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

// Check for --help/--version ONLY (these must exit before Electron initializes)
const earlyExit = checkEarlyExit();
if (earlyExit.shouldExit) {
  process.exit(earlyExit.exitCode);
}

// Call app.whenReady() IMMEDIATELY - do NOT run any other code before this
// This allows Electron to initialize its event loop without blockage
console.error('[main] Calling app.whenReady()...');
app.whenReady()
  .then(() => {
    console.error('[main] App is ready! Starting validation and initialization...');

    // Now do git validation (after Electron is ready)
    try {
      console.error('[main] Validating git availability');
      validateGitAvailable();
      console.error('[main] Git validation passed');
    } catch (error) {
      // validateGitAvailable already logs errors
      app.quit();
      process.exit(1);
    }

    return initializeApp();
  })
  .catch((error) => {
    console.error('[main] Fatal error during app initialization:', error);
    process.exit(1);
  });
