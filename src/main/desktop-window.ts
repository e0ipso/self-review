import { BrowserWindow, nativeImage } from 'electron';
import { installRendererContentPolicy } from './renderer-content-policy';
import { getAppIconPath } from './app-assets';
import { registerFindInPageForWindow } from './ipc-handlers';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

export function createReviewWindow(onClose: (event: Electron.Event) => void): BrowserWindow {
  const icon = nativeImage.createFromPath(getAppIconPath());
  const window = new BrowserWindow({
    width: 1400,
    height: 900,
    ...(process.platform === 'linux' && !icon.isEmpty() && { icon }),
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: false,
      partition: 'self-review-renderer',
    },
  });
  registerFindInPageForWindow(window);
  installRendererContentPolicy(window.webContents, MAIN_WINDOW_WEBPACK_ENTRY);
  void window.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  window.on('close', onClose);
  return window;
}
