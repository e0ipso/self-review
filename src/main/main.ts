// Electron composition root. The session, window and resource lifetimes each have one owner.
import { app, ipcMain } from 'electron';
import { createDesktopSession } from './desktop-session';
import { createDesktopShutdown } from './remote-lifetime';
import { WindowOwner } from './window-owner';
import { createReviewWindow } from './desktop-window';
import { initializeSession } from './startup';
import { QuitController } from './quit-controller';
import { registerIpcHandlers } from './ipc-handlers';
import { createIpcBoundary } from './ipc-boundary';
import { registerLifecycleHandlers } from './lifecycle-handlers';
import { checkForUpdate, getVersionUpdate } from './version-checker';
import { setupMenu } from './menu';
import { getAppIconDataUri } from './app-assets';
import { createReviewPresentation } from './presentation';
import { IPC } from '../shared/ipc-channels';

const desktop = createDesktopSession(process.cwd());
const quit = new QuitController();
const windows = new WindowOwner(() => createReviewWindow(handleCloseRequest));
const shutdown = createDesktopShutdown(
  desktop.remote,
  code => process.exit(code),
  () => {
    windows.stop();
    windows.current?.destroy();
  }
);

function handleCloseRequest(event: Electron.Event): void {
  const window = windows.current;
  const reviewOpen =
    !!window &&
    !window.webContents.isLoading() &&
    !!desktop.review.diffData &&
    desktop.review.diffData.source.type !== 'welcome';
  const decision = quit.closeRequested(reviewOpen);
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
    const timeout = setTimeout(() => {
      console.error('[main] Initialization timeout after 45 seconds');
      windows.stop();
      void shutdown(1, 'initialization timeout');
    }, 45_000);
    try {
      if (!(await initializeSession(desktop))) {
        await shutdown(0, 'initialization cancelled');
        return;
      }
      if (desktop.remote.closed) return;
      const boundary = createIpcBoundary(ipcMain, () => windows.current);
      registerIpcHandlers(
        desktop.review,
        boundary,
        desktop.transition,
        createReviewPresentation(getAppIconDataUri, getVersionUpdate)
      );
      registerLifecycleHandlers(desktop, boundary, quit, shutdown);
      setupMenu();
      windows.initialize();
      // The check uses the default network session. Late completions target the current live window.
      void checkForUpdate()
        .then(() => {
          const update = getVersionUpdate();
          const window = windows.current;
          if (update && window) window.webContents.send(IPC.VERSION_UPDATE_AVAILABLE, update);
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
