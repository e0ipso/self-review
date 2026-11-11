import { EventEmitter } from 'events';
import type { IpcRenderer } from 'electron';
import { it, expect, vi } from 'vitest';
import { createElectronAPI } from './bridge';
import { IPC } from '../shared/ipc-channels';
import type { ElectronAPI } from '../shared/types';

it('provides independent disposable subscriptions for every push channel', async () => {
  const emitter = new EventEmitter();
  const api = createElectronAPI({
    on: emitter.on.bind(emitter),
    removeListener: emitter.removeListener.bind(emitter),
    send: vi.fn(),
    invoke: vi.fn(),
  } as unknown as IpcRenderer);
  const pairs = [
    ['onDiffLoad', IPC.DIFF_LOAD],
    ['onConfigLoad', IPC.CONFIG_LOAD],
    ['onResumeLoad', IPC.RESUME_LOAD],
    ['onGuideLoad', IPC.GUIDE_LOAD],
    ['onCloseRequested', IPC.APP_CLOSE_REQUESTED],
    ['onOutputPathChanged', IPC.OUTPUT_PATH_CHANGED],
    ['onFindResult', IPC.FIND_RESULT],
    ['onVersionUpdate', IPC.VERSION_UPDATE_AVAILABLE],
    ['onShowAbout', IPC.APP_SHOW_ABOUT],
  ] as const;
  for (const [method, channel] of pairs) {
    const first = vi.fn();
    const second = vi.fn();
    const release = api[method](first);
    const releaseSecond = api[method](second);
    const value = { value: channel };
    await new Promise<void>(resolve =>
      queueMicrotask(() => {
        emitter.emit(channel, {}, value);
        resolve();
      })
    );
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
    release();
    release();
    emitter.emit(channel, {}, value);
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledTimes(2);
    releaseSecond();
    expect(emitter.listenerCount(channel)).toBe(0);
  }
});

it('preserves method names, payloads, null file results and final write ownership', async () => {
  const emitter = new EventEmitter();
  const send = vi.fn();
  const invoke = vi.fn(async () => null);
  const api: ElectronAPI = createElectronAPI({
    on: emitter.on.bind(emitter),
    removeListener: emitter.removeListener.bind(emitter),
    send,
    invoke,
  } as unknown as IpcRenderer);
  api.requestDiffData();
  api.requestResumeData();
  api.requestConfig();
  expect(send.mock.calls).toEqual([[IPC.DIFF_REQUEST], [IPC.RESUME_REQUEST], [IPC.CONFIG_REQUEST]]);
  expect(await api.loadFileContent('missing.ts')).toBeNull();
  expect(invoke).toHaveBeenCalledWith(IPC.DIFF_LOAD_FILE, 'missing.ts');
  const suggestion = {
    filePath: 'a.ts',
    lineRange: { side: 'new' as const, start: 1, end: 1 },
    suggestion: { originalCode: 'before', proposedCode: 'after' },
  };
  let finish!: (value: unknown) => void;
  invoke.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve as (value: unknown) => void;
      })
  );
  const applying = api.applySuggestion(suggestion);
  const outcome = { status: 'applied', filePath: 'a.ts', replacedLines: 1 };
  finish(outcome);
  expect(await applying).toBe(outcome);
  expect(invoke).toHaveBeenLastCalledWith(IPC.SUGGESTION_APPLY, suggestion);
});
