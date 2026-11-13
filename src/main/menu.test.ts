import { it, expect, vi } from 'vitest';
import type { MenuItemConstructorOptions } from 'electron';
vi.mock('electron', () => ({
  app: { isPackaged: true, quit: vi.fn(), exit: vi.fn() },
  Menu: { buildFromTemplate: vi.fn(value => value), setApplicationMenu: vi.fn() },
  shell: { openExternal: vi.fn(async () => {}) },
  BrowserWindow: { getFocusedWindow: vi.fn() },
  // Any unintended shutdown would be observable from the menu failure regression.
}));
import { app, Menu, shell, BrowserWindow } from 'electron';
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

it('uses the resolved Spanish catalog for native menu labels and preserves roles', async () => {
  const { createDesktopLocalization } = await import('../shared/localization');
  setupMenu(createDesktopLocalization({ locale: 'es-MX' }));
  const template = vi.mocked(Menu.buildFromTemplate).mock.lastCall![0];
  expect(template.find(item => item.label === 'Ver')).toBeDefined();
  const help = template.find(item => item.role === 'help')!.submenu as MenuItemConstructorOptions[];
  expect(help.map(item => item.label).filter(Boolean)).toEqual(['Documentación', 'Acerca de']);
  expect(template.find(item => item.role === 'fileMenu')).toBeDefined();
});

it.each(['throw', 'reject'] as const)(
  'contains rejecting Documentation and diagnostics that %s without unhandled shutdown',
  async kind => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    const previousDiagnostic = console.error;
    const previousOpen = shell.openExternal;
    let opened = 0;
    let reported = 0;
    // Plain effects matter here: a spy can attach rejection handlers while recording results.
    console.error = () => {
      reported++;
      if (kind === 'throw') throw new Error('diagnostic unavailable');
      return Promise.reject(new Error('diagnostic unavailable'));
    };
    Object.defineProperty(shell, 'openExternal', {
      configurable: true,
      value: () => {
        opened++;
        return Promise.reject(new Error('no browser'));
      },
    });
    try {
      setupMenu();
      const template = vi.mocked(Menu.buildFromTemplate).mock.lastCall![0];
      const help = template.find(item => item.role === 'help')!
        .submenu as MenuItemConstructorOptions[];
      help.find(item => item.label === 'Documentation')!.click!(undefined!, undefined!, undefined!);
      await new Promise(resolve => setImmediate(resolve));
      expect(opened).toBe(1);
      expect(unhandled).not.toHaveBeenCalled();
      expect(reported).toBe(1);
      expect(app.quit).not.toHaveBeenCalled();
      expect(app.exit).not.toHaveBeenCalled();
    } finally {
      console.error = previousDiagnostic;
      Object.defineProperty(shell, 'openExternal', { configurable: true, value: previousOpen });
      process.off('unhandledRejection', unhandled);
    }
  }
);

it('routes About to the focused window at click time and tolerates no window', () => {
  setupMenu();
  const help = vi
    .mocked(Menu.buildFromTemplate)
    .mock.lastCall![0].find(item => item.role === 'help')!.submenu as MenuItemConstructorOptions[];
  const click = () =>
    help.find(item => item.label === 'About')!.click!(undefined!, undefined!, undefined!);
  const send = vi.fn();
  vi.mocked(BrowserWindow.getFocusedWindow).mockReturnValueOnce({
    webContents: { send },
  } as unknown as BrowserWindow);
  click();
  expect(send).toHaveBeenCalledExactlyOnceWith('app:show-about');
  vi.mocked(BrowserWindow.getFocusedWindow).mockReturnValueOnce(null);
  expect(click).not.toThrow();
});
