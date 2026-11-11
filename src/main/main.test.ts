import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IPC } from '../shared/ipc-channels';

const harness = vi.hoisted(() => ({
  appHandlers: {} as Record<string, (...args: unknown[]) => unknown>,
  signals: {} as Record<string, (...args: unknown[]) => unknown>,
  initialize: vi.fn(),
  createWindow: vi.fn(),
  checkUpdate: vi.fn(),
  getUpdate: vi.fn(),
  remote: { closed: false, dispose: vi.fn(async () => {}) },
  session: { diffData: null },
}));
vi.mock('electron', () => ({
  app: {
    on: vi.fn((name, callback) => {
      harness.appHandlers[name] = callback;
    }),
    whenReady: () => Promise.resolve(),
    quit: vi.fn(),
    commandLine: { appendSwitch: vi.fn() },
    disableHardwareAcceleration: vi.fn(),
  },
  ipcMain: {},
}));
vi.mock('./desktop-session', () => ({
  createDesktopSession: () => ({ remote: harness.remote, review: harness.session }),
}));
vi.mock('./desktop-window', () => ({ createReviewWindow: harness.createWindow }));
vi.mock('./startup', () => ({ initializeSession: harness.initialize }));
vi.mock('./ipc-handlers', () => ({ registerIpcHandlers: vi.fn() }));
vi.mock('./lifecycle-handlers', () => ({ registerLifecycleHandlers: vi.fn() }));
vi.mock('./presentation', () => ({ createReviewPresentation: vi.fn() }));
vi.mock('./app-assets', () => ({ getAppIconDataUri: vi.fn() }));
vi.mock('./menu', () => ({ setupMenu: vi.fn() }));
vi.mock('./version-checker', () => ({
  checkForUpdate: harness.checkUpdate,
  getVersionUpdate: harness.getUpdate,
}));
import { app } from 'electron';
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}
function window() {
  const listeners: Record<string, () => void> = {};
  let dead = false;
  return {
    isDestroyed: () => dead,
    isMinimized: () => false,
    focus: vi.fn(),
    restore: vi.fn(),
    on: (name: string, callback: () => void) => {
      listeners[name] = callback;
    },
    webContents: { send: vi.fn() },
    destroy: () => {
      dead = true;
      listeners.closed?.();
    },
  };
}
beforeEach(() => {
  vi.resetModules();
  for (const key of Object.keys(harness.appHandlers)) delete harness.appHandlers[key];
  harness.remote.closed = false;
  harness.remote.dispose.mockResolvedValue(undefined);
  harness.initialize.mockResolvedValue(true);
  harness.createWindow.mockImplementation(window);
  harness.checkUpdate.mockResolvedValue(undefined);
  harness.getUpdate.mockReturnValue(null);
  vi.spyOn(process, 'on').mockImplementation(((
    name: string,
    callback: (...args: unknown[]) => unknown
  ) => {
    harness.signals[name] = callback;
    return process;
  }) as typeof process.on);
  vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
});
afterEach(() => vi.unstubAllEnvs());

describe('desktop composition', () => {
  it('ignores activation until deferred initialization completes and creates one window', async () => {
    const startup = deferred<boolean>();
    harness.initialize.mockReturnValue(startup.promise);
    await import('./main');
    harness.appHandlers.activate();
    expect(harness.createWindow).not.toHaveBeenCalled();
    startup.resolve(true);
    await vi.waitFor(() => expect(harness.createWindow).toHaveBeenCalledOnce());
    harness.appHandlers.activate();
    expect(harness.createWindow).toHaveBeenCalledOnce();
  });

  it.each([':99', ':0'])(
    'keeps sandbox configuration independent of display %s and test environment',
    async display => {
      vi.stubEnv('DISPLAY', display);
      vi.stubEnv('NODE_ENV', 'test');
      await import('./main');
      await vi.waitFor(() => expect(harness.createWindow).toHaveBeenCalledOnce());
      expect(app.commandLine.appendSwitch).not.toHaveBeenCalled();
      expect(app.disableHardwareAcceleration).not.toHaveBeenCalled();
    }
  );

  it('pushes a late update to a replacement live window and leaves cached request support intact', async () => {
    const network = deferred<void>();
    harness.checkUpdate.mockReturnValue(network.promise);
    await import('./main');
    await vi.waitFor(() => expect(harness.createWindow).toHaveBeenCalledOnce());
    const first = harness.createWindow.mock.results[0].value;
    first.destroy();
    harness.appHandlers.activate();
    const second = harness.createWindow.mock.results[1].value;
    const update = {
      latestVersion: '99.0.0',
      releaseUrl: 'https://github.com/e0ipso/self-review/releases',
    };
    harness.getUpdate.mockReturnValue(update);
    network.resolve();
    await vi.waitFor(() =>
      expect(second.webContents.send).toHaveBeenCalledWith(IPC.VERSION_UPDATE_AVAILABLE, update)
    );
    expect(first.webContents.send).not.toHaveBeenCalled();
  });

  it('drops update delivery to a closed window', async () => {
    const network = deferred<void>();
    harness.checkUpdate.mockReturnValue(network.promise);
    await import('./main');
    await vi.waitFor(() => expect(harness.createWindow).toHaveBeenCalledOnce());
    const first = harness.createWindow.mock.results[0].value;
    first.destroy();
    harness.getUpdate.mockReturnValue({
      latestVersion: '99.0.0',
      releaseUrl: 'https://github.com/',
    });
    network.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(first.webContents.send).not.toHaveBeenCalled();
  });

  it('joins repeated signal shutdown and preserves desktop exit zero', async () => {
    const release = deferred<void>();
    harness.remote.dispose.mockReturnValue(release.promise);
    await import('./main');
    harness.signals.SIGTERM();
    harness.signals.SIGINT();
    await vi.waitFor(() => expect(harness.remote.dispose).toHaveBeenCalledOnce());
    expect(process.exit).not.toHaveBeenCalled();
    release.resolve();
    await vi.waitFor(() => expect(process.exit).toHaveBeenCalledWith(0));
  });
});
