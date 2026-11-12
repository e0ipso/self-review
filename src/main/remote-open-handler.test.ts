import { EventEmitter } from 'node:events';
import { afterEach, expect, it, vi } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';
import { DEFAULT_CONFIG } from '../../packages/react/src/config-defaults';
import {
  bootstrapRemoteDiff,
  type RemoteBootstrapResult,
} from '../../packages/core/src/remote-mode';
import { parseForgeUrl } from '../../packages/core/src/forge-provider';
import { loadGuide } from '../../packages/core/src/guide-loader';
import { createDesktopSession } from './desktop-session';
import { DesktopOperations } from './desktop-operations';
import type { createIpcBoundary } from './ipc-boundary';
import { registerRemoteOpenHandler } from './remote-open-handler';
import type { RemoteOpenUrlResult } from '../shared/types';

vi.mock('../../packages/core/src/remote-mode', () => ({ bootstrapRemoteDiff: vi.fn() }));
vi.mock('../../packages/core/src/guide-loader', () => ({ loadGuide: vi.fn() }));
afterEach(() => vi.clearAllMocks());

it.each(['window', 'operation', 'deadline'] as const)(
  'cancels a remote guide with its %s owner and releases the session after guide cleanup',
  async owner => {
    const url = 'https://github.com/owner/repo/pull/1';
    const desktop = createDesktopSession('/launch');
    desktop.review.diffData = { source: { type: 'welcome' }, files: [] };
    desktop.review.config = { ...DEFAULT_CONFIG };
    let expire!: () => void;
    desktop.operations = new DesktopOperations(32, {
      schedule(run) {
        expire = run;
        return () => {};
      },
    });
    const cancelOperation = desktop.operations.replaceWindow();
    const cleanup = vi.fn(async () => {});
    const remote = {
      remoteUrl: url,
      remoteBaseSha: 'b'.repeat(40),
      remoteHeadSha: 'a'.repeat(40),
      remoteForge: 'github' as const,
      threadSyncAvailable: true,
      temporaryClone: false,
    };
    const result: RemoteBootstrapResult = {
      session: {
        forgeUrl: parseForgeUrl(url)!,
        repoPath: '/review',
        gitDiffArgs: ['base...head'],
        mode: 'existing-clone',
        cleanup,
        remote,
        fetchedThreads: [],
        fetchedComments: [],
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
    vi.mocked(bootstrapRemoteDiff).mockResolvedValue(result);
    const send = vi.fn();
    const window = Object.assign(new EventEmitter(), { webContents: { send } });
    let invoke!: (event: IpcMainInvokeEvent, url: string) => Promise<RemoteOpenUrlResult>;
    const boundary = {
      handleCommand(_channel: string, _decode: unknown, handler: typeof invoke) {
        invoke = handler;
      },
      capture: () => () => {},
      assertPeer: () => window,
    } as unknown as ReturnType<typeof createIpcBoundary>;
    let entered!: () => void;
    const started = new Promise<void>(resolve => {
      entered = resolve;
    });
    let finishCleanup!: () => void;
    const cleaned = new Promise<void>(resolve => {
      finishCleanup = resolve;
    });
    let release!: () => void;
    let guideSignal: AbortSignal | undefined;
    vi.mocked(loadGuide).mockImplementation(async (_output, _config, _paths, options) => {
      guideSignal = options?.signal;
      entered();
      return new Promise((resolve, reject) => {
        const abort = () => {
          void cleaned.then(() => reject(guideSignal?.reason));
        };
        guideSignal?.addEventListener('abort', abort, { once: true });
        release = () => {
          guideSignal?.removeEventListener('abort', abort);
          resolve(null);
        };
      });
    });
    registerRemoteOpenHandler(desktop, boundary, { confirmPayload: async () => true });
    let settled = false;
    const opening = invoke({} as IpcMainInvokeEvent, url).then(
      value => {
        settled = true;
        return value;
      },
      error => {
        settled = true;
        return { error: String(error) };
      }
    );
    try {
      await started;
      if (owner === 'window') window.emit('closed');
      else if (owner === 'operation') cancelOperation(new Error('window generation ended'));
      else expire();
      expect(guideSignal?.aborted).toBe(true);
      await Promise.resolve();
      expect(settled).toBe(false);
      expect(cleanup).not.toHaveBeenCalled();
      finishCleanup();
      expect(await opening).not.toEqual({ ok: true });
      expect(cleanup).toHaveBeenCalledOnce();
      expect(desktop.review.diffData.source.type).toBe('welcome');
      expect(desktop.remoteInfo).toBeNull();
      expect(send).not.toHaveBeenCalled();
      expect(window.listenerCount('closed')).toBe(0);
    } finally {
      finishCleanup();
      release?.();
      await opening;
    }
  }
);
