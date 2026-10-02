// src/main/main.ts
// Electron main process entry point

import { app, BrowserWindow, dialog, ipcMain, nativeImage } from 'electron';
import { resolve } from 'path';
import { parseCliArgs } from './cli';
import { formatGitDiffArgs } from '../../packages/core/src/git-diff-args';
import { loadConfigWithProvenance } from '../../packages/core/src/config';
import { resolveStartupSource } from '../../packages/core/src/startup-mode';
import {
  loadLocalReview,
  publishOptionsFor,
  resolveOutputTarget,
  resolveStartupDiffArgs,
} from '../../packages/core/src/startup';
import { inspectOutputPath, publishReview } from '../../packages/core/src/review-publisher';
import type {
  PublishReviewOptions,
  ReviewOutputTarget,
} from '../../packages/core/src/review-publisher';
import { QuitController, saveAndQuit } from './quit-controller';
import type { SaveFailure } from './quit-controller';
import {
  registerIpcHandlers,
  registerFindInPageForWindow,
  setDiffData,
  setGuideData,
  setConfigData,
  setOutputPathInfo,
  setResumeData,
  loadResumeFile,
  getAttachmentOrigins,
  takeSubmittedReviewState,
  isReviewOpen,
  sendDiffLoad,
  sendResumeLoad,
  sendGuideLoad,
} from './ipc-handlers';
import {
  bootstrapRemoteDiff,
  mergeRemoteThreads,
  applyRemoteProvenance,
  computeRemoteDrift,
} from '../../packages/core/src/remote-mode';
import type { RemoteBootstrapResult } from '../../packages/core/src/remote-mode';
import { isCommandCancelled } from '../../packages/core/src/forge-provider';
import { loadGuide } from '../../packages/core/src/guide-loader';
import { checkForUpdate } from './version-checker';
import { computePayloadStats, countTotalLines } from './payload-sizing';
import { setupMenu } from './menu';
import { installRendererContentPolicy } from './renderer-content-policy';
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
  ReviewSourceIdentity,
} from '../shared/types';

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
let diffIdentity: ReviewSourceIdentity | null = null;
let resumeComments: ReviewComment[] = [];
let resumeViewedFiles: string[] = [];
let appConfig: AppConfig | null = null;
let outputPathWritable: boolean = false;
const launchCwd = process.cwd();
// `inherited` origin must stay inside launchCwd; `explicit` may point anywhere. Replaced whole on a save-dialog pick.
let outputTarget: ReviewOutputTarget = {
  path: resolve(launchCwd, 'review.xml'),
  origin: 'inherited',
  baseDir: launchCwd,
};
// Remote PR/MR session state. remoteSessionInfo is injected into the
// submitted ReviewState on save so the serializer writes the remote-*
// attributes. remoteCleanup is only called through disposeRemoteSession; remoteInFlight lets a quit or
// deadline cancel a bootstrap that has not returned.
let remoteSessionInfo: RemoteSessionInfo | null = null;
let remoteCleanup: (() => Promise<void>) | null = null;
let remoteInFlight: { controller: AbortController; settled: Promise<void> } | null = null;

const STARTUP_TIMEOUT_MS = 45_000;
const STARTUP_CANCEL_GRACE_MS = 10_000;
// The welcome-screen spinner cannot be cancelled by the reviewer, so the open cancels itself after this.
const REMOTE_OPEN_TIMEOUT_MS = 10 * 60_000;
const EXIT_CLEANUP_TIMEOUT_MS = 10_000;

const quitController = new QuitController();

function isReviewWindowOpen(): boolean {
  return (
    mainWindow !== null &&
    !mainWindow.isDestroyed() &&
    !mainWindow.webContents.isLoading() &&
    isReviewOpen()
  );
}

function handleCloseRequest(event: Electron.Event): void {
  const decision = quitController.closeRequested(isReviewWindowOpen());
  if (decision === 'allow') return;
  event.preventDefault();
  if (decision === 'ask-renderer' && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC.APP_CLOSE_REQUESTED);
  }
}

// Signal handlers call process.exit() right after app.quit(), so SIGTERM/SIGINT is never held up here.
app.on('before-quit', handleCloseRequest);

// Bounded wait: the work is not interrupted when the deadline passes.
function withinTimeout(work: Promise<unknown>, ms: number, what: string): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<void>(resolve => {
    timer = setTimeout(() => {
      console.error(`[main] ${what} did not finish within ${ms / 1000}s; continuing`);
      resolve();
    }, ms);
  });
  return Promise.race([work.then(() => undefined), deadline]).finally(() => clearTimeout(timer));
}

async function runRemoteBootstrap(
  url: string,
  ignorePatterns: string[],
  controller: AbortController
): Promise<RemoteBootstrapResult> {
  const bootstrap = bootstrapRemoteDiff(
    url,
    launchCwd,
    ignorePatterns,
    {},
    {
      signal: controller.signal,
    }
  );
  remoteInFlight = {
    controller,
    settled: bootstrap.then(
      () => undefined,
      () => undefined
    ),
  };
  try {
    return await bootstrap;
  } finally {
    remoteInFlight = null;
  }
}

// Idempotent, bounded, never rejects. Temp-clone removal is the synchronous first step, which the `exit` handler relies on.
async function disposeRemoteSession(reason: string): Promise<void> {
  const inFlight = remoteInFlight;
  if (inFlight) {
    console.error(`[main] Cancelling the remote materialization in flight (${reason})`);
    inFlight.controller.abort(new Error(reason));
    await withinTimeout(inFlight.settled, EXIT_CLEANUP_TIMEOUT_MS, 'Remote cancellation');
  }
  const cleanup = remoteCleanup;
  remoteCleanup = null;
  if (cleanup) {
    await withinTimeout(cleanup(), EXIT_CLEANUP_TIMEOUT_MS, 'Remote session cleanup');
  }
}

function exitNow(code: number): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy();
  }
  void disposeRemoteSession('exit').finally(() => process.exit(code));
}

function publishOptions(): PublishReviewOptions {
  return publishOptionsFor(outputTarget, getAttachmentOrigins());
}

// Advisory only: the save re-checks.
function probeOutputPath(): boolean {
  const problem = inspectOutputPath(outputTarget.path, publishOptions());
  if (problem) {
    console.error(`[main] Output path check (${problem.code}): ${problem.message}`);
  }
  return problem === null;
}

async function reportSaveFailure(failure: SaveFailure): Promise<void> {
  console.error(`[main] Error saving review (${failure.code}): ${failure.message}`);
  for (const line of failure.detail.split('\n')) {
    if (line.length > 0) console.error(`[main]   ${line}`);
  }
  if (!mainWindow || mainWindow.isDestroyed()) return;
  await dialog.showMessageBox(mainWindow, {
    type: 'error',
    title: 'Review not saved',
    message: failure.message,
    detail: failure.detail,
    buttons: ['OK'],
    defaultId: 0,
  });
}

// 'exit' cannot wait, so only the synchronous part of the cleanup runs there; 'will-quit' holds app.quit() until the release is done.
process.on('exit', () => {
  void remoteCleanup?.();
});
app.on('will-quit', event => {
  if (!remoteCleanup && !remoteInFlight) return;
  event.preventDefault();
  void disposeRemoteSession('quit').finally(() => app.quit());
});

/**
 * Initialize the application AFTER Electron is ready.
 * This function is called from the app.whenReady() handler.
 */
async function initializeApp() {
  // At the deadline an in-flight remote bootstrap is cancelled (the catch below exits); a forced exit follows after STARTUP_CANCEL_GRACE_MS.
  const startupController = new AbortController();
  let forcedExit: NodeJS.Timeout | undefined;
  const initTimeout = setTimeout(() => {
    console.error(`[main] Initialization timeout after ${STARTUP_TIMEOUT_MS / 1000} seconds`);
    if (!remoteInFlight) {
      process.exit(1);
      return;
    }
    console.error('[main] Cancelling the remote materialization and waiting for its cleanup');
    startupController.abort(new Error('initialization timeout'));
    forcedExit = setTimeout(() => {
      console.error('[main] Remote cleanup did not finish in time; exiting');
      process.exit(1);
    }, STARTUP_CANCEL_GRACE_MS);
  }, STARTUP_TIMEOUT_MS);

  try {
    console.error('[main] Starting initialization');

    // Phase 1: Parse CLI arguments
    const cliArgs = parseCliArgs();
    console.error('[main] CLI args parsed:', JSON.stringify(cliArgs));

    // Phase 2: Load configuration (provenance decides output-path trust and default-diff-args trust)
    const loadedConfig = loadConfigWithProvenance({ cwd: launchCwd });
    appConfig = loadedConfig.config;
    outputTarget = resolveOutputTarget(null, loadedConfig, launchCwd);
    outputPathWritable = probeOutputPath();
    console.error(
      '[main] Config loaded, output path:',
      outputTarget.path,
      `(${outputTarget.origin})`,
      'writable:',
      outputPathWritable
    );

    // Phase 3: Determine git diff args. The staged/untracked default must apply before anything reads
    // appConfig.showUntracked or sends config to the renderer.
    const resolvedArgs = resolveStartupDiffArgs(cliArgs.gitDiffArgs, loadedConfig, launchCwd);
    const gitDiffArgs = resolvedArgs.gitDiffArgs;
    appConfig = resolvedArgs.config;

    // Phase 4: Determine startup mode. A forge PR/MR URL bypasses local
    // mode detection: after materialization, remote mode is git mode
    // against the materialized clone.
    const source = cliArgs.remoteUrl
      ? ({ mode: 'remote' } as const)
      : resolveStartupSource(gitDiffArgs, launchCwd);
    console.error('[main] Startup mode:', source.mode);

    let fetchedRemoteComments: ReviewComment[] = [];
    if (source.mode === 'remote') {
      // Remote mode: materialize the PR/MR, then feed the git-mode
      // pipeline with the clone's repo path and the base...head range.
      // Materialization failures throw and are handled like any other
      // fatal startup git error by the catch below.
      const { session, payload, identity } = await runRemoteBootstrap(
        cliArgs.remoteUrl!,
        appConfig.ignore,
        startupController
      );
      remoteCleanup = session.cleanup;
      remoteSessionInfo = session.remote;
      fetchedRemoteComments = session.fetchedComments;
      diffData = payload;
      diffIdentity = identity;
      console.error(
        '[main] Remote diff loaded:',
        payload.files.length,
        'files at',
        session.repoPath
      );
    } else {
      if (source.mode === 'git') {
        console.error('[main] Git diff args:', formatGitDiffArgs(gitDiffArgs));
      } else if (source.mode === 'welcome') {
        console.error('[main] Welcome mode — no git repo or directory arg');
      } else {
        console.error(`[main] Scanning ${source.mode}:`, source.sourcePath);
      }
      const loaded = await loadLocalReview(source, gitDiffArgs, appConfig, launchCwd, message =>
        console.error(`[main] ${message}`)
      );
      diffData = loaded.payload;
      diffIdentity = loaded.identity;
      if (source.mode !== 'welcome') {
        console.error('[main] Loaded', diffData.files.length, 'files');
      }
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
    let resumeImportDiagnostics: string[] = [];
    if (cliArgs.resumeFrom) {
      // The parser reports; this host decides: an unreadable document is fatal.
      try {
        console.error('[main] Loading resume file:', cliArgs.resumeFrom);
        // Attachments resolve beside the resumed document, not the launch directory or the output.
        const { parsed, importDiagnostics } = loadResumeFile(
          resolve(launchCwd, cliArgs.resumeFrom)
        );
        resumeComments = parsed.comments;
        resumeViewedFiles = parsed.viewedFiles;
        resumeRemoteHeadSha = parsed.remoteHeadSha;
        resumeImportDiagnostics = importDiagnostics;
        console.error(
          '[main] Loaded',
          resumeComments.length,
          'comments and',
          resumeViewedFiles.length,
          'viewed files from resume file'
        );
        for (const diagnostic of resumeImportDiagnostics) {
          console.error(`[main] Resume import: ${diagnostic}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[main] Error loading resume file: ${message}`);
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
      remoteDrift = computeRemoteDrift(resumeRemoteHeadSha, remoteSessionInfo.remoteHeadSha);
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
        outputTarget.path,
        appConfig,
        diffData.files.map(f => f.newPath || f.oldPath)
      );
      if (guidePayload) {
        console.error('[main] Walkthrough guide loaded:', guidePayload.groups.length, 'groups');
        setGuideData(guidePayload);
      }
    }

    // Phase 6: Cache data for when renderer requests it
    setDiffData(diffData, diffIdentity);
    setConfigData(appConfig);
    setOutputPathInfo({ resolvedOutputPath: outputTarget.path, outputPathWritable });
    if (
      resumeComments.length > 0 ||
      resumeViewedFiles.length > 0 ||
      remoteDrift !== null ||
      resumeImportDiagnostics.length > 0
    ) {
      setResumeData(resumeComments, resumeViewedFiles, remoteDrift, resumeImportDiagnostics);
    }

    // Phase 7: Register IPC handlers
    console.error('[main] Registering IPC handlers');
    registerIpcHandlers();
    registerLifecycleHandlers();

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
    if (forcedExit) clearTimeout(forcedExit);
    if (isCommandCancelled(error)) {
      // The deadline cancelled the bootstrap; its cleanup already ran.
      console.error(`[main] Remote materialization cancelled: ${error.message}`);
    } else if (error instanceof Error) {
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
      sandbox: true,
      webviewTag: false,
      // Keep UI request restrictions separate from the startup version check.
      partition: 'self-review-renderer',
    },
  });

  registerFindInPageForWindow(mainWindow);

  installRendererContentPolicy(mainWindow.webContents, MAIN_WINDOW_WEBPACK_ENTRY);
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // Data is sent when renderer requests it via IPC (see ipc-handlers.ts)

  mainWindow.on('close', handleCloseRequest);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Registered once from initializeApp: createWindow can rerun on macOS `activate` and listeners would stack.
function registerLifecycleHandlers(): void {
  // Finish Review and Save & Quit; a failed publish leaves the window open.
  ipcMain.on(IPC.APP_SAVE_AND_QUIT, async () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    console.error('[main] Save and quit requested');
    const outcome = await saveAndQuit({
      controller: quitController,
      takeState: takeSubmittedReviewState,
      publish: async state => {
        // Remote provenance is injected main-side so "Finish Review" writes
        // the remote-* attributes without renderer involvement.
        const finalState = remoteSessionInfo
          ? applyRemoteProvenance(state, remoteSessionInfo)
          : state;
        await publishReview(finalState, outputTarget.path, publishOptions());
        console.error(`[main] Review written to ${outputTarget.path}`);
      },
      reportFailure: reportSaveFailure,
      quit: () => exitNow(0),
    });
    if (outcome === 'busy') {
      console.error('[main] Save already in progress; ignoring repeated request');
    }
  });

  ipcMain.on(IPC.APP_DISCARD_AND_QUIT, () => {
    console.error('[main] Discard and quit requested');
    quitController.discard();
    exitNow(0);
  });

  // Start a remote PR/MR session from a renderer-supplied URL (the welcome
  // screen's URL field). Shares the bootstrap with the CLI URL path.
  // One open at a time; a quit cancels it, and REMOTE_OPEN_TIMEOUT_MS cancels it on its own.
  ipcMain.handle(IPC.REMOTE_OPEN_URL, async (event, url: string): Promise<RemoteOpenUrlResult> => {
    if (remoteInFlight) {
      return { ok: false, error: 'A remote review is already being opened.' };
    }
    if (remoteCleanup) {
      return { ok: false, error: 'A remote review is already open in this window.' };
    }
    const controller = new AbortController();
    const deadline = setTimeout(
      () =>
        controller.abort(
          new Error(`opening the PR/MR took longer than ${REMOTE_OPEN_TIMEOUT_MS / 60_000} minutes`)
        ),
      REMOTE_OPEN_TIMEOUT_MS
    );
    try {
      console.error('[main] Remote URL open requested:', url);
      const { session, payload, identity } = await runRemoteBootstrap(
        url,
        appConfig?.ignore ?? [],
        controller
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
            await session.cleanup();
            return { ok: false, error: 'Review cancelled.' };
          }
          payload.isLargePayload = true;
        }
      }

      remoteCleanup = session.cleanup;
      remoteSessionInfo = session.remote;
      setDiffData(payload, identity);
      setResumeData(session.fetchedComments, [], null);

      // Guide sidecar discovery for the welcome→remote path: startup
      // discovery ran against the welcome payload and skipped, so run it
      // now against the remote diff (same tolerant, never-fatal contract).
      const guidePayload = appConfig
        ? await loadGuide(
            outputTarget.path,
            appConfig,
            payload.files.map(f => f.newPath || f.oldPath)
          )
        : null;
      setGuideData(guidePayload);
      if (guidePayload) {
        console.error('[main] Walkthrough guide loaded:', guidePayload.groups.length, 'groups');
      }

      const win = BrowserWindow.fromWebContents(event.sender);
      if (win) {
        sendDiffLoad(win, payload);
        if (guidePayload) {
          sendGuideLoad(win, guidePayload);
        }
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
      if (isCommandCancelled(error)) {
        const reason = controller.signal.reason;
        const why = reason instanceof Error ? reason.message : message;
        return { ok: false, error: `Opening the PR/MR was cancelled: ${why}` };
      }
      return { ok: false, error: message };
    } finally {
      clearTimeout(deadline);
    }
  });

  // A path picked in the save dialog is explicit: it may be anywhere.
  ipcMain.handle(IPC.OUTPUT_PATH_CHANGE, async (): Promise<OutputPathInfo | null> => {
    if (!mainWindow || mainWindow.isDestroyed()) return null;

    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Review As',
      defaultPath: outputTarget.path,
      filters: [{ name: 'XML Files', extensions: ['xml'] }],
    });

    if (result.canceled || !result.filePath) return null;

    outputTarget = { path: resolve(result.filePath), origin: 'explicit' };
    outputPathWritable = probeOutputPath();
    console.error(
      '[main] Output path changed to:',
      outputTarget.path,
      'writable:',
      outputPathWritable
    );

    const info: OutputPathInfo = { resolvedOutputPath: outputTarget.path, outputPathWritable };
    setOutputPathInfo(info);
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

// This module is loaded only for a desktop launch. --help/--version, the
// macOS symlink-launch guard and the headless fetch-comments subcommand are
// all settled in src/main/cli-dispatch.ts before src/index.ts requires this
// file, so nothing here has to check for them.
//
// Call app.whenReady() IMMEDIATELY - do NOT run any other code before this
// This allows Electron to initialize its event loop without blockage
console.error('[main] Calling app.whenReady()...');
app
  .whenReady()
  .then(() => {
    console.error('[main] App is ready! Starting initialization...');

    return initializeApp();
  })
  .catch(error => {
    console.error('[main] Fatal error during app initialization:', error);
    process.exit(1);
  });
