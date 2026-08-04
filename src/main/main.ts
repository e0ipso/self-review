// src/main/main.ts
// Electron main process entry point

import { app, BrowserWindow, dialog, ipcMain, nativeImage } from 'electron';
import { writeFileSync, existsSync, statSync } from 'fs';
import { execSync } from 'child_process';
import { resolve } from 'path';
import { checkWritability } from './fs-utils';
import { parseCliArgs, checkEarlyExit, normalizeGitDiffArgs } from './cli';
import { runFetchComments } from './fetch-comments';
import { loadGitDiffWithUntracked } from './git-diff-loader';
import { scanDirectory, scanFile } from './directory-scanner';
import { loadConfig } from './config';
import { applyStagedUntrackedDefault } from './staged-untracked';
import { createIgnoreFilter } from './ignore-filter';
import { parseReviewXml } from './xml-parser';
import { serializeReview } from './xml-serializer';
import {
  registerIpcHandlers,
  registerFindInPageForWindow,
  setDiffData,
  setGuideData,
  setConfigData,
  setOutputPathInfo,
  setResumeData,
  requestReviewFromRenderer,
  sendDiffLoad,
  sendResumeLoad,
} from './ipc-handlers';
import {
  bootstrapRemoteDiff,
  mergeRemoteThreads,
  applyRemoteProvenance,
  computeRemoteDrift,
} from './remote-mode';
import { loadGuide } from './guide-loader';
import { checkForUpdate } from './version-checker';
import { computePayloadStats, countTotalLines } from './payload-sizing';
import { setupMenu } from './menu';
import { getAppIconPath } from './app-assets';
import { IPC } from '../shared/ipc-channels';
import {
  AppConfig,
  DiffLoadPayload,
  OutputPathInfo,
  RemoteDriftInfo,
  RemoteOpenUrlResult,
  RemoteSessionInfo,
  ReviewComment,
} from '../shared/types';

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
let resumeViewedFiles: string[] = [];
let appConfig: AppConfig | null = null;
let currentOutputPath: string = '';
let outputPathWritable: boolean = false;
let isQuitting = false;
// Remote PR/MR session state. remoteSessionInfo is injected into the
// submitted ReviewState on save so the serializer writes the remote-*
// attributes; remoteCleanup removes a temporary clone when one was created.
let remoteSessionInfo: RemoteSessionInfo | null = null;
let remoteCleanup: (() => void) | null = null;

// When the app is quitting (SIGTERM, app.quit(), etc.), allow windows to close
// without showing the confirmation dialog.
app.on('before-quit', () => {
  isQuitting = true;
});

// Temporary remote clones are removed on every exit path. The materializer's
// cleanup is idempotent: process 'exit' covers the direct process.exit()
// paths (Finish Review, Save & Quit, Discard, fatal errors) and 'will-quit'
// covers app.quit() flows.
process.on('exit', () => {
  remoteCleanup?.();
});
app.on('will-quit', () => {
  remoteCleanup?.();
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
  // Find the first positional arg, skipping flags and the '--' separator
  // (normalizeGitDiffArgs may have inserted '--' before path args)
  const firstPositional = gitDiffArgs.find(a => a !== '--' && !a.startsWith('-'));

  // Check if first positional arg is an existing file
  if (firstPositional) {
    const candidate = resolve(process.cwd(), firstPositional);
    try {
      if (existsSync(candidate) && statSync(candidate).isFile()) {
        if (isInGitRepo()) {
          // In git repo: tracked files go through git diff, untracked use file mode
          return isGitTracked(firstPositional) ? 'git' : 'file';
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
  if (firstPositional) {
    const candidate = resolve(process.cwd(), firstPositional);
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
    currentOutputPath = resolve(process.cwd(), appConfig.outputFile);
    outputPathWritable = checkWritability(currentOutputPath);
    console.error('[main] Config loaded, output path:', currentOutputPath, 'writable:', outputPathWritable);

    // Phase 3: Determine git diff args
    let gitDiffArgs = cliArgs.gitDiffArgs;
    if (gitDiffArgs.length === 0 && appConfig.defaultDiffArgs) {
      gitDiffArgs = appConfig.defaultDiffArgs
        .split(' ')
        .filter((arg: string) => arg.length > 0);
    }

    // Normalize: insert `--` before bare path args so expand-context
    // never confuses them with revisions.
    gitDiffArgs = normalizeGitDiffArgs(gitDiffArgs);

    // In staged-mode (--staged / --cached), hide untracked files by default
    // unless the user explicitly opted in via `show-untracked: true` in YAML.
    // Must run before any code reads appConfig.showUntracked or sends config
    // to the renderer via setConfigData.
    appConfig = applyStagedUntrackedDefault(appConfig, gitDiffArgs);

    // Phase 4: Determine startup mode. A forge PR/MR URL bypasses local
    // mode detection: after materialization, remote mode is git mode
    // against the materialized clone.
    const mode = cliArgs.remoteUrl ? 'remote' : determineMode(gitDiffArgs);
    console.error('[main] Startup mode:', mode);

    let fetchedRemoteComments: ReviewComment[] = [];
    if (mode === 'remote') {
      // Remote mode: materialize the PR/MR, then feed the git-mode
      // pipeline with the clone's repo path and the base...head range.
      // Materialization failures throw and are handled like any other
      // fatal startup git error by the catch below.
      const { session, payload } = await bootstrapRemoteDiff(
        cliArgs.remoteUrl!,
        process.cwd(),
        appConfig.ignore
      );
      remoteCleanup = session.cleanup;
      remoteSessionInfo = session.remote;
      fetchedRemoteComments = session.fetchedComments;
      diffData = payload;
      console.error(
        '[main] Remote diff loaded:',
        payload.files.length,
        'files at',
        session.repoPath
      );
    } else if (mode === 'git') {
      // Git mode: existing flow
      console.error('[main] Git diff args:', gitDiffArgs.join(' '));

      const { files: allFiles, repository } = await loadGitDiffWithUntracked(gitDiffArgs);
      console.error('[main] Loaded', allFiles.length, 'files from git diff');

      const shouldKeep = createIgnoreFilter(appConfig.ignore);
      const filteredFiles = allFiles.filter(f => shouldKeep(f.newPath || f.oldPath));

      diffData = {
        files: filteredFiles,
        source: { type: 'git', gitDiffArgs: gitDiffArgs.join(' '), repository },
      };
    } else if (mode === 'file') {
      // File mode: scan a single file as new addition
      const fileArg = gitDiffArgs.find(a => a !== '--' && !a.startsWith('-'))!;
      const filePath = resolve(process.cwd(), fileArg);
      console.error('[main] Scanning file:', filePath);

      const files = await scanFile(filePath);
      console.error('[main] File scan complete:', files.length, 'files');

      diffData = {
        files,
        source: { type: 'file', sourcePath: filePath },
      };
    } else if (mode === 'directory') {
      // Directory mode: scan the specified directory
      const dirArg = gitDiffArgs.find(a => a !== '--' && !a.startsWith('-'))!;
      const directoryPath = resolve(process.cwd(), dirArg);
      console.error('[main] Scanning directory:', directoryPath);

      const files = await scanDirectory(directoryPath, appConfig.ignore);
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

    // Phase 4b: Large payload guard
    if (diffData && diffData.source.type !== 'welcome') {
      const stats = computePayloadStats(
        diffData.files.length,
        countTotalLines(diffData.files),
        appConfig
      );
      if (stats.exceedsAny) {
        console.error(
          `[main] Large payload detected: ${stats.fileCount} files, ${stats.totalLines} lines`
        );
        const result = dialog.showMessageBoxSync({
          type: 'warning',
          buttons: ['Continue', 'Cancel'],
          defaultId: 1,
          title: 'Large Review Detected',
          message: `This review contains ${stats.fileCount} files and approximately ${stats.totalLines} lines.`,
          detail: `Thresholds: ${appConfig.maxFiles} files, ${appConfig.maxTotalLines} lines.\n\nLarge reviews may be slow. Continue in large-payload mode?`,
        });
        if (result === 1) {
          console.error('[main] User cancelled large payload review');
          app.quit();
          clearTimeout(initTimeout);
          return;
        }
        diffData.isLargePayload = true;
        console.error('[main] User chose to continue with large payload');
      }
    }

    // Phase 5: Handle --resume-from if specified
    let resumeRemoteHeadSha: string | undefined;
    if (cliArgs.resumeFrom) {
      try {
        console.error('[main] Loading resume file:', cliArgs.resumeFrom);
        const parsed = parseReviewXml(cliArgs.resumeFrom);
        resumeComments = parsed.comments;
        resumeViewedFiles = parsed.viewedFiles;
        resumeRemoteHeadSha = parsed.remoteHeadSha;
        console.error(
          '[main] Loaded',
          resumeComments.length,
          'comments and',
          resumeViewedFiles.length,
          'viewed files from resume file'
        );
      } catch {
        console.error('[main] Error loading resume file');
        clearTimeout(initTimeout);
        process.exit(1);
      }
    }

    // Phase 5a: Remote thread merge + drift. The resumed document wins:
    // fetched threads already present in it (matched by remote-id) are not
    // duplicated. Drift is only computable when the resumed document
    // recorded a remote-head-sha.
    let remoteDrift: RemoteDriftInfo | null = null;
    if (remoteSessionInfo) {
      resumeComments = mergeRemoteThreads(resumeComments, fetchedRemoteComments);
      remoteDrift = computeRemoteDrift(
        resumeRemoteHeadSha,
        remoteSessionInfo.remoteHeadSha
      );
      if (remoteDrift?.drifted) {
        console.error(
          `[main] Remote head drift detected: reviewed ${remoteDrift.recordedHeadSha}, live ${remoteDrift.liveHeadSha}`
        );
      }
    }

    // Phase 5b: Discover the walkthrough guide sidecar next to the output
    // path. Tolerant by contract: loadGuide never throws — a missing file
    // is silent, a bad one logs one stderr warning and yields no guide.
    if (diffData && diffData.source.type !== 'welcome') {
      const guidePayload = await loadGuide(
        currentOutputPath,
        appConfig,
        diffData.files.map(f => f.newPath || f.oldPath)
      );
      if (guidePayload) {
        console.error('[main] Walkthrough guide loaded:', guidePayload.groups.length, 'groups');
        setGuideData(guidePayload);
      }
    }

    // Phase 6: Cache data for when renderer requests it
    setDiffData(diffData);
    setConfigData(appConfig);
    setOutputPathInfo({ resolvedOutputPath: currentOutputPath, outputPathWritable });
    if (
      resumeComments.length > 0 ||
      resumeViewedFiles.length > 0 ||
      remoteDrift !== null
    ) {
      setResumeData(resumeComments, resumeViewedFiles, remoteDrift);
    }

    // Phase 7: Register IPC handlers
    console.error('[main] Registering IPC handlers');
    registerIpcHandlers();

    // Phase 7b: Setup menu
    console.error('[main] Setting up menu');
    setupMenu();

    // Phase 8: Create window
    console.error('[main] Creating window');
    createWindow();
    console.error('[main] Window created successfully');

    // Non-blocking version check — caches result for renderer to request
    checkForUpdate().catch(() => {});

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
  const iconImage = nativeImage.createFromPath(getAppIconPath());

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

  registerFindInPageForWindow(mainWindow);

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
      // Remote provenance is injected main-side so "Finish Review" writes
      // the remote-* attributes without renderer involvement.
      const finalState = remoteSessionInfo
        ? applyRemoteProvenance(reviewState, remoteSessionInfo)
        : reviewState;
      const xml = await serializeReview(finalState, currentOutputPath);

      writeFileSync(currentOutputPath, xml + '\n', 'utf-8');
      console.error(`[main] Review written to ${currentOutputPath}`);

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

  // Start a remote PR/MR session from a renderer-supplied URL (the welcome
  // screen's URL field). Shares the bootstrap with the CLI URL path.
  ipcMain.handle(
    IPC.REMOTE_OPEN_URL,
    async (event, url: string): Promise<RemoteOpenUrlResult> => {
      try {
        console.error('[main] Remote URL open requested:', url);
        const { session, payload } = await bootstrapRemoteDiff(
          url,
          process.cwd(),
          appConfig?.ignore ?? []
        );

        // Large payload guard, matching the startup path.
        if (appConfig) {
          const stats = computePayloadStats(
            payload.files.length,
            countTotalLines(payload.files),
            appConfig
          );
          if (stats.exceedsAny) {
            const result = dialog.showMessageBoxSync({
              type: 'warning',
              buttons: ['Continue', 'Cancel'],
              defaultId: 1,
              title: 'Large Review Detected',
              message: `This review contains ${stats.fileCount} files and approximately ${stats.totalLines} lines.`,
              detail: `Thresholds: ${appConfig.maxFiles} files, ${appConfig.maxTotalLines} lines.\n\nLarge reviews may be slow. Continue in large-payload mode?`,
            });
            if (result === 1) {
              console.error('[main] User cancelled large remote review');
              session.cleanup();
              return { ok: false, error: 'Review cancelled.' };
            }
            payload.isLargePayload = true;
          }
        }

        remoteCleanup = session.cleanup;
        remoteSessionInfo = session.remote;
        setDiffData(payload);
        setResumeData(session.fetchedComments, [], null);

        const win = BrowserWindow.fromWebContents(event.sender);
        if (win) {
          sendDiffLoad(win, payload);
          if (session.fetchedComments.length > 0) {
            sendResumeLoad(win, {
              comments: session.fetchedComments,
              viewedFiles: [],
            });
          }
        }
        return { ok: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[main] Failed to open remote URL:', message);
        return { ok: false, error: message };
      }
    }
  );

  // Handle output path change via native save dialog
  ipcMain.handle(IPC.OUTPUT_PATH_CHANGE, async (): Promise<OutputPathInfo | null> => {
    if (!mainWindow) return null;

    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Review As',
      defaultPath: currentOutputPath,
      filters: [{ name: 'XML Files', extensions: ['xml'] }],
    });

    if (result.canceled || !result.filePath) return null;

    currentOutputPath = result.filePath;
    outputPathWritable = checkWritability(currentOutputPath);
    console.error('[main] Output path changed to:', currentOutputPath, 'writable:', outputPathWritable);

    const info: OutputPathInfo = { resolvedOutputPath: currentOutputPath, outputPathWritable };
    mainWindow.webContents.send(IPC.OUTPUT_PATH_CHANGED, info);
    return info;
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

// Headless subcommand routing: fetch-comments runs fully outside the UI
// path — no app.whenReady(), no window, nothing UI-bound — and exits when
// the review file is written. parseCliArgs exits itself on a missing URL.
const routedArgs = parseCliArgs();
if (routedArgs.subcommand === 'fetch-comments') {
  runFetchComments(routedArgs.remoteUrl as string, {
    includeResolved: routedArgs.allThreads,
  })
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      console.error(
        `[fetch-comments] ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    });
} else {
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
}
