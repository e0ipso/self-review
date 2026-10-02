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
// What diffData is a review of; committed with it. Null for the welcome screen.
let diffIdentity: ReviewSourceIdentity | null = null;
let resumeComments: ReviewComment[] = [];
let resumeViewedFiles: string[] = [];
let appConfig: AppConfig | null = null;
let outputPathWritable: boolean = false;
const launchCwd = process.cwd();
// Where the review is published and how far the publisher trusts the path
// (resolveOutputTarget): project configuration or the default is
// `inherited` and must stay inside the launch directory; the reviewer's own
// user-level output-file, or a path picked in the save dialog, is
// `explicit`. (The desktop CLI has no --output flag.) Replaced whole on a
// save-dialog pick; set for real in phase 2.
let outputTarget: ReviewOutputTarget = {
  path: resolve(launchCwd, 'review.xml'),
  origin: 'inherited',
  baseDir: launchCwd,
};
// Remote PR/MR session state. remoteSessionInfo is injected into the
// submitted ReviewState on save so the serializer writes the remote-*
// attributes; remoteCleanup removes a temporary clone when one was created.
let remoteSessionInfo: RemoteSessionInfo | null = null;
let remoteCleanup: (() => void) | null = null;

// The one close/quit/save state machine. The window's close button, menu
// Quit, Cmd+Q/Ctrl+Q, Finish Review and the Save & Quit / Discard dialog all
// consult it; only a successful save or an explicit discard lets the process
// exit. See quit-controller.ts.
const quitController = new QuitController();

/**
 * Whether a review window with something to lose is on screen. A welcome
 * screen, a missing or destroyed window, or a renderer that has not loaded
 * yet has nothing to save, so closing it goes straight through.
 */
function isReviewWindowOpen(): boolean {
  return (
    mainWindow !== null &&
    !mainWindow.isDestroyed() &&
    !mainWindow.webContents.isLoading() &&
    isReviewOpen()
  );
}

/**
 * Applies the controller's decision to a window close or an app quit:
 * either let it through, or stop it and hand the question to the renderer,
 * whose dialog answers over app:save-and-quit / app:discard-and-quit (Cancel
 * answers nothing and the review simply continues).
 */
function handleCloseRequest(event: Electron.Event): void {
  const decision = quitController.closeRequested(isReviewWindowOpen());
  if (decision === 'allow') return;
  event.preventDefault();
  if (decision === 'ask-renderer' && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC.APP_CLOSE_REQUESTED);
  }
}

// Menu Quit, Cmd+Q/Ctrl+Q and any other app.quit() arrive here first. With a
// review open they are intercepted and routed through the same confirmation
// as the window's close button; the welcome screen quits directly. The
// signal handlers above call process.exit() right after app.quit(), so a
// SIGTERM/SIGINT is never held up by this.
app.on('before-quit', handleCloseRequest);

/**
 * The only way the review flow ends the process. Called after the document
 * is on disk (Finish Review, Save & Quit) or after an explicit Discard.
 */
function exitNow(code: number): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy();
  }
  process.exit(code);
}

function publishOptions(): PublishReviewOptions {
  // Resumed attachments are copied beside an output in another directory.
  return publishOptionsFor(outputTarget, getAttachmentOrigins());
}

/**
 * The startup hint behind the file tree's writability mark and the Finish
 * Review button: the publisher's own read-only checks against the current
 * output path, so the hint and the save-time error agree. Advisory only —
 * the save re-checks and reports its own failure.
 */
function probeOutputPath(): boolean {
  const problem = inspectOutputPath(outputTarget.path, publishOptions());
  if (problem) {
    console.error(`[main] Output path check (${problem.code}): ${problem.message}`);
  }
  return problem === null;
}

/**
 * A save that did not happen. Logged in full to stderr, then shown in a
 * native dialog over the review window, which stays open with every
 * comment in place.
 */
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

    // Phase 2: Load configuration. Where each value came from decides its
    // trust: the output path's origin (resolveOutputTarget) and whether the
    // default diff arguments may name write-capable git options.
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

    // Phase 3: Determine git diff args: the command line's, or the
    // configured default-diff-args split with shell quoting (a committed
    // configuration may not use them to make git write or run programs;
    // that throws here, before any git command, and is reported by the
    // catch below), normalized so a path is never read as a revision, then
    // the staged/untracked default, which must apply before any code reads
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
      const { session, payload, identity } = await bootstrapRemoteDiff(
        cliArgs.remoteUrl!,
        launchCwd,
        appConfig.ignore
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
      // Local modes, loaded by the same core step serve uses: the git diff
      // (ignore-filtered, argv recorded losslessly), a scanned directory or
      // file, or the empty welcome payload with no identity, which opens the
      // window with the directory picker.
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
      // The parser reports; this host decides. A document that cannot be
      // read is fatal here, with its message, exactly as before — the
      // difference is that the decision is made in main, not in the library.
      try {
        console.error('[main] Loading resume file:', cliArgs.resumeFrom);
        // The core resume step serve uses too: comments, viewed files and
        // import diagnostics land on the desktop session, with attachments
        // resolving beside the resumed document, not the launch directory
        // or the output. Phase 5a may still merge remote threads into them.
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

  // The window's close button (and Cmd+W) go through the same decision as
  // app quit: a review window asks the renderer, anything else closes.
  mainWindow.on('close', handleCloseRequest);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * The IPC listeners that belong to the app's lifetime rather than to one
 * window. Registered once from initializeApp: createWindow can run again on
 * macOS (`activate`), and listeners registered there would stack.
 */
function registerLifecycleHandlers(): void {
  // Finish Review and the dialog's Save & Quit. The renderer has pushed its
  // state over review:submit first; the document is validated, attachments
  // staged, then renamed into place, so a failure leaves any previous
  // review.xml intact — and leaves this window open with every comment in
  // place, the failure shown in a dialog, and the output path changeable.
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

  // The dialog's Discard button: exit without writing anything.
  ipcMain.on(IPC.APP_DISCARD_AND_QUIT, () => {
    console.error('[main] Discard and quit requested');
    quitController.discard();
    exitNow(0);
  });

  // Start a remote PR/MR session from a renderer-supplied URL (the welcome
  // screen's URL field). Shares the bootstrap with the CLI URL path.
  ipcMain.handle(IPC.REMOTE_OPEN_URL, async (event, url: string): Promise<RemoteOpenUrlResult> => {
    try {
      console.error('[main] Remote URL open requested:', url);
      const { session, payload, identity } = await bootstrapRemoteDiff(
        url,
        launchCwd,
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
      return { ok: false, error: message };
    }
  });

  // Handle output path change via native save dialog. A path the reviewer
  // picked here is explicit: it may be anywhere, inside the project or not.
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
    // The session's output decides which asset directory attachment reads fall back to.
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
