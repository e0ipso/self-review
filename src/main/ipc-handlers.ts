// src/main/ipc-handlers.ts
// IPC handler registration

import type { BrowserWindow } from 'electron';
import { IPC } from '../shared/ipc-channels';
import {
  DiffLoadPayload,
  ResumeLoadPayload,
  GuideLoadPayload,
  AppConfig,
  OutputPathInfo,
  ReviewState,
  ExpandContextRequest,
  FindInPageRequest,
  ImageLoadResult,
  AppInfo,
  SuggestionApplyRequest,
  SuggestionApplyOutcome,
  ApplyDestinationOutcome,
} from '../shared/types';
import {
  applySuggestionForSessionAsync,
  commitReviewStart,
  expandContext,
  getConfigLoad,
  getDiffLoad,
  getFileHunks,
  getResumeLoad,
  loadImage,
  prepareDirectoryReview,
  preparePayload,
  readAttachment,
  setApplyDestination,
  submitReviewState,
} from '../../packages/core/src/review-handlers';

import {
  createIpcBoundary,
  noArgument,
  stringArgument,
  findRequest,
  findAction,
  expansionRequest,
  suggestionRequest,
  reviewState,
} from './ipc-boundary';
import type { ReviewSession } from '../../packages/core/src/review-handlers';
import { ReviewTransition } from './review-transition';
import { DirectorySelection } from './directory-selection';
import { DesktopOperations } from './desktop-operations';
import type { ReviewPresentation } from './presentation';

export function registerIpcHandlers(
  desktopSession: ReviewSession,
  boundary: ReturnType<typeof createIpcBoundary>,
  transition: ReviewTransition,
  presentation: ReviewPresentation,
  operations = new DesktopOperations()
): void {
  const selection = new DirectorySelection(transition, boundary.capture, event =>
    presentation.pickDirectory(boundary.assertPeer(event))
  );
  // Handle diff data request from renderer
  boundary.on(IPC.DIFF_REQUEST, noArgument, event => {
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
  boundary.handle(
    IPC.DIFF_LOAD_IMAGE,
    stringArgument,
    async (_event, filePath: string): Promise<ImageLoadResult> =>
      operations.read(signal => loadImage(desktopSession, filePath, { signal }))
  );

  // Handle applying one suggestion to the reviewed working file
  boundary.handle(
    IPC.SUGGESTION_APPLY,
    suggestionRequest,
    async (_event, request: SuggestionApplyRequest): Promise<SuggestionApplyOutcome> =>
      operations.apply(signal =>
        applySuggestionForSessionAsync(desktopSession, request, { signal })
      )
  );

  // Handle the reviewer naming a destination directory for applies. Only a
  // temporary-clone remote review needs one; the picker is opened here, so
  // the renderer never names a directory the app then writes into.
  boundary.handle(
    IPC.SUGGESTION_CHOOSE_DESTINATION,
    noArgument,
    async (event): Promise<ApplyDestinationOutcome> =>
      operations.apply(async signal => {
        const current = boundary.capture(event);
        const original = desktopSession.sourceIdentity;
        const win = boundary.assertPeer(event);
        const path = await presentation.pickDirectory(win, true);
        if (path === null) return { status: 'cancelled' };
        current();
        signal.throwIfAborted();
        if (desktopSession.sourceIdentity !== original)
          throw new Error('The review session has changed.');
        return setApplyDestination(desktopSession, path);
      })
  );

  // Handle single-file content loading for lazy (large-payload) mode
  boundary.handle(IPC.DIFF_LOAD_FILE, stringArgument, async (_event, filePath: string) =>
    operations.read(async () => getFileHunks(desktopSession, filePath))
  );

  // Handle config request from renderer
  boundary.on(IPC.CONFIG_REQUEST, noArgument, event => {
    const load = getConfigLoad(desktopSession);
    if (load) {
      event.sender.send(IPC.CONFIG_LOAD, load.config, load.outputPathInfo);
    }
  });

  // Handle app info request from renderer (version + icon for the About dialog)
  boundary.handle(IPC.APP_GET_INFO, noArgument, async (): Promise<AppInfo> => {
    return operations.read(() => presentation.appInfo());
  });

  // Handle review submission from renderer
  boundary.on(IPC.REVIEW_SUBMIT, reviewState, (_event, state: ReviewState) => {
    submitReviewState(desktopSession, state);
  });

  // Core authorizes the reference; anything it refuses reads as missing.
  boundary.handle(
    IPC.ATTACHMENT_READ,
    stringArgument,
    async (_event, reference: unknown): Promise<ArrayBuffer | null> => {
      const result = await operations.read(signal =>
        readAttachment(desktopSession, reference, { signal })
      );
      return result.ok ? result.data : null;
    }
  );

  // Send resumed comments and viewed files when the renderer is ready
  // (after diff data is loaded)
  boundary.on(IPC.RESUME_REQUEST, noArgument, event => {
    const payload = getResumeLoad(desktopSession);
    event.sender.send(IPC.RESUME_LOAD, payload ?? { comments: [], viewedFiles: [] });
  });

  boundary.handle(IPC.DIALOG_PICK_DIRECTORY, noArgument, event =>
    operations.read(() => selection.choose(event), 10 * 60_000)
  );

  // Expand context for a single file by re-running git diff with more context lines
  boundary.handle(
    IPC.DIFF_EXPAND_CONTEXT,
    expansionRequest,
    async (_event, request: ExpandContextRequest) =>
      operations.read(signal =>
        expandContext(desktopSession, request, undefined, { signal, timeoutMs: 30_000 })
      )
  );

  // Find in page: forward search request to Chromium
  boundary.on(IPC.FIND_IN_PAGE, findRequest, (event, request: FindInPageRequest) => {
    const win = boundary.assertPeer(event);

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
  boundary.on(IPC.FIND_STOP, findAction, (event, action) => {
    const win = boundary.assertPeer(event);

    win.webContents.stopFindInPage(action);
  });

  // Handle version update request from renderer
  boundary.on(IPC.VERSION_UPDATE_REQUEST, noArgument, event => {
    const update = presentation.versionUpdate();
    if (update) {
      event.sender.send(IPC.VERSION_UPDATE_AVAILABLE, update);
    }
  });

  // Handle open-external requests from renderer
  boundary.handle(IPC.OPEN_EXTERNAL, stringArgument, async (_event, url: string) => {
    // Security: only allow https://github.com/ URLs
    if (typeof url === 'string' && url.startsWith('https://github.com/')) {
      await presentation.openExternal(url);
    }
  });

  // Start a directory review from a picked path
  boundary.handle(
    IPC.REVIEW_START_DIRECTORY,
    stringArgument,
    async (event, directoryPath: string) =>
      operations.read(async signal => {
        const current = boundary.capture(event);
        const opening = transition.begin();
        try {
          const authorizedPath = await selection.authorize(event, directoryPath);
          const { payload, identity } = await prepareDirectoryReview(
            desktopSession,
            authorizedPath
          );
          current();
          opening.assertCurrent();
          // Scan only the authorized physical root while retaining the reviewer's displayed path.
          if (payload.source.type === 'directory') payload.source.sourcePath = directoryPath;
          if (
            desktopSession.config &&
            !(await presentation.confirmPayload(
              payload,
              desktopSession.config,
              boundary.assertPeer(event)
            ))
          )
            return;

          await selection.authorize(event, directoryPath);
          current();
          opening.assertCurrent();
          signal.throwIfAborted();
          // Update the cache and send to renderer
          const outgoing = commitReviewStart(desktopSession, payload, identity);
          boundary.assertPeer(event).webContents.send(IPC.DIFF_LOAD, outgoing);

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
        } finally {
          opening.finish();
        }
      }, 10 * 60_000)
  );
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
