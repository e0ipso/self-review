// @vitest-environment jsdom
import React from 'react';
import { renderHook, cleanup } from '@testing-library/react';
import { EventEmitter } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { BrowserWindow, IpcMain, IpcRenderer } from 'electron';
import { afterEach, expect, it, vi } from 'vitest';
import { createDesktopSession } from './desktop-session';
import { createIpcBoundary } from './ipc-boundary';
import { registerIpcHandlers } from './ipc-handlers';
import { registerRemoteOpenHandler } from './remote-open-handler';
import { createElectronAPI } from '../preload/bridge';
import { createElectronAdapter } from '../renderer/electron-adapter';
import { IPC } from '../shared/ipc-channels';
import { DEFAULT_CONFIG } from '../../packages/react/src/config-defaults';
import { bindDesktopReviewOperations } from './review-operations';
import { MAX_CONTENT_TEXT_BYTES } from './content-budget';
import { loadGuide } from '../../packages/core/src/guide-loader';
import type { ReviewAdapter } from '../../packages/react/src/adapter';
import {
  createReviewSession,
  createReviewSessionStore,
} from '../../packages/react/src/context/review-session';
import { createReviewSessionController } from '../../packages/react/src/context/review-session-controller';
import { SessionStoreContext } from '../../packages/react/src/context/review-context';
import { useReviewSaveTransaction } from '../../packages/react/src/context/ReviewContext';
import {
  bootstrapRemoteDiff,
  type RemoteBootstrapResult,
} from '../../packages/core/src/remote-mode';
import { parseForgeUrl } from '../../packages/core/src/forge-provider';

vi.mock('../../packages/core/src/remote-mode', () => ({ bootstrapRemoteDiff: vi.fn() }));
vi.mock('../../packages/core/src/guide-loader', () => ({ loadGuide: vi.fn(async () => null) }));
const url = 'https://github.com/owner/repo/pull/1';
const flush = async () => {
  for (let i = 0; i < 24; i++) await Promise.resolve();
};
afterEach(() => cleanup());

function fixture(reads: Partial<Pick<ReviewAdapter, 'loadDiff' | 'loadResumedReview'>> = {}) {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const renderer = new EventEmitter();
  const frame = {};
  const sender = Object.assign(new EventEmitter(), {
    mainFrame: frame,
    isDestroyed: () => false,
    send: vi.fn((channel: string, ...args: unknown[]) => renderer.emit(channel, {}, ...args)),
  });
  let window = Object.assign(new EventEmitter(), {
    webContents: sender,
    isDestroyed: () => false,
  }) as unknown as BrowserWindow;
  const event = { sender, senderFrame: frame };
  const desktop = createDesktopSession('/launch');
  desktop.review.diffData = { source: { type: 'welcome' }, files: [] };
  desktop.review.config = { ...DEFAULT_CONFIG, ignore: [] };
  const register = (channel: string, callback: (...args: unknown[]) => unknown) =>
    handlers.set(channel, callback);
  const boundary = createIpcBoundary(
    { on: register, handle: register } as unknown as IpcMain,
    () => window
  );
  const presentation = {
    pickDirectory: vi.fn(async () => null as string | null),
    confirmPayload: vi.fn(async () => true),
    appInfo: vi.fn(),
    versionUpdate: vi.fn(),
    openExternal: vi.fn(),
  };
  const review = bindDesktopReviewOperations(desktop.review);
  registerIpcHandlers(
    desktop.review,
    boundary,
    desktop.transition,
    presentation,
    desktop.operations,
    review
  );
  registerRemoteOpenHandler(desktop, boundary, presentation);
  const invoke = async (channel: string, ...args: unknown[]) =>
    handlers.get(channel)!(event, ...args);
  const api = createElectronAPI({
    on: renderer.on.bind(renderer),
    removeListener: renderer.removeListener.bind(renderer),
    invoke,
    send: (channel: string, ...args: unknown[]) => handlers.get(channel)!(event, ...args),
  } as unknown as IpcRenderer);
  const bridge = createElectronAdapter(api);
  const store = createReviewSessionStore(createReviewSession());
  const controller = createReviewSessionController(store, { ...bridge.adapter, ...reads });
  const deactivate = controller.activate();
  const disconnect = controller.connect();
  const hook = renderHook(() => useReviewSaveTransaction(), {
    wrapper: ({ children }) =>
      React.createElement(SessionStoreContext.Provider, { value: store }, children),
  });
  return {
    desktop,
    review,
    store,
    sender,
    presentation,
    invoke,
    save: () => hook.result.current.begin(),
    replacePeer: () => {
      window = null as unknown as BrowserWindow;
    },
    async close() {
      disconnect();
      deactivate();
      bridge.dispose();
      hook.unmount();
      await desktop.operations.dispose('test finished');
      await desktop.remote.dispose('test finished');
    },
  };
}
function remoteResult(populated: boolean): RemoteBootstrapResult {
  const remote = {
    remoteUrl: url,
    remoteBaseSha: 'b'.repeat(40),
    remoteHeadSha: 'a'.repeat(40),
    remoteForge: 'github' as const,
    threadSyncAvailable: true,
    temporaryClone: false,
  };
  return {
    session: {
      forgeUrl: parseForgeUrl(url)!,
      repoPath: '/review',
      gitDiffArgs: ['base...head'],
      mode: 'existing-clone',
      cleanup: vi.fn(async () => {}),
      remote,
      fetchedThreads: [],
      fetchedComments: populated
        ? [
            {
              id: 'remote',
              filePath: '',
              lineRange: null,
              body: 'remote feedback',
              category: 'note',
              suggestion: null,
            },
          ]
        : [],
    },
    payload: {
      source: { type: 'git', repository: '/review', gitDiffArgs: 'base...head' },
      files: [],
      remote,
    },
    identity: {
      mode: 'remote',
      sourceRoot: '/review',
      invocationCwd: '/launch',
      gitDiffArgv: ['base...head'],
      pathPrefix: '',
      oldSide: { kind: 'commit', sha: remote.remoteBaseSha },
      newSide: { kind: 'commit', sha: remote.remoteHeadSha },
    },
  };
}
it.each(['directory', 'empty remote', 'populated remote'] as const)(
  'makes %s save-ready after the welcome resume has already settled',
  async mode => {
    const f = fixture();
    const root = await mkdtemp(join(tmpdir(), 'replacement-ready-'));
    try {
      await flush();
      expect(f.store.getSnapshot().resumePending).toBe(false);
      expect(() => f.save()).toThrow(/not finished loading/);
      f.sender.send.mockClear();
      if (mode === 'directory') {
        f.presentation.pickDirectory.mockResolvedValue(root);
        await f.invoke(IPC.DIALOG_PICK_DIRECTORY);
        await f.invoke(IPC.REVIEW_START_DIRECTORY, root);
      } else {
        vi.mocked(bootstrapRemoteDiff).mockResolvedValue(remoteResult(mode === 'populated remote'));
        expect(await f.invoke(IPC.REMOTE_OPEN_URL, url)).toEqual({ ok: true });
      }
      await flush();
      expect(f.store.getSnapshot().resumePending).toBe(false);
      const saved = f.save();
      expect(saved.current()).toBe(true);
      expect(saved.state.files.flatMap(file => file.comments).map(comment => comment.body)).toEqual(
        mode === 'populated remote' ? ['remote feedback'] : []
      );
      saved.unlock();
      expect(f.sender.send.mock.calls.map(([channel]) => channel)).toEqual([
        IPC.DIFF_LOAD,
        IPC.RESUME_LOAD,
      ]);
    } finally {
      await f.close();
      await rm(root, { recursive: true, force: true });
    }
  }
);

it.each(['diff', 'guide', 'resume'] as const)(
  'refuses an oversized replacement remote %s before adoption or a successful handshake',
  async piece => {
    const f = fixture();
    try {
      await flush();
      const previous = f.desktop.review.diffData;
      const comments = f.desktop.review.resumeComments;
      const incoming = remoteResult(true);
      const huge = 'x'.repeat(MAX_CONTENT_TEXT_BYTES / 2 + 1);
      if (piece === 'diff') incoming.payload.diagnostics = [huge];
      if (piece === 'guide')
        vi.mocked(loadGuide).mockResolvedValueOnce({ overview: huge, groups: [] });
      if (piece === 'resume') incoming.session.fetchedComments[0].body = huge;
      vi.mocked(bootstrapRemoteDiff).mockResolvedValue(incoming);
      f.sender.send.mockClear();
      expect(await f.invoke(IPC.REMOTE_OPEN_URL, url)).toEqual({
        ok: false,
        error: 'Review content exceeds desktop delivery limits.',
      });
      expect(f.desktop.review.diffData).toBe(previous);
      expect(f.desktop.review.resumeComments).toBe(comments);
      expect(f.desktop.remoteInfo).toBeNull();
      expect(incoming.session.cleanup).toHaveBeenCalledOnce();
      expect(f.sender.send).not.toHaveBeenCalled();
      expect(() => f.save()).toThrow(/not finished loading/);
    } finally {
      await f.close();
    }
  }
);

it('refuses oversized directory metadata before adopting its real load capture', async () => {
  const f = fixture();
  const root = await mkdtemp(join(tmpdir(), 'replacement-budget-'));
  try {
    await flush();
    const previous = f.desktop.review.diffData;
    const capture = f.desktop.review.loadedReview;
    f.presentation.pickDirectory.mockResolvedValue(root);
    await f.invoke(IPC.DIALOG_PICK_DIRECTORY);
    const incoming = await f.review.prepareDirectoryReview(root);
    incoming.payload.diagnostics = ['x'.repeat(MAX_CONTENT_TEXT_BYTES / 2 + 1)];
    vi.spyOn(f.review, 'prepareDirectoryReview').mockResolvedValueOnce(incoming);
    f.sender.send.mockClear();
    await expect(f.invoke(IPC.REVIEW_START_DIRECTORY, root)).rejects.toThrow(/delivery limits/);
    expect(f.desktop.review.diffData).toBe(previous);
    expect(f.desktop.review.loadedReview).toBe(capture);
    expect(f.sender.send).not.toHaveBeenCalled();
  } finally {
    await f.close();
    await rm(root, { recursive: true, force: true });
  }
});

it.each(['diff', 'resume'] as const)(
  'drops the late initial %s pull after replacement readiness',
  async kind => {
    let resolve!: (value: never) => void;
    const late = new Promise<never>(done => {
      resolve = done;
    });
    const f = fixture(
      kind === 'diff' ? { loadDiff: () => late } : { loadResumedReview: () => late }
    );
    try {
      await flush();
      const welcome = f.desktop.review.diffData!;
      vi.mocked(bootstrapRemoteDiff).mockResolvedValue(remoteResult(false));
      expect(await f.invoke(IPC.REMOTE_OPEN_URL, url)).toEqual({ ok: true });
      const before = f.save();
      before.unlock();
      resolve(
        (kind === 'diff'
          ? welcome
          : {
              comments: [
                {
                  id: 'old',
                  filePath: '',
                  body: 'stale',
                  category: 'note',
                  lineRange: null,
                  suggestion: null,
                },
              ],
              viewedFiles: [],
            }) as never
      );
      await flush();
      const after = f.save();
      expect(after.state.source).toBe(f.desktop.review.diffData!.source);
      expect(after.state.files.flatMap(file => file.comments)).toEqual([]);
      after.unlock();
    } finally {
      await f.close();
    }
  }
);

it('a stale remote registrar continuation cannot clean the newer remote owner', async () => {
  const f = fixture();
  const old = remoteResult(false);
  const newer = remoteResult(false);
  try {
    await flush();
    vi.mocked(bootstrapRemoteDiff).mockResolvedValue(old);
    vi.mocked(loadGuide).mockImplementationOnce(async () => {
      await f.desktop.remote.cancelOpen();
      await f.desktop.remote.open(async () => newer);
      f.replacePeer();
      return null;
    });
    f.sender.send.mockClear();
    expect(await f.invoke(IPC.REMOTE_OPEN_URL, url)).toMatchObject({ ok: false });
    expect(old.session.cleanup).toHaveBeenCalledOnce();
    expect(newer.session.cleanup).not.toHaveBeenCalled();
    expect(f.desktop.review.diffData!.source.type).toBe('welcome');
    expect(f.sender.send).not.toHaveBeenCalled();
  } finally {
    await f.close();
  }
  expect(newer.session.cleanup).toHaveBeenCalledOnce();
});
