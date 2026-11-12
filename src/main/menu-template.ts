import type { MenuItemConstructorOptions } from 'electron';
import { createDesktopLocalization, type DesktopLocalization } from '../shared/localization';

export interface MenuActions {
  documentation: () => void | Promise<void>;
  about: () => void | Promise<void>;
}

/** Pure menu policy. Native Quit remains a role and reaches before-quit interception. */
export function createMenuTemplate(
  options: { isMac: boolean; isPackaged: boolean },
  actions: MenuActions,
  messages: DesktopLocalization = createDesktopLocalization()
): MenuItemConstructorOptions[] {
  const { isMac } = options;
  return [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    {
      label: messages.t('View'),
      submenu: [
        ...(!options.isPackaged
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
          label: messages.t('Documentation'),
          click: () => {
            void actions.documentation();
          },
        },
        { type: 'separator' },
        {
          label: messages.t('About'),
          click: () => {
            void actions.about();
          },
        },
      ],
    },
  ];
}
