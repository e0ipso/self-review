// src/main/main.ts
// Electron main process entry point

import { app, BrowserWindow, ipcMain, nativeImage } from 'electron';
import { writeFileSync, existsSync, statSync } from 'fs';
import { execSync } from 'child_process';
import { resolve, join } from 'path';
import { parseCliArgs, checkEarlyExit } from './cli';
import { loadGitDiffWithUntracked } from './git-diff-loader';
import { scanDirectory, scanFile } from './directory-scanner';
import { loadConfig } from './config';
import { parseReviewXml } from './xml-parser';
import { serializeReview } from './xml-serializer';
import {
  registerIpcHandlers,
  setDiffData,
  setConfigData,
  setResumeComments,
  requestReviewFromRenderer,
} from './ipc-handlers';
import { IPC } from '../shared/ipc-channels';
import { AppConfig, DiffLoadPayload, ReviewComment } from '../shared/types';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

// Install signal handlers FIRST, before any app initialization
process.on('SIGTRAP', () => {
  console.error(
    '[main] SIGTRAP received (debugger signal) - exiting gracefully'
  );
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

process.on('uncaughtException', error => {
  console.error('[main] Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', reason => {
  console.error('[main] Unhandled rejection:', reason);
  process.exit(1);
});

// Handle Squirrel startup events on Windows
// eslint-disable-next-line @typescript-eslint/no-require-imports
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
let resumeComments: ReviewComment[] = [];
let appConfig: AppConfig | null = null;
let isQuitting = false;

// When the app is quitting (SIGTERM, app.quit(), etc.), allow windows to close
// without showing the confirmation dialog.
app.on('before-quit', () => {
  isQuitting = true;
});

/**
 * Check if the current working directory is inside a git repository.
 */
function isInGitRepo(): boolean {
  try {
    execSync('git rev-parse --git-dir', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a file is tracked by git (known to the index).
 */
function isGitTracked(filePath: string): boolean {
  try {
    execSync(`git ls-files --error-unmatch ${JSON.stringify(filePath)}`, {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Determine the startup mode based on git availability and CLI arguments.
 * Returns the DiffSource type to use.
 */
function determineMode(gitDiffArgs: string[]): 'git' | 'directory' | 'file' | 'welcome' {
  // Check if first arg is an existing file
  if (gitDiffArgs.length > 0) {
    const candidate = resolve(process.cwd(), gitDiffArgs[0]);
    try {
      if (existsSync(candidate) && statSync(candidate).isFile()) {
        if (isInGitRepo()) {
          // In git repo: tracked files go through git diff, untracked use file mode
          return isGitTracked(gitDiffArgs[0]) ? 'git' : 'file';
        }
        return 'file';
      }
    } catch {
      // Failed to stat — fall through
    }
  }

  if (isInGitRepo()) {
    return 'git';
  }

  // Not in a git repo — check if first positional arg is an existing directory
  if (gitDiffArgs.length > 0) {
    const candidate = resolve(process.cwd(), gitDiffArgs[0]);
    try {
      if (existsSync(candidate) && statSync(candidate).isDirectory()) {
        return 'directory';
      }
    } catch {
      // Failed to stat — fall through to welcome
    }
  }

  return 'welcome';
}

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
      gitDiffArgs = appConfig.defaultDiffArgs
        .split(' ')
        .filter((arg: string) => arg.length > 0);
    }

    // Phase 4: Determine startup mode
    const mode = determineMode(gitDiffArgs);
    console.error('[main] Startup mode:', mode);

    if (mode === 'git') {
      // Git mode: existing flow
      console.error('[main] Git diff args:', gitDiffArgs.join(' '));

      const { files: allFiles, repository } = await loadGitDiffWithUntracked(gitDiffArgs);
      console.error('[main] Loaded', allFiles.length, 'files from git diff');

      diffData = {
        files: allFiles,
        source: { type: 'git', gitDiffArgs: gitDiffArgs.join(' '), repository },
      };
    } else if (mode === 'file') {
      // File mode: scan a single file as new addition
      const filePath = resolve(process.cwd(), gitDiffArgs[0]);
      console.error('[main] Scanning file:', filePath);

      const files = await scanFile(filePath);
      console.error('[main] File scan complete:', files.length, 'files');

      diffData = {
        files,
        source: { type: 'file', sourcePath: filePath },
      };
    } else if (mode === 'directory') {
      // Directory mode: scan the specified directory
      const directoryPath = resolve(process.cwd(), gitDiffArgs[0]);
      console.error('[main] Scanning directory:', directoryPath);

      const files = await scanDirectory(directoryPath);
      console.error('[main] Directory scan complete:', files.length, 'files');

      diffData = {
        files,
        source: { type: 'directory', sourcePath: directoryPath },
      };
    } else {
      // Welcome mode: open window with no diff data
      console.error('[main] Welcome mode — no git repo or directory arg');

      diffData = {
        files: [],
        source: { type: 'welcome' },
      };
    }

    // Phase 5: Handle --resume-from if specified (git mode only)
    if (cliArgs.resumeFrom && mode === 'git') {
      try {
        console.error('[main] Loading resume file:', cliArgs.resumeFrom);
        const parsed = parseReviewXml(cliArgs.resumeFrom);
        resumeComments = parsed.comments;
        console.error(
          '[main] Loaded',
          resumeComments.length,
          'comments from resume file'
        );
      } catch {
        console.error('[main] Error loading resume file');
        clearTimeout(initTimeout);
        process.exit(1);
      }
    }

    // Phase 6: Cache data for when renderer requests it
    setDiffData(diffData);
    setConfigData(appConfig);
    if (resumeComments.length > 0) {
      setResumeComments(resumeComments);
    }

    // Phase 7: Register IPC handlers
    console.error('[main] Registering IPC handlers');
    registerIpcHandlers();

    // Phase 8: Create window
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
  // On Linux, set the window icon explicitly so alt+tab and taskbar show
  // the correct icon. macOS uses the .icns from the app bundle automatically.
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(__dirname, '..', '..', 'assets', 'icon.png');
  const iconImage = nativeImage.createFromPath(iconPath);

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    ...(process.platform === 'linux' && !iconImage.isEmpty() && { icon: iconImage }),
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // Data is sent when renderer requests it via IPC (see ipc-handlers.ts)

  // Handle window close - intercept and ask renderer to show confirmation dialog
  // Skip the dialog when the app is quitting (SIGTERM, process.kill, etc.)
  mainWindow.on('close', event => {
    if (!mainWindow || isQuitting) return;
    event.preventDefault();
    mainWindow.webContents.send(IPC.APP_CLOSE_REQUESTED);
  });

  // Handle save-and-quit from renderer (Finish Review button or dialog Save & Quit)
  ipcMain.on(IPC.APP_SAVE_AND_QUIT, async () => {
    if (!mainWindow) return;

    try {
      console.error('[main] Save and quit requested');
      const reviewState = await requestReviewFromRenderer(mainWindow);
      const outputPath = resolve(process.cwd(), appConfig!.outputFile);
      const xml = await serializeReview(reviewState, outputPath);

      writeFileSync(outputPath, xml + '\n', 'utf-8');
      console.error(`[main] Review written to ${outputPath}`);

      mainWindow.destroy();
      process.exit(0);
    } catch (error) {
      if (error instanceof Error) {
        console.error(`[main] Error saving review: ${error.message}`);
      } else {
        console.error('[main] Error saving review: unknown error');
      }
      process.exit(1);
    }
  });

  // Handle discard-and-quit from renderer (dialog Discard button)
  ipcMain.on(IPC.APP_DISCARD_AND_QUIT, () => {
    console.error('[main] Discard and quit requested');
    if (mainWindow) {
      mainWindow.destroy();
    }
    process.exit(0);
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
app
  .whenReady()
  .then(() => {
    console.error(
      '[main] App is ready! Starting initialization...'
    );

    return initializeApp();
  })
  .catch(error => {
    console.error('[main] Fatal error during app initialization:', error);
    process.exit(1);
  });
