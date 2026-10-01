// src/main/menu.ts
// Builds the application menu. Standard menus (File/Edit/View/Window) use
// Electron's built-in role submenus so they match the platform defaults
// automatically; only the Help menu is customized.
//
// Quit is deliberately the built-in role: File > Quit / Ctrl+Q on Linux and
// Windows, the app menu's Quit / Cmd+Q on macOS. The role calls `app.quit()`,
// which main.ts intercepts in `before-quit` and routes through the same
// Save & Quit / Discard / Cancel flow as the window's close button, so no
// menu-level handler is needed and none should be added here: a custom
// click that exited directly would reopen the data-loss path.

import { Menu, shell, BrowserWindow, type MenuItemConstructorOptions } from 'electron';
import { IPC } from '../shared/ipc-channels';

const DOCUMENTATION_URL = 'https://github.com/e0ipso/self-review#self-review-';

export function setupMenu(): void {
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        {
          label: 'Documentation',
          click: () => {
            shell.openExternal(DOCUMENTATION_URL);
          },
        },
        { type: 'separator' },
        {
          label: 'About',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send(IPC.APP_SHOW_ABOUT);
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
