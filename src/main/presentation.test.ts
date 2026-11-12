import { expect, it, vi } from 'vitest';
vi.mock('electron', () => ({
  dialog: { showMessageBox: vi.fn(), showSaveDialog: vi.fn(), showOpenDialog: vi.fn() },
  app: { getPath: vi.fn() },
  shell: { openExternal: vi.fn() },
}));
import { dialog, type BrowserWindow } from 'electron';
import { createDesktopLocalization } from '../shared/localization';
import { DEFAULT_CONFIG } from '../../packages/react/src/config-defaults';
import {
  confirmRendererDiscard,
  confirmPayload,
  createLifecyclePresentation,
} from './presentation';
const window = { isDestroyed: () => false } as unknown as BrowserWindow;
it('uses localized, owner-bound native discard/cancel presentation with a safe default', async () => {
  const messages = createDesktopLocalization({
    messages: { Cancel: 'Keep window', 'Discard & Quit': 'Discard review' },
  });
  vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 0, checkboxChecked: false });
  await expect(confirmRendererDiscard(window, 'crashed', messages)).resolves.toBe(false);
  expect(dialog.showMessageBox).toHaveBeenCalledWith(
    window,
    expect.objectContaining({
      buttons: ['Keep window', 'Discard review'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    })
  );
  vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 1, checkboxChecked: false });
  await expect(confirmRendererDiscard(window, 'unresponsive', messages)).resolves.toBe(true);
});
it('formats native thresholds/counts through the same English-fallback locale service', async () => {
  vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 1, checkboxChecked: false });
  const messages = createDesktopLocalization({ locale: 'de-DE', direction: 'rtl' });
  const payload = {
    files: ['a', 'b'].map(newPath => ({
      newPath,
      oldPath: '',
      changeType: 'added' as const,
      isBinary: false,
      hunks: [],
    })),
    source: { type: 'welcome' as const },
  };
  await confirmPayload(
    payload,
    { ...DEFAULT_CONFIG, maxFiles: 1, maxTotalLines: 1000 },
    window,
    messages
  );
  expect(dialog.showMessageBox).toHaveBeenCalledWith(
    window,
    expect.objectContaining({
      message: 'This review contains 2 files and approximately 0 lines.',
      detail: expect.stringContaining('1.000 lines'),
    })
  );
  expect(messages.t('Review size', { files: 1, lines: 1 })).toBe(
    'This review contains 1 file and approximately 1 line.'
  );
  expect(messages.t('Review size', { files: 2, lines: 1 })).toBe(
    'This review contains 2 files and approximately 1 line.'
  );
  expect(messages.t('Review thresholds', { files: 1, lines: 1 })).toContain(
    'Thresholds: 1 file, 1 line.'
  );
  expect(messages.direction).toBe('rtl');
  expect(messages.date(new Date(2026, 0, 2), { dateStyle: 'short' })).toBe('02.01.26');
});
it('injects native output and save-error messages without loading a React runtime', async () => {
  const messages = createDesktopLocalization({
    messages: { 'Review not saved': 'Still open', 'Save Review As': 'Choose output' },
  });
  const native = createLifecyclePresentation(messages);
  vi.mocked(dialog.showSaveDialog).mockResolvedValue({ canceled: true, filePath: '' });
  await expect(native.pickOutputPath(window, '/review.xml')).resolves.toBeNull();
  expect(dialog.showSaveDialog).toHaveBeenCalledWith(
    window,
    expect.objectContaining({ title: 'Choose output' })
  );
  await native.reportSaveFailure(window, {
    code: 'io-error',
    message: 'disk full',
    detail: 'no bytes changed',
  });
  expect(dialog.showMessageBox).toHaveBeenCalledWith(
    window,
    expect.objectContaining({ title: 'Still open', message: 'disk full' })
  );
});

it('delivers Spanish regional catalog messages to native dialogs while preserving engine diagnostics', async () => {
  const messages = createDesktopLocalization({ locale: 'es-MX' });
  const lifecycle = createLifecyclePresentation(messages);
  vi.mocked(dialog.showSaveDialog).mockResolvedValue({ canceled: true, filePath: '' });
  await lifecycle.pickOutputPath(window, '/review.xml');
  expect(dialog.showSaveDialog).toHaveBeenCalledWith(
    window,
    expect.objectContaining({
      title: 'Guardar revisión como',
      filters: [{ name: 'Archivos XML', extensions: ['xml'] }],
    })
  );
  await lifecycle.reportSaveFailure(window, {
    code: 'io-error',
    message: 'EIO: fsync',
    detail: 'Path: /review.xml',
  });
  expect(dialog.showMessageBox).toHaveBeenCalledWith(
    window,
    expect.objectContaining({
      title: 'Revisión sin guardar',
      message: 'EIO: fsync',
      detail: 'Path: /review.xml',
      buttons: ['Aceptar'],
    })
  );
  vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 0, checkboxChecked: false });
  await confirmRendererDiscard(window, 'unresponsive', messages);
  expect(dialog.showMessageBox).toHaveBeenCalledWith(
    window,
    expect.objectContaining({
      title: 'Ventana de revisión no disponible',
      message: 'La ventana de revisión no responde.',
      buttons: ['Cancelar', 'Descartar y salir'],
    })
  );
});
