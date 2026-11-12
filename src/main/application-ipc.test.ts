import { expect, it, vi } from 'vitest';
import type { BrowserWindow, IpcMain, IpcMainInvokeEvent } from 'electron';
import { IPC } from '../shared/ipc-channels';
import { createIpcBoundary } from './ipc-boundary';
import { registerApplicationHandlers } from './application-ipc';
import { DesktopOperations } from './desktop-operations';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function setup(limit = 32) {
  const handlers = new Map<string, (event: IpcMainInvokeEvent, value: string) => unknown>();
  const ipc = {
    handle: (name: string, run: (event: IpcMainInvokeEvent, value: string) => unknown) =>
      handlers.set(name, run),
    on: vi.fn(),
  } as unknown as Pick<IpcMain, 'handle' | 'on'>;
  const sender = { mainFrame: {}, isDestroyed: () => false };
  const event = { sender, senderFrame: sender.mainFrame } as unknown as IpcMainInvokeEvent;
  let window = { webContents: sender, isDestroyed: () => false } as unknown as BrowserWindow;
  const operations = new DesktopOperations(limit);
  const openExternal = vi.fn(async (_url: string) => {});
  registerApplicationHandlers(
    createIpcBoundary(ipc, () => window),
    operations,
    {
      openExternal,
      appInfo: vi.fn(),
      versionUpdate: () => null,
    }
  );
  return {
    operations,
    openExternal,
    open: (url = 'https://github.com/o/r') =>
      Promise.resolve(handlers.get(IPC.OPEN_EXTERNAL)!(event, url)),
    replace: () => {
      window = { ...window } as BrowserWindow;
    },
    navigate: () => {
      sender.mainFrame = {};
    },
  };
}

it('joins equivalent native opens, bounds distinct opens, and keeps admission through completion', async () => {
  const host = setup(1);
  const native = deferred();
  host.openExternal.mockImplementation(() => native.promise);
  const first = host.open();
  const second = host.open();
  await Promise.resolve();
  expect(host.openExternal).toHaveBeenCalledOnce();
  await expect(host.open('https://github.com/other')).rejects.toThrow(/already/);
  await expect(host.operations.read(async () => {})).rejects.toThrow(/Too many/);
  let drained = false;
  const drain = host.operations.settleForExit().then(() => {
    drained = true;
  });
  await Promise.resolve();
  expect(drained).toBe(false);
  native.resolve();
  await Promise.all([first, second, drain]);
  await expect(host.operations.read(async () => 'released')).resolves.toBe('released');
});

it('propagates native rejection and permits a later explicit retry', async () => {
  const host = setup();
  const error = new Error('native open failed');
  host.openExternal.mockRejectedValueOnce(error);
  await expect(host.open()).rejects.toBe(error);
  await host.open();
  expect(host.openExternal).toHaveBeenCalledTimes(2);
});

it.each(['peer', 'frame', 'window', 'shutdown', 'finish'] as const)(
  'prevents an admitted but unstarted open after %s changes',
  async cause => {
    const host = setup();
    const opening = host.open();
    const refusal = expect(opening).rejects.toThrow();
    let finishing: Promise<unknown> | undefined;
    if (cause === 'peer') host.replace();
    if (cause === 'frame') host.navigate();
    if (cause === 'window') host.operations.replaceWindow();
    if (cause === 'shutdown') finishing = host.operations.dispose('shutdown');
    if (cause === 'finish') finishing = host.operations.complete(async () => {});
    await refusal;
    await finishing;
    expect(host.openExternal).not.toHaveBeenCalled();
  }
);

it('retains an already started nonabortable open until native settlement during shutdown', async () => {
  const host = setup();
  const native = deferred();
  host.openExternal.mockImplementation(() => native.promise);
  const opening = host.open();
  const rejected = expect(opening).rejects.toThrow('shutdown');
  await Promise.resolve();
  let stopped = false;
  const stop = host.operations.dispose('shutdown').then(() => {
    stopped = true;
  });
  await expect(host.open()).rejects.toThrow('shutdown');
  await Promise.resolve();
  expect(stopped).toBe(false);
  native.resolve();
  await Promise.all([stop, rejected]);
  expect(host.openExternal).toHaveBeenCalledOnce();
});

it('refuses fresh opens at full admission or during completion', async () => {
  const host = setup(1);
  const read = deferred();
  const reading = host.operations.read(() => read.promise);
  await expect(host.open()).rejects.toThrow(/Too many/);
  read.resolve();
  await reading;
  const completion = deferred();
  const finishing = host.operations.complete(() => completion.promise);
  await expect(host.open()).rejects.toThrow(/finishing/);
  expect(host.openExternal).not.toHaveBeenCalled();
  completion.resolve();
  await finishing;
});

it.each([
  'http://github.com/o/r',
  'https://github.com.evil/o/r',
  'https://github.com',
  'file:///a',
  'https://gitlab.com/o/r',
  '',
])('keeps denied URL %s a no-op', async url => {
  const host = setup();
  await host.open(url);
  expect(host.openExternal).not.toHaveBeenCalled();
});
it.each(['https://github.com/', 'https://github.com/o/r?x=1#top', 'https://github.com/a/../b'])(
  'retains allowed URL %s verbatim',
  async url => {
    const host = setup();
    await host.open(url);
    expect(host.openExternal).toHaveBeenCalledWith(url);
  }
);
