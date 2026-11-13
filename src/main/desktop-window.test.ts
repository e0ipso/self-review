import { EventEmitter } from 'events';
import type { BrowserWindow } from 'electron';
import { expect, it, vi } from 'vitest';
vi.mock('electron', () => ({ BrowserWindow: vi.fn(), nativeImage: {} }));
import { observeRendererHealth } from './desktop-window';
import { RendererRecovery } from './renderer-recovery';
it('routes confirmed Electron health events and stops recovery with its window', async () => {
  const events = new EventEmitter();
  const contents = new EventEmitter();
  const window = Object.assign(events, { webContents: contents }) as unknown as BrowserWindow;
  const confirmDiscard = vi.fn(async () => false);
  const recovery = new RendererRecovery({
    isCurrent: () => true,
    confirmDiscard,
    discard: vi.fn(),
    invalidateState: vi.fn(),
  });
  observeRendererHealth(window, recovery);
  expect(recovery.requestClose()).toBe(false);
  events.emit('unresponsive');
  expect(recovery.requestClose()).toBe(true);
  await vi.waitFor(() => expect(confirmDiscard).toHaveBeenCalledWith('unresponsive'));
  events.emit('responsive');
  expect(recovery.requestClose()).toBe(false);
  contents.emit('render-process-gone', {}, { reason: 'crashed' });
  // Let the earlier cancelled native prompt settle before asking about the crash.
  await Promise.resolve();
  await Promise.resolve();
  expect(recovery.requestClose()).toBe(true);
  await vi.waitFor(() => expect(confirmDiscard).toHaveBeenCalledWith('crashed'));
  contents.emit('did-finish-load');
  expect(recovery.requestClose()).toBe(false);
  events.emit('closed');
  events.emit('unresponsive');
  expect(recovery.requestClose()).toBe(false);
});
