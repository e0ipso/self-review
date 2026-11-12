import { expect, it, vi } from 'vitest';
import type { MenuItemConstructorOptions } from 'electron';
import { createMenuTemplate } from './menu-template';

it.each([true, false])('keeps native roles and supplied actions on mac=%s', isMac => {
  const actions = { documentation: vi.fn(), about: vi.fn() };
  const template = createMenuTemplate({ isMac, isPackaged: true }, actions);
  expect(template.some(item => item.role === 'appMenu')).toBe(isMac);
  for (const role of ['fileMenu', 'editMenu', 'windowMenu'])
    expect(template.some(item => item.role === role)).toBe(true);
  const help = template.find(item => item.role === 'help')!.submenu as MenuItemConstructorOptions[];
  help.find(item => item.label === 'Documentation')!.click!(undefined!, undefined!, undefined!);
  help.find(item => item.label === 'About')!.click!(undefined!, undefined!, undefined!);
  expect(actions.documentation).toHaveBeenCalledOnce();
  expect(actions.about).toHaveBeenCalledOnce();
  // Native file/app menu roles own Quit; no direct exit callback bypasses interception.
  expect(template.some(item => item.role === 'quit' || item.label === 'Quit')).toBe(false);
});
