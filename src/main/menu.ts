// src/main/menu.ts
// Builds the application menu. Standard menus (File/Edit/View/Window) use
// Electron's built-in role submenus so they match the platform defaults
// automatically; only the Help menu is customized.

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
