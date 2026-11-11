// Electron composition root. The session, window and resource lifetimes each have one owner.
import { app, ipcMain } from 'electron';
import { createDesktopSession } from './desktop-session';
import { createDesktopShutdown } from './remote-lifetime';
import { WindowOwner } from './window-owner';
import { PublishedReviewRecovery } from './published-review-recovery';
import { RendererRecovery } from './renderer-recovery';
import { createDesktopLocalization, resolveApplicationLocale } from '../shared/localization';
import { createReviewWindow, observeRendererHealth } from './desktop-window';
import { initializeSession } from './startup';
import { QuitController } from './quit-controller';
import { bindDesktopReviewOperations } from './review-operations';
import { registerIpcHandlers } from './ipc-handlers';
import { createIpcBoundary } from './ipc-boundary';
import { registerLifecycleHandlers } from './lifecycle-handlers';
import { checkForUpdate, getVersionUpdate } from './version-checker';
import { setupMenu } from './menu';
import { getAppIconDataUri } from './app-assets';
import {
  createReviewPresentation,
  createLifecyclePresentation,
  confirmRendererDiscard,
  confirmPublishedClose,
} from './presentation';
import { createDesktopPublication } from './publication';
import { registerRemoteOpenHandler } from './remote-open-handler';
import { IPC } from '../shared/ipc-channels';

const desktop = createDesktopSession(process.cwd());
const quit = new QuitController();
let applicationLocale = resolveApplicationLocale('en');
let messages = createDesktopLocalization(applicationLocale);
let recovery: RendererRecovery | null = null;
const windows = new WindowOwner(() => {
  const window = createReviewWindow(handleCloseRequest);
  const cancel = desktop.operations.replaceWindow();
  desktop.review.reviewState = null;
  const health = new RendererRecovery({
    isCurrent: () => windows.current === window,
    confirmDiscard: failure => confirmRendererDiscard(window, failure, messages),
    invalidateState: () => {
      desktop.review.reviewState = null;
    },
    discard: stillCurrent =>
      desktop.operations.complete(async () => {
        if (!stillCurrent() || quit.phase !== 'reviewing') return;
        quit.discard();
        void shutdown(0, 'discard');
      }, true),
  });
  recovery = health;
  observeRendererHealth(window, health);
  window.on('closed', () => {
    cancel(new Error('The review window closed.'));
    desktop.review.reviewState = null;
  });
  return window;
});
const publishedRecovery = new PublishedReviewRecovery({
  getWindow: () => windows.current,
  captureFailure: () => recovery?.captureFailure() ?? null,
  confirm: window => confirmPublishedClose(window, messages),
  quit: () => {
    quit.saveSucceeded();
    desktop.operations.releaseCompletion();
    void shutdown(0, 'saved');
  },
});
const shutdownResources = createDesktopShutdown(
  {
    dispose: async (reason: string) => {
      windows.stop();
      await Promise.all([desktop.operations.dispose(reason), desktop.remote.dispose(reason)]);
    },
  },
  code => process.exit(code),
  () => {
    windows.stop();
    windows.current?.destroy();
  }
);

function shutdown(code: number, reason: string): Promise<void> {
  windows.stop();
  return shutdownResources(code, reason);
}

function handleCloseRequest(event: Electron.Event): void {
  if (publishedRecovery.requestClose()) {
    event.preventDefault();
    return;
  }
  const window = windows.current;
  const hasReview = !!desktop.review.diffData && desktop.review.diffData.source.type !== 'welcome';
  if (
    hasReview &&
    quit.phase === 'reviewing' &&
    !desktop.operations.finishing &&
    recovery?.requestClose()
  ) {
    event.preventDefault();
    return;
  }
  const reviewOpen =
    !!window && !window.webContents.isDestroyed() && !window.webContents.isLoading() && hasReview;
  const decision =
    desktop.operations.finishing && !quit.mayQuit ? 'ignore' : quit.closeRequested(reviewOpen);
  if (decision === 'allow') return;
  event.preventDefault();
  if (decision === 'ask-renderer') window?.webContents.send(IPC.APP_CLOSE_REQUESTED);
}

// Preserve desktop signal exit codes while allowing bounded remote cancellation/release.
for (const [signal, code] of [
  ['SIGTRAP', 0],
  ['SIGILL', 1],
  ['SIGTERM', 0],
  ['SIGINT', 0],
] as const) {
  process.on(signal, () => {
    void shutdown(code, signal);
  });
}
process.on('uncaughtException', error => {
  console.error('[main] Uncaught exception:', error);
  void shutdown(1, 'uncaught exception');
});
process.on('unhandledRejection', reason => {
  console.error('[main] Unhandled rejection:', reason);
  void shutdown(1, 'unhandled rejection');
});

app.on('before-quit', handleCloseRequest);
app.on('will-quit', event => {
  event.preventDefault();
  windows.stop();
  void shutdown(0, 'quit');
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => windows.activate());

// No window may be created until session initialization and IPC registration have completed.
void app
  .whenReady()
  .then(async () => {
    applicationLocale = resolveApplicationLocale(app.getLocale?.());
    messages = createDesktopLocalization(applicationLocale);
    const timeout = setTimeout(() => {
      console.error('[main] Initialization timeout after 45 seconds');
      windows.stop();
      void shutdown(1, 'initialization timeout');
    }, 45_000);
    try {
      const presentation = createReviewPresentation(getAppIconDataUri, getVersionUpdate, messages);
      if (
        !(await desktop.operations.read(
          signal => initializeSession(desktop, signal, presentation.confirmPayload),
          45_000
        ))
      ) {
        await shutdown(0, 'initialization cancelled');
        return;
      }
      if (desktop.remote.closed) return;
      const boundary = createIpcBoundary(ipcMain, () =>
        recovery?.unavailable ? null : windows.current
      );
      boundary.handle(
        IPC.APP_LOCALE,
        value => {
          if (value !== undefined) throw new Error('No payload expected.');
        },
        () => applicationLocale
      );
      registerIpcHandlers(
        desktop.review,
        boundary,
        desktop.transition,
        presentation,
        desktop.operations,
        bindDesktopReviewOperations(desktop.review, () => quit.phase === 'reviewing')
      );
      const publication = createDesktopPublication(desktop);
      registerLifecycleHandlers(
        desktop,
        boundary,
        quit,
        shutdown,
        {
          publish: async (state, signal) => {
            const owner = windows.current;
            const frame = owner?.webContents.mainFrame;
            await publication.publish(state, signal);
            publishedRecovery.record(owner, frame);
          },
        },
        createLifecyclePresentation(messages),
        messages
      );
      registerRemoteOpenHandler(desktop, boundary, presentation);
      setupMenu(messages);
      windows.initialize();
      // The check uses the default network session. Late completions target the current live window.
      void checkForUpdate({ signal: desktop.operations.signal })
        .then(() => {
          const update = getVersionUpdate();
          const window = windows.current;
          if (update && window && !desktop.operations.signal.aborted)
            window.webContents.send(IPC.VERSION_UPDATE_AVAILABLE, update);
        })
        .catch(() => {});
    } catch (error) {
      console.error('[main] Initialization error:', error);
      await shutdown(1, 'initialization failed');
    } finally {
      clearTimeout(timeout);
    }
  })
  .catch(error => {
    console.error('[main] Fatal error during app initialization:', error);
    void shutdown(1, 'app readiness failed');
  });
