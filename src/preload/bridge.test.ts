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

it('keeps publication receipt and handoff separate from the legacy event methods', async () => {
  const emitter = new EventEmitter();
  const send = vi.fn();
  const invoke = vi.fn(async () => ({ status: 'saved', receipt: 'receipt' }));
  const api = createElectronAPI({
    on: emitter.on.bind(emitter),
    removeListener: emitter.removeListener.bind(emitter),
    send,
    invoke,
  } as unknown as IpcRenderer);
  const state = { timestamp: 'now', source: { type: 'welcome' as const }, files: [] };
  api.submitReview(state);
  api.saveAndQuit();
  expect(send.mock.calls).toEqual([[IPC.REVIEW_SUBMIT, state], [IPC.APP_SAVE_AND_QUIT]]);
  await api.handoffReview!(state);
  const saved = await api.saveReview!(state);
  expect(invoke.mock.calls).toEqual([
    [IPC.REVIEW_HANDOFF, state],
    [IPC.REVIEW_SAVE, state],
  ]);
  expect(send).toHaveBeenCalledTimes(2);
  if (saved.status !== 'saved') throw new Error('expected receipt');
  api.acknowledgeReviewSave!(saved.receipt);
  expect(send).toHaveBeenLastCalledWith(IPC.REVIEW_SAVE_RECEIVED, 'receipt');
});

// Frozen from the original bridge, independently of the production binding catalog.
const originalBindings = [
  ['readContent', 'invoke', 'content:read'],
  ['cancelContentRead', 'send', 'content:cancel'],
  ['onContentRefused', 'subscribe', 'content:refused'],
  ['requestDiffData', 'send', 'diff:request'],
  ['onDiffLoad', 'subscribe', 'diff:load'],
  ['requestConfig', 'send', 'config:request'],
  ['onConfigLoad', 'subscribe', 'config:load'],
  ['requestResumeData', 'send', 'resume:request'],
  ['onResumeLoad', 'subscribe', 'resume:load'],
  ['onGuideLoad', 'subscribe', 'guide:load'],
  ['submitReview', 'send', 'review:submit'],
  ['onCloseRequested', 'subscribe', 'app:close-requested'],
  ['saveAndQuit', 'send', 'app:save-and-quit'],
  ['handoffReview', 'invoke', 'review:handoff'],
  ['saveReview', 'invoke', 'review:save'],
  ['getSaveResult', 'invoke', 'review:save-status'],
  ['acknowledgeReviewSave', 'send', 'review:save-received'],
  ['onSaveFailed', 'subscribe', 'review:save-failed'],
  ['getApplicationLocale', 'invoke', 'app:locale'],
  ['readAttachment', 'invoke', 'attachment:read'],
  ['discardAndQuit', 'send', 'app:discard-and-quit'],
  ['pickDirectory', 'invoke', 'dialog:pick-directory'],
  ['startDirectoryReview', 'invoke', 'review:start-directory'],
  ['expandContext', 'invoke', 'diff:expand-context'],
  ['changeOutputPath', 'invoke', 'output-path:change'],
  ['onOutputPathChanged', 'subscribe', 'output-path:changed'],
  ['findInPage', 'send', 'find:in-page'],
  ['stopFindInPage', 'send', 'find:stop'],
  ['onFindResult', 'subscribe', 'find:result'],
  ['requestVersionUpdate', 'send', 'version-update:request'],
  ['onVersionUpdate', 'subscribe', 'version-update:available'],
  ['openExternal', 'invoke', 'open-external'],
  ['loadFileContent', 'invoke', 'diff:load-file'],
  ['loadImage', 'invoke', 'diff:load-image'],
  ['openRemoteUrl', 'invoke', 'remote:open-url'],
  ['applySuggestion', 'invoke', 'suggestion:apply'],
  ['chooseApplyDestination', 'invoke', 'suggestion:choose-destination'],
  ['onShowAbout', 'subscribe', 'app:show-about'],
  ['getAppInfo', 'invoke', 'app:get-info'],
] as const;

function transportFixture() {
  const emitter = new EventEmitter();
  const send = vi.fn();
  const invoke = vi.fn<(...args: unknown[]) => Promise<unknown>>();
  const removeListener = vi.fn(emitter.removeListener.bind(emitter));
  const api = createElectronAPI({
    on: emitter.on.bind(emitter),
    removeListener,
    send,
    invoke,
  } as unknown as IpcRenderer);
  return { api, emitter, send, invoke, removeListener };
}

it('exposes exactly the original flat method set', () => {
  const { api } = transportFixture();
  expect(Object.keys(api).sort()).toEqual(originalBindings.map(([method]) => method).sort());
  for (const method of Object.values(api)) expect(typeof method).toBe('function');
});

const originalArguments: Partial<{
  [Method in keyof ElectronAPI]: Parameters<NonNullable<ElectronAPI[Method]>>;
}> = {
  readContent: [{ id: '1', kind: 'file', filePath: 'src/a.ts' }],
  cancelContentRead: ['1'],
  submitReview: [{ timestamp: 'now', source: { type: 'welcome' }, files: [] }],
  handoffReview: [{ timestamp: 'now', source: { type: 'welcome' }, files: [] }],
  saveReview: [{ timestamp: 'now', source: { type: 'welcome' }, files: [] }],
  acknowledgeReviewSave: ['receipt-1'],
  readAttachment: ['.self-review-assets/image.png'],
  startDirectoryReview: ['/review/source'],
  expandContext: [{ filePath: 'src/a.ts', contextLines: 20 }],
  findInPage: [{ text: 'word', forward: true, findNext: false }],
  stopFindInPage: ['keepSelection'],
  openExternal: ['https://example.com/'],
  loadFileContent: ['src/a.ts'],
  loadImage: ['image.png'],
  openRemoteUrl: ['https://github.com/owner/repo/pull/1'],
  applySuggestion: [
    {
      filePath: 'src/a.ts',
      lineRange: { side: 'new', start: 1, end: 1 },
      suggestion: { originalCode: 'before', proposedCode: 'after' },
    },
  ],
};

for (const [method, mode, channel] of originalBindings) {
  if (mode === 'subscribe') {
    it(`${method} strips only the event and disposes independent listeners`, async () => {
      const { api, emitter, removeListener, send, invoke } = transportFixture();
      const subscribe = api[method]! as (callback: (...args: unknown[]) => void) => () => void;
      const callback = vi.fn();
      const event = { sender: 'must never reach the callback' };
      const config = { theme: 'dark' };
      const outputPath = { path: '/review.xml' };
      const extra = { unchanged: true };
      const first = subscribe(callback);
      const second = subscribe(callback);
      expect(first).not.toBe(second);
      for (const args of [
        [],
        [config],
        [config, outputPath],
        [config, outputPath, undefined, extra],
      ]) {
        callback.mockClear();
        await new Promise<void>(resolve =>
          queueMicrotask(() => {
            emitter.emit(channel, event, ...args);
            resolve();
          })
        );
        expect(callback.mock.calls).toEqual([args, args]);
        for (const call of callback.mock.calls) {
          call.forEach((arg, index) => expect(arg).toBe(args[index]));
          expect(call).not.toContain(event);
        }
      }
      callback.mockClear();
      first();
      first();
      emitter.emit(channel, event, config, outputPath);
      expect(callback.mock.calls).toEqual([[config, outputPath]]);
      second();
      second();
      emitter.emit(channel, event, config);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(emitter.listenerCount(channel)).toBe(0);
      expect(removeListener).toHaveBeenCalledTimes(2);
      expect(send).not.toHaveBeenCalled();
      expect(invoke).not.toHaveBeenCalled();
    });
  } else if (mode === 'send') {
    it(`${method} sends the original argv once and returns void`, () => {
      const { api, send, invoke, emitter } = transportFixture();
      const call = api[method]! as (...args: unknown[]) => unknown;
      const args = originalArguments[method] ?? [];
      expect(call(...args)).toBeUndefined();
      expect(send.mock.calls).toEqual([[channel, ...args]]);
      args.forEach((arg, index) => expect(send.mock.calls[0][index + 1]).toBe(arg));
      expect(invoke).not.toHaveBeenCalled();
      expect(emitter.eventNames()).toEqual([]);
    });
  } else {
    it(`${method} preserves invoke argv, promises, results and asynchronous failures`, async () => {
      const { api, send, invoke, emitter } = transportFixture();
      const call = api[method]! as (...args: unknown[]) => Promise<unknown>;
      const args = originalArguments[method] ?? [];
      const receipt = { status: 'saved', receipt: 'receipt-1' };
      const failure = new Error('main refused the operation');
      for (const value of [receipt, null, undefined, new ArrayBuffer(8)]) {
        const pending = new Promise(resolve => queueMicrotask(() => resolve(value)));
        invoke.mockReturnValueOnce(pending);
        const result = call(...args);
        expect(result).toBe(pending);
        expect(await result).toBe(value);
        expect(invoke).toHaveBeenLastCalledWith(channel, ...args);
        args.forEach((arg, index) => expect(invoke.mock.lastCall![index + 1]).toBe(arg));
      }
      const rejected = new Promise((_, reject) => queueMicrotask(() => reject(failure)));
      invoke.mockReturnValueOnce(rejected);
      const result = call(...args);
      expect(result).toBe(rejected);
      await expect(result).rejects.toBe(failure);
      expect(invoke).toHaveBeenCalledTimes(5);
      expect(send).not.toHaveBeenCalled();
      expect(emitter.eventNames()).toEqual([]);
    });
  }
}
