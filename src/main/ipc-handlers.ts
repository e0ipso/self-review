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
  ReviewSourceIdentity,
  SuggestionApplyRequest,
  SuggestionApplyOutcome,
  ApplyDestinationOutcome,
} from '../shared/types';
import { getVersionUpdate } from './version-checker';
import { getAppIconDataUri } from './app-assets';
import {
  applySuggestionForSession,
  commitDiffData,
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
  recordResumedAttachments,
  setApplyDestination,
  submitReviewState,
  takeReviewState,
} from '../../packages/core/src/review-handlers';
import type { AttachmentOrigins } from '../../packages/core/src/attachment-origins';
import { loadResumeDocument } from '../../packages/core/src/startup';
import type { ParsedReview } from '../../packages/core/src/xml-parser';

// The desktop application's own session. A single module-scope `const` holding
// it is expected: the mutable state lives inside the session value, which is
// passed explicitly to every extracted handler.
const desktopSession = createReviewSession();

export function setDiffData(data: DiffLoadPayload, identity: ReviewSourceIdentity | null): void {
  // Committing through core captures the session's reviewed paths, which
  // authorize every later apply, and records the source identity every read
  // of reviewed content resolves against; a bare assignment would leave both
  // empty. The identity is null only for a welcome payload.
  commitDiffData(desktopSession, data, identity);
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
  remoteDrift: RemoteDriftInfo | null = null,
  importDiagnostics: string[] = []
): void {
  desktopSession.resumeComments = comments;
  desktopSession.resumeViewedFiles = viewedFiles;
  desktopSession.resumeRemoteDrift = remoteDrift;
  desktopSession.resumeImportDiagnostics = importDiagnostics;
}

/**
 * Record that the resumed comments came from the document at
 * `resumeDocumentPath`, so their attachments are read from beside it and
 * carried along when the review is saved elsewhere. Returns the import
 * diagnostics for attachment references that will never be read.
 */
export function setResumeDocument(
  comments: readonly ReviewComment[],
  resumeDocumentPath: string
): string[] {
  return recordResumedAttachments(desktopSession, comments, resumeDocumentPath);
}

/**
 * Resume the review document at `resumePath` into the desktop session, the
 * way serve startup does: comments, viewed files, import diagnostics and
 * attachment origins beside the document. Throws when it cannot be read;
 * main decides what that means.
 */
export function loadResumeFile(resumePath: string): {
  parsed: ParsedReview;
  /** The parser's diagnostics plus the attachment references that will never be read. */
  importDiagnostics: string[];
} {
  const parsed = loadResumeDocument(desktopSession, resumePath);
  return { parsed, importDiagnostics: desktopSession.resumeImportDiagnostics };
}

/** Where the resumed attachments live, for the publisher; see `PublishReviewOptions`. */
export function getAttachmentOrigins(): AttachmentOrigins {
  return desktopSession.attachmentOrigins;
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

  // Handle applying one suggestion to the reviewed working file
  ipcMain.handle(
    IPC.SUGGESTION_APPLY,
    async (_event, request: SuggestionApplyRequest): Promise<SuggestionApplyOutcome> =>
      applySuggestionForSession(desktopSession, request)
  );

  // Handle the reviewer naming a destination directory for applies. Only a
  // temporary-clone remote review needs one; the picker is opened here, so
  // the renderer never names a directory the app then writes into.
  ipcMain.handle(
    IPC.SUGGESTION_CHOOSE_DESTINATION,
    async (event): Promise<ApplyDestinationOutcome> => {
      const win = BrowserWindow.fromWebContents(event.sender);
      const options: Electron.OpenDialogOptions = {
        properties: ['openDirectory', 'createDirectory'],
        title: 'Choose a directory to apply suggestions into',
        defaultPath: app.getPath('home'),
      };
      const result = win
        ? await dialog.showOpenDialog(win, options)
        : await dialog.showOpenDialog(options);
      if (result.canceled || result.filePaths.length === 0) {
        return { status: 'cancelled' };
      }
      return setApplyDestination(desktopSession, result.filePaths[0]);
    }
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

  // Handle attachment read from renderer. The renderer names the reference
  // the review wrote (`.self-review-assets/<name>`), and core authorizes it
  // against the session; anything it refuses reads as missing.
  ipcMain.handle(
    IPC.ATTACHMENT_READ,
    async (_event, reference: unknown): Promise<ArrayBuffer | null> => {
      const result = await readAttachment(desktopSession, reference);
      return result.ok ? result.data : null;
    }
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
  ipcMain.handle(IPC.DIFF_EXPAND_CONTEXT, async (_event, request: ExpandContextRequest) =>
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
  ipcMain.handle(IPC.REVIEW_START_DIRECTORY, async (event, directoryPath: string) => {
    const { payload, identity, stats, exceedsThresholds } = await prepareDirectoryReview(
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
    const outgoing = commitReviewStart(desktopSession, payload, identity);
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
      window.webContents.send(IPC.DIFF_LOAD, outgoing);
    }

    if (payload.source.type === 'file') {
      console.error('[ipc] File review started:', payload.files.length, 'files');
    } else {
      console.error(
        '[ipc] Directory review started:',
        payload.source.type,
        'mode with',
        payload.files.length,
        'files'
      );
    }
  });
}

export function sendDiffLoad(window: BrowserWindow, payload: DiffLoadPayload): void {
  window.webContents.send(IPC.DIFF_LOAD, preparePayload(payload));
}

export function sendConfigLoad(
  window: BrowserWindow,
  config: AppConfig,
  outputPathInfo?: OutputPathInfo
): void {
  window.webContents.send(IPC.CONFIG_LOAD, config, outputPathInfo);
}

export function sendResumeLoad(window: BrowserWindow, payload: ResumeLoadPayload): void {
  window.webContents.send(IPC.RESUME_LOAD, payload);
}

export function sendGuideLoad(window: BrowserWindow, payload: GuideLoadPayload): void {
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

/**
 * The review state the renderer pushed over `review:submit` ahead of a save,
 * consumed exactly once. Every save path (Finish Review, Save & Quit) pushes
 * first, so a `null` here means the renderer did not, and the caller treats
 * that as a failed save: main never pulls state from the renderer and never
 * substitutes an empty review.
 */
export function takeSubmittedReviewState(): ReviewState | null {
  const state = takeReviewState(desktopSession);
  if (state) {
    console.error('[ipc] Using pushed review state for save');
  }
  return state;
}

/**
 * True while this session is reviewing something, as opposed to showing the
 * welcome screen. The close/quit flow asks the renderer only in that case;
 * a welcome screen has nothing to save and quits directly.
 */
export function isReviewOpen(): boolean {
  const diff = desktopSession.diffData;
  return diff !== null && diff.source.type !== 'welcome';
}
