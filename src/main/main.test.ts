import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DesktopOperations } from './desktop-operations';
import { IPC } from '../shared/ipc-channels';

const harness = vi.hoisted(() => ({
  appHandlers: {} as Record<string, (...args: unknown[]) => unknown>,
  signals: {} as Record<string, (...args: unknown[]) => unknown>,
  initialize: vi.fn(),
  createWindow: vi.fn(),
  confirmDiscard: vi.fn(),
  confirmPublished: vi.fn(),
  publish: vi.fn(),
  health: null as import('./renderer-recovery').RendererRecovery | null,
  operations: null as DesktopOperations | null,
  boundary: null as ReturnType<typeof import('./ipc-boundary').createIpcBoundary> | null,
  requestUpdate: vi.fn(),
  presentation: vi.fn(),
  locale: 'ar-EG',
  remote: {
    closed: false,
    dispose: vi.fn(async () => {}),
    settleForExit: vi.fn(async () => {}),
  },
  session: { diffData: null as import('../shared/types').DiffLoadPayload | null },
}));
vi.mock('electron', () => ({
  app: {
    on: vi.fn((name, callback) => {
      harness.appHandlers[name] = callback;
    }),
    whenReady: () => Promise.resolve(),
    getLocale: () => harness.locale,
    getVersion: () => '2.0.4',
    quit: vi.fn(),
    commandLine: { appendSwitch: vi.fn() },
    disableHardwareAcceleration: vi.fn(),
  },
  ipcMain: { handle: vi.fn() },
}));
vi.mock('./desktop-session', () => ({
  createDesktopSession: () => ({
    remote: harness.remote,
    review: harness.session,
    operations: (harness.operations = new DesktopOperations()),
  }),
}));
vi.mock('./desktop-window', () => ({
  createReviewWindow: harness.createWindow,
  observeRendererHealth: (
    _window: unknown,
    health: import('./renderer-recovery').RendererRecovery
  ) => {
    harness.health = health;
  },
}));
vi.mock('./startup', () => ({ initializeSession: harness.initialize }));
vi.mock('./ipc-handlers', () => ({
  registerIpcHandlers: (
    _review: unknown,
    boundary: ReturnType<typeof import('./ipc-boundary').createIpcBoundary>
  ) => {
    harness.boundary = boundary;
  },
}));
vi.mock('./lifecycle-handlers', () => ({ registerLifecycleHandlers: vi.fn() }));
vi.mock('./presentation', () => ({
  createReviewPresentation: harness.presentation,
  createLifecyclePresentation: vi.fn(),
  confirmRendererDiscard: harness.confirmDiscard,
  confirmPublishedClose: harness.confirmPublished,
}));
vi.mock('./publication', () => ({
  createDesktopPublication: () => ({ publish: harness.publish }),
}));
vi.mock('./remote-open-handler', () => ({ registerRemoteOpenHandler: vi.fn() }));
vi.mock('./app-assets', () => ({ getAppIconDataUri: vi.fn() }));
vi.mock('./menu', () => ({ setupMenu: vi.fn() }));
vi.mock('./electron-update-request', () => ({ requestUpdate: harness.requestUpdate }));
import { app } from 'electron';
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}
function window() {
  const listeners: Record<string, Array<() => void>> = {};
  let dead = false;
  return {
    isDestroyed: () => dead,
    isMinimized: () => false,
    focus: vi.fn(),
    restore: vi.fn(),
    on: (name: string, callback: () => void) => {
      (listeners[name] ??= []).push(callback);
    },
    webContents: { mainFrame: {}, send: vi.fn(), isLoading: () => false, isDestroyed: () => false },
    destroy: () => {
      dead = true;
      for (const listener of listeners.closed ?? []) listener();
    },
  };
}
beforeEach(() => {
  vi.resetModules();
  for (const key of Object.keys(harness.appHandlers)) delete harness.appHandlers[key];
  harness.session.diffData = null;
  harness.remote.closed = false;
  harness.health = null;
  harness.confirmDiscard.mockResolvedValue(false);
  harness.confirmPublished.mockResolvedValue(true);
  harness.publish.mockResolvedValue(undefined);
  harness.remote.dispose.mockResolvedValue(undefined);
  harness.remote.settleForExit.mockResolvedValue(undefined);
  harness.initialize.mockResolvedValue(true);
  harness.createWindow.mockImplementation(window);
  harness.locale = 'ar-EG';
  harness.presentation.mockImplementation((_icon, versionUpdate) => ({
    confirmPayload: vi.fn(),
    versionUpdate,
  }));
  harness.requestUpdate.mockImplementation(() => {
    const request = Object.assign(new EventEmitter(), {
      setHeader: vi.fn(),
      abort: vi.fn(() => {
        request.emit('abort');
        request.emit('close');
      }),
      end: vi.fn(),
    });
    return request;
  });
  vi.spyOn(process, 'on').mockImplementation(((
    name: string,
    callback: (...args: unknown[]) => unknown
  ) => {
    harness.signals[name] = callback;
    return process;
  }) as typeof process.on);
  vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
});
afterEach(() => {
  harness.signals.SIGTERM?.();
  vi.unstubAllEnvs();
});
function completeUpdate() {
  const response = Object.assign(new EventEmitter(), { statusCode: 200 });
  const request = harness.requestUpdate.mock.results[0].value;
  request.emit('response', response);
  response.emit(
    'data',
    Buffer.from(
      JSON.stringify({
        tag_name: 'v99.0.0',
        html_url: 'https://github.com/e0ipso/self-review/releases',
      })
    )
  );
  response.emit('end');
  request.emit('close');
}

describe('desktop composition', () => {
  it('retains the remote exit settlement seam in the actual shutdown composition', async () => {
    const cleanup = deferred<void>();
    harness.remote.settleForExit.mockReturnValueOnce(cleanup.promise);
    await import('./main');
    await vi.waitFor(() => expect(harness.createWindow).toHaveBeenCalledOnce());
    const win = harness.createWindow.mock.results[0].value;
    harness.signals.SIGTERM();
    harness.signals.SIGINT();
    try {
      await vi.waitFor(() => expect(win.isDestroyed()).toBe(true));
      expect(harness.remote.settleForExit).toHaveBeenCalledOnce();
      expect(process.exit).not.toHaveBeenCalled();
    } finally {
      cleanup.resolve();
    }
    await vi.waitFor(() => expect(process.exit).toHaveBeenCalledExactlyOnceWith(0));
  });

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
    expect(harness.presentation.mock.results[0].value.versionUpdate()).toBeNull();
    completeUpdate();
    expect(harness.presentation.mock.results[0].value.versionUpdate()).toEqual(update);
    expect(harness.requestUpdate).toHaveBeenCalledOnce();
    await vi.waitFor(() =>
      expect(second.webContents.send).toHaveBeenCalledWith(IPC.VERSION_UPDATE_AVAILABLE, update)
    );
    expect(first.webContents.send).not.toHaveBeenCalled();
  });

  it('drops update delivery to a closed window', async () => {
    await import('./main');
    await vi.waitFor(() => expect(harness.createWindow).toHaveBeenCalledOnce());
    const first = harness.createWindow.mock.results[0].value;
    first.destroy();
    completeUpdate();
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

it('keeps normal close renderer-owned, but native crash recovery can discard without saving', async () => {
  await import('./main');
  await vi.waitFor(() => expect(harness.createWindow).toHaveBeenCalledOnce());
  const win = harness.createWindow.mock.results[0].value;
  harness.session.diffData = { files: [], source: { type: 'directory', sourcePath: '/review' } };
  const event = { preventDefault: vi.fn() };
  harness.appHandlers['before-quit'](event);
  expect(win.webContents.send).toHaveBeenCalledWith(IPC.APP_CLOSE_REQUESTED);
  expect(harness.confirmDiscard).not.toHaveBeenCalled();
  harness.health!.failed('crashed');
  harness.confirmDiscard.mockResolvedValueOnce(true);
  harness.appHandlers['before-quit'](event);
  await vi.waitFor(() => expect(process.exit).toHaveBeenCalledWith(0));
  expect(harness.remote.dispose).toHaveBeenCalledOnce();
});

it('keeps Apply owned during close and returns restored renderers to normal close flow', async () => {
  await import('./main');
  await vi.waitFor(() => expect(harness.createWindow).toHaveBeenCalledOnce());
  const win = harness.createWindow.mock.results[0].value;
  harness.session.diffData = { files: [], source: { type: 'directory', sourcePath: '/review' } };
  const done = deferred<void>();
  const applying = harness.operations!.apply(() => done.promise);
  const event = { preventDefault: vi.fn() };
  harness.appHandlers['before-quit'](event);
  expect(event.preventDefault).toHaveBeenCalled();
  expect(win.webContents.send).toHaveBeenCalledWith(IPC.APP_CLOSE_REQUESTED);
  expect(process.exit).not.toHaveBeenCalled();
  harness.health!.failed('unresponsive');
  harness.appHandlers['before-quit'](event);
  await vi.waitFor(() => expect(harness.confirmDiscard).toHaveBeenCalledOnce());
  harness.health!.restored();
  done.resolve();
  await applying;
  harness.appHandlers['before-quit'](event);
  expect(win.webContents.send).toHaveBeenCalledWith(IPC.APP_CLOSE_REQUESTED);
  expect(process.exit).not.toHaveBeenCalled();
});

it('rejects renderer messages after confirmed failure until restoration', async () => {
  await import('./main');
  await vi.waitFor(() => expect(harness.createWindow).toHaveBeenCalledOnce());
  const sender = harness.createWindow.mock.results[0].value.webContents;
  const event = { sender, senderFrame: sender.mainFrame } as unknown as Electron.IpcMainEvent;
  expect(() => harness.boundary!.assertPeer(event)).not.toThrow();
  harness.health!.failed('crashed');
  expect(() => harness.boundary!.assertPeer(event)).toThrow(/main frame/);
  harness.health!.restored();
  expect(() => harness.boundary!.assertPeer(event)).not.toThrow();
});

it('stops window admission as soon as shutdown is requested', async () => {
  const startup = deferred<boolean>();
  harness.initialize.mockReturnValue(startup.promise);
  await import('./main');
  harness.signals.SIGTERM();
  harness.appHandlers.activate();
  startup.resolve(true);
  await vi.waitFor(() => expect(harness.remote.dispose).toHaveBeenCalledOnce());
  expect(harness.createWindow).not.toHaveBeenCalled();
});

it('cancels work with the originating closed window and permits a new window owner', async () => {
  await import('./main');
  await vi.waitFor(() => expect(harness.createWindow).toHaveBeenCalledOnce());
  const first = harness.createWindow.mock.results[0].value;
  let started!: () => void;
  const ready = new Promise<void>(resolve => {
    started = resolve;
  });
  const applying = harness.operations!.apply(
    signal =>
      new Promise((_, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        started();
      })
  );
  await ready;
  first.destroy();
  await expect(applying).rejects.toThrow('The review window closed.');
  harness.appHandlers.activate();
  expect(harness.createWindow).toHaveBeenCalledTimes(2);
  await expect(harness.operations!.read(async () => 'new window')).resolves.toBe('new window');
});

it('confirms a committed publication natively when its renderer cannot receive the receipt', async () => {
  await import('./main');
  await vi.waitFor(() => expect(harness.createWindow).toHaveBeenCalledOnce());
  const { registerLifecycleHandlers } = await import('./lifecycle-handlers');
  const registration = vi.mocked(registerLifecycleHandlers).mock.calls[0];
  const controller = registration[2];
  const publication = registration[4];
  controller.beginSave();
  await publication.publish(
    { timestamp: 'now', source: { type: 'welcome' }, files: [] },
    new AbortController().signal
  );
  harness.health!.failed('crashed');
  harness.appHandlers['before-quit']({ preventDefault: vi.fn() });
  await vi.waitFor(() => expect(harness.confirmPublished).toHaveBeenCalledOnce());
  await vi.waitFor(() => expect(process.exit).toHaveBeenCalledWith(0));
  expect(harness.confirmDiscard).not.toHaveBeenCalled();
  expect(harness.publish).toHaveBeenCalledOnce();
});

it.each(['es-MX', 'en-GB', 'fr-FR', 'bad_locale'])(
  'binds native presentation and menu to the resolved application locale %s',
  async locale => {
    harness.locale = locale;
    await import('./main');
    await vi.waitFor(() => expect(harness.createWindow).toHaveBeenCalledOnce());
    const { setupMenu } = await import('./menu');
    const native = harness.presentation.mock.calls[0][2];
    expect(vi.mocked(setupMenu)).toHaveBeenCalledWith(native);
    expect(native.t('Cancel')).toBe(locale === 'es-MX' ? 'Cancelar' : 'Cancel');
    expect(native.locale).toBe(locale === 'bad_locale' ? 'en' : locale);
  }
);

it('disposes its owned update service before shutdown and prevents late cache delivery', async () => {
  await import('./main');
  await vi.waitFor(() => expect(harness.createWindow).toHaveBeenCalledOnce());
  const request = harness.requestUpdate.mock.results[0].value;
  const readUpdate = harness.presentation.mock.results[0].value.versionUpdate;
  harness.signals.SIGTERM();
  await vi.waitFor(() => expect(request.abort).toHaveBeenCalledOnce());
  completeUpdate();
  expect(readUpdate()).toBeNull();
  expect(request.eventNames()).toEqual([]);
});
