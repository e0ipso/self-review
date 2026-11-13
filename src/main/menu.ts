// Native composition stays at the edge; template policy has no Electron globals.
import { app, Menu, shell, BrowserWindow } from 'electron';
import { createDesktopLocalization } from '../shared/localization';
import { IPC } from '../shared/ipc-channels';
import { createMenuTemplate } from './menu-template';
import { runMenuAction } from './action-failure';

const DOCUMENTATION_URL = 'https://github.com/e0ipso/self-review#self-review-';

export function setupMenu(messages = createDesktopLocalization()): void {
  const template = createMenuTemplate(
    { isMac: process.platform === 'darwin', isPackaged: app.isPackaged },
    {
      documentation: () =>
        runMenuAction(
          () => shell.openExternal(DOCUMENTATION_URL),
          () => console.error('[main] Could not open Documentation.')
        ),
      about: () =>
        runMenuAction(
          () => {
            BrowserWindow.getFocusedWindow()?.webContents.send(IPC.APP_SHOW_ABOUT);
          },
          () => console.error('[main] Could not show About.')
        ),
    },
    messages
  );
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
