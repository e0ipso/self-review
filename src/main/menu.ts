// src/main/menu.ts
// Builds the application menu. Standard menus (File/Edit/View/Window) use
// Electron's built-in role submenus where they preserve review state. View excludes
// destructive reload actions in packaged builds.
//
// Quit stays the built-in role: main.ts intercepts its `app.quit()` in `before-quit`. A custom click that
// exited directly would reopen the data-loss path.

import { app, Menu, shell, BrowserWindow, type MenuItemConstructorOptions } from 'electron';
import { IPC } from '../shared/ipc-channels';

const DOCUMENTATION_URL = 'https://github.com/e0ipso/self-review#self-review-';

export function setupMenu(): void {
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        ...(!app.isPackaged
          ? [
              { role: 'reload' as const },
              { role: 'forceReload' as const },
              { role: 'toggleDevTools' as const },
              { type: 'separator' as const },
            ]
          : []),
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
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
