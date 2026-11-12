import type { BrowserWindow } from 'electron';
import { IPC } from '../shared/ipc-channels';
import { createIpcBoundary, findRequest, findAction } from './ipc-boundary';
import type { FindInPageRequest } from '../shared/types';
export function registerFindHandlers(boundary: ReturnType<typeof createIpcBoundary>) {
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
