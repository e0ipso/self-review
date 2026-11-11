import { it, expect, vi } from 'vitest';
import type { MenuItemConstructorOptions } from 'electron';
vi.mock('electron', () => ({
  app: { isPackaged: true },
  Menu: { buildFromTemplate: vi.fn(value => value), setApplicationMenu: vi.fn() },
  shell: {},
  BrowserWindow: {},
}));
import { app, Menu } from 'electron';
import { setupMenu } from './menu';
it('preserves zoom and fullscreen without packaged reload accelerators', () => {
  for (const packaged of [true, false]) {
    Object.defineProperty(app, 'isPackaged', { value: packaged, configurable: true });
    setupMenu();
    const template = vi.mocked(Menu.buildFromTemplate).mock.lastCall![0];
    expect(template.some(item => item.role === 'viewMenu')).toBe(false);
    const view = template.find(item => item.label === 'View')!
      .submenu as MenuItemConstructorOptions[];
    const roles = view.map(item => item.role);
    expect(roles).toContain('zoomIn');
    expect(roles).toContain('togglefullscreen');
    expect(roles.includes('reload')).toBe(!packaged);
    expect(roles.includes('forceReload')).toBe(!packaged);
    expect(template.some(item => item.role === 'fileMenu')).toBe(true);
  }
});
