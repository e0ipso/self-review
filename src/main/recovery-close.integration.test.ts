import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { IPC } from '../shared/ipc-channels';
import type { ReviewState, ReviewSaveResult } from '../shared/types';

const effects = vi.hoisted(() => ({
  commands: {} as Record<string, (...args: unknown[]) => unknown>,
  appEvents: {} as Record<string, (...args: unknown[]) => unknown>,
  createWindow: vi.fn(),
  publish: vi.fn(),
  remote: { closed: false, dispose: vi.fn(async () => {}), settleForExit: vi.fn(async () => {}) },
}));
vi.mock('electron', () => ({
  app: {
    on: (event: string, run: (...args: unknown[]) => unknown) => {
      effects.appEvents[event] = run;
    },
    whenReady: () => Promise.resolve(),
    getLocale: () => 'en',
    getVersion: () => '2.0.4',
    quit: vi.fn(),
  },
  ipcMain: {
    on: (channel: string, run: (...args: unknown[]) => unknown) => {
      effects.commands[channel] = run;
    },
    handle: (channel: string, run: (...args: unknown[]) => unknown) => {
      effects.commands[channel] = run;
    },
  },
}));
vi.mock('./desktop-session', async original => {
  const actual = await original<typeof import('./desktop-session')>();
  return {
    ...actual,
    createDesktopSession: (cwd: string) => ({
      ...actual.createDesktopSession(cwd),
      remote: effects.remote,
    }),
  };
});
vi.mock('./startup-policy', () => ({
  initializeSuppliedSession: async (desktop: import('./desktop-session').DesktopSession) => {
    desktop.review.diffData = { files: [], source: { type: 'directory', sourcePath: '/review' } };
    return true;
  },
}));
vi.mock('./desktop-window', () => ({
  createReviewWindow: effects.createWindow,
  observeRendererHealth: vi.fn(),
}));
vi.mock('./publication', async original => ({
  ...(await original<typeof import('./publication')>()),
  createDesktopPublication: () => ({ publish: effects.publish }),
}));
vi.mock('./presentation', () => ({
  createReviewPresentation: () => ({}),
  createLifecyclePresentation: () => ({
    reportSaveFailure: vi.fn(async () => {}),
    pickOutputPath: vi.fn(),
  }),
  confirmRendererDiscard: vi.fn(),
  confirmPublishedClose: vi.fn(),
}));
vi.mock('./ipc-handlers', () => ({ registerIpcHandlers: vi.fn() }));
vi.mock('./remote-open-handler', () => ({ registerRemoteOpenHandler: vi.fn() }));
vi.mock('./app-assets', () => ({ getAppIconDataUri: vi.fn() }));
vi.mock('./menu', () => ({ setupMenu: vi.fn() }));
vi.mock('./update-service', () => ({
  UpdateService: class {
    getVersionUpdate = () => null;
    checkForUpdate = async () => {};
    dispose = () => {};
  },
}));
vi.mock('./electron-update-request', () => ({ requestUpdate: vi.fn() }));

const state: ReviewState = {
  timestamp: 'now',
  source: { type: 'directory', sourcePath: '/review' },
  files: [],
};
const releases: (() => void)[] = [];
beforeEach(() => {
  vi.resetModules();
  for (const key of Object.keys(effects.commands)) delete effects.commands[key];
  for (const key of Object.keys(effects.appEvents)) delete effects.appEvents[key];
  effects.remote.dispose.mockResolvedValue(undefined);
  effects.remote.settleForExit.mockResolvedValue(undefined);
  effects.publish.mockResolvedValue(undefined);
  effects.createWindow.mockImplementation(() => {
    let destroyed = false;
    const events: Record<string, (() => void)[]> = {};
    return {
      isDestroyed: () => destroyed,
      isMinimized: () => false,
      focus: vi.fn(),
      on: (event: string, run: () => void) => {
        (events[event] ??= []).push(run);
      },
      destroy: vi.fn(() => {
        destroyed = true;
        events.closed?.forEach(run => run());
      }),
      webContents: {
        mainFrame: {},
        isDestroyed: () => false,
        isLoading: () => false,
        send: vi.fn(),
      },
    };
  });
  vi.spyOn(process, 'on').mockReturnValue(process);
  vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
});
afterEach(() => {
  releases.splice(0).forEach(release => release());
});

it.each(['pending', 'committed', 'failed'] as const)(
  'the actual main composition closes the native window after %s recovery, joining cleanup before exit',
  async outcome => {
    let settle!: () => void;
    const publication = new Promise<void>((resolve, reject) => {
      settle = () => (outcome === 'failed' ? reject(new Error('disk full')) : resolve());
    });
    releases.push(settle);
    let cleanup!: () => void;
    const cleanupPending = new Promise<void>(resolve => {
      cleanup = resolve;
    });
    releases.push(cleanup);
    effects.remote.settleForExit.mockReturnValueOnce(cleanupPending);
    effects.publish.mockReturnValueOnce(publication);
    await import('./main');
    await vi.waitFor(() => expect(effects.createWindow).toHaveBeenCalledOnce());
    const window = effects.createWindow.mock.results[0].value;
    const peer = { sender: window.webContents, senderFrame: window.webContents.mainFrame };
    const saving = effects.commands[IPC.REVIEW_SAVE](peer, state) as Promise<ReviewSaveResult>;
    await vi.waitFor(() => expect(effects.publish).toHaveBeenCalledOnce());
    if (outcome === 'committed') {
      settle();
      await saving;
    }
    const close = { preventDefault: vi.fn() };
    effects.appEvents['before-quit'](close);
    expect(close.preventDefault).toHaveBeenCalledOnce();
    effects.commands[IPC.APP_DISCARD_AND_QUIT](peer);
    if (outcome !== 'committed') {
      expect(window.destroy).not.toHaveBeenCalled();
      settle();
      await saving;
    }
    await vi.waitFor(() => expect(window.destroy).toHaveBeenCalledOnce());
    expect(effects.publish).toHaveBeenCalledOnce();
    expect(process.exit).not.toHaveBeenCalled();
    cleanup();
    await vi.waitFor(() => expect(process.exit).toHaveBeenCalledExactlyOnceWith(0));
  }
);
