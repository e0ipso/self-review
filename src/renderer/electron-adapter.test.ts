import { afterEach, it, expect, vi } from 'vitest';
import type { DiffLoadPayload, ResumeLoadPayload } from '../shared/types';
import { createElectronAdapter } from './electron-adapter';
import { ElectronRequests } from './electron-requests';

function fixture() {
  const diffs = new Set<(payload: DiffLoadPayload) => void>();
  const resumes = new Set<(payload: ResumeLoadPayload) => void>();
  const subscribe =
    <T>(listeners: Set<(value: T) => void>) =>
    (callback: (value: T) => void) => {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    };
  const api = {
    onDiffLoad: subscribe(diffs),
    onResumeLoad: subscribe(resumes),
    requestDiffData: vi.fn(),
    requestResumeData: vi.fn(),
    submitReview: vi.fn(),
    expandContext: vi.fn(),
    loadFileContent: vi.fn(),
    readAttachment: vi.fn(),
    changeOutputPath: vi.fn(),
    loadImage: vi.fn(),
    applySuggestion: vi.fn(),
    chooseApplyDestination: vi.fn(),
    onGuideLoad: vi.fn(() => () => {}),
  };
  const bridge = createElectronAdapter(api, new ElectronRequests(100, 3));
  return {
    api,
    bridge,
    diffs,
    resumes,
    diff: async (value: DiffLoadPayload) => {
      await Promise.resolve();
      for (const callback of diffs) callback(value);
    },
    resume: async (value: ResumeLoadPayload) => {
      await Promise.resolve();
      for (const callback of resumes) callback(value);
    },
  };
}
afterEach(() => vi.useRealTimers());

it('keeps old ElectronAPI reads usable and makes pre-aborted optional reads transport-free', async () => {
  const f = fixture();
  const abort = new AbortController();
  abort.abort();
  await expect(f.bridge.adapter.reads!.loadFileContent!('old.ts', abort.signal)).rejects.toThrow(
    /cancelled/
  );
  expect(f.api.loadFileContent).not.toHaveBeenCalled();
  f.api.loadFileContent.mockResolvedValue([]);
  await expect(
    f.bridge.adapter.reads!.loadFileContent!('old.ts', new AbortController().signal)
  ).resolves.toEqual([]);
  f.api.expandContext.mockResolvedValue({ hunks: [], totalLines: 1 });
  await expect(
    f.bridge.adapter.reads!.expandContext!(
      { filePath: 'old.ts', contextLines: 1 },
      new AbortController().signal
    )
  ).resolves.toEqual({ hunks: [], totalLines: 1 });
  f.api.readAttachment.mockResolvedValue(new ArrayBuffer(1));
  await expect(
    f.bridge.adapter.reads!.readAttachment!('old.png', new AbortController().signal)
  ).resolves.toHaveProperty('byteLength', 1);
  f.bridge.dispose();
});

it('settles initial requests and distinguishes resume acknowledgements from later pushes', async () => {
  const f = fixture();
  const push = vi.fn();
  f.bridge.adapter.onResumeLoad!(push);
  const initial = f.bridge.adapter.loadResumedReview!();
  const empty = { comments: [], viewedFiles: [] };
  await f.resume(empty);
  expect(await initial).toBe(empty);
  expect(push).not.toHaveBeenCalled();
  const later = { ...empty, viewedFiles: ['later.ts'] };
  await f.diff({ source: { type: 'directory', sourcePath: '/later' }, files: [] });
  await f.resume(later);
  expect(push).toHaveBeenCalledExactlyOnceWith(later);
  const loading = f.bridge.adapter.loadDiff();
  const payload: DiffLoadPayload = { files: [], source: { type: 'welcome' } };
  await f.diff(payload);
  expect(await loading).toBe(payload);
  expect(f.diffs.size).toBe(0);
  f.bridge.dispose();
  expect(f.resumes.size).toBe(0);
});

it('rejects every pending initial/read request on disposal and drops late pushes', async () => {
  const f = fixture();
  f.api.loadImage.mockReturnValue(new Promise(() => {}));
  const pending = [
    f.bridge.adapter.loadDiff(),
    f.bridge.adapter.loadResumedReview!(),
    f.bridge.adapter.loadImage!('a.png'),
  ];
  const results = Promise.allSettled(pending);
  const push = vi.fn();
  f.bridge.adapter.onDiffLoad!(push);
  f.bridge.dispose();
  f.bridge.dispose();
  expect(
    (await results).every(
      value => value.status === 'rejected' && /disposed/.test(String(value.reason))
    )
  ).toBe(true);
  await f.diff({ files: [], source: { type: 'welcome' } });
  expect(push).not.toHaveBeenCalled();
  expect(f.diffs.size + f.resumes.size).toBe(0);
  await expect(f.bridge.adapter.loadDiff()).rejects.toThrow(/disposed/);
});

it('bounds read deadlines and admission, removes listeners, and never times out or replays Apply', async () => {
  vi.useFakeTimers();
  const f = fixture();
  f.api.loadImage.mockReturnValue(new Promise(() => {}));
  const pending = [
    f.bridge.adapter.loadDiff(),
    f.bridge.adapter.loadResumedReview!(),
    f.bridge.adapter.loadImage!('a.png'),
  ];
  const results = Promise.allSettled(pending);
  await expect(f.bridge.adapter.readAttachment!('x')).rejects.toThrow(/Too many/);
  await vi.advanceTimersByTimeAsync(101);
  expect(
    (await results).every(
      value => value.status === 'rejected' && /timed out/.test(String(value.reason))
    )
  ).toBe(true);
  expect(f.diffs.size).toBe(0);
  let finish!: (value: { status: 'applied'; filePath: string; replacedLines: number }) => void;
  f.api.applySuggestion.mockReturnValue(
    new Promise(resolve => {
      finish = resolve;
    })
  );
  const request = {
    filePath: 'a.ts',
    lineRange: null,
    suggestion: { originalCode: '', proposedCode: '' },
  };
  const applied = f.bridge.adapter.applySuggestion!(request);
  await vi.advanceTimersByTimeAsync(10_000);
  finish({ status: 'applied', filePath: 'a.ts', replacedLines: 1 });
  await expect(applied).resolves.toMatchObject({ status: 'applied' });
  expect(f.api.applySuggestion).toHaveBeenCalledOnce();
  f.bridge.dispose();
});

it('handles reordered asynchronous invocation replies without cross-settling them', async () => {
  const f = fixture();
  const replies: Array<(value: null) => void> = [];
  f.api.loadFileContent.mockImplementation(() => new Promise(resolve => replies.push(resolve)));
  const first = f.bridge.adapter.loadFileContent!('a');
  const second = f.bridge.adapter.loadFileContent!('b');
  await Promise.resolve();
  replies[1](null);
  await expect(second).resolves.toBeNull();
  let settled = false;
  void first.then(
    () => {
      settled = true;
    },
    () => {}
  );
  await Promise.resolve();
  expect(settled).toBe(false);
  f.bridge.dispose();
  await expect(first).rejects.toThrow(/disposed/);
});

it('releases a failed resume request before later hydration and drops callbacks after unsubscribe', async () => {
  const f = fixture();
  f.api.requestResumeData.mockImplementationOnce(() => {
    throw new Error('send failed');
  });
  await expect(f.bridge.adapter.loadResumedReview!()).rejects.toThrow('send failed');
  const pushed = vi.fn();
  const stop = f.bridge.adapter.onDiffLoad!(pushed);
  const late = [...f.diffs][0];
  stop();
  stop();
  late({ files: [], source: { type: 'welcome' } });
  expect(pushed).not.toHaveBeenCalled();
  f.bridge.adapter.onResumeLoad!(pushed);
  await f.resume({ comments: [], viewedFiles: ['later.ts'] });
  expect(pushed).toHaveBeenCalledExactlyOnceWith({ comments: [], viewedFiles: ['later.ts'] });
  f.bridge.dispose();
});

it('offers state handoff and publication only when their acknowledgements exist', async () => {
  const legacy = fixture();
  expect(legacy.bridge.adapter.handoffReview).toBeUndefined();
  expect(legacy.bridge.adapter.publishReview).toBeUndefined();
  legacy.bridge.dispose();
  let finish!: (value: import('../shared/types').ReviewSaveResult) => void;
  const api = {
    ...legacy.api,
    handoffReview: vi.fn(async () => {}),
    saveReview: vi.fn(
      () =>
        new Promise<import('../shared/types').ReviewSaveResult>(resolve => {
          finish = resolve;
        })
    ),
    acknowledgeReviewSave: vi.fn(),
  };
  const current = createElectronAdapter(api);
  const state = { timestamp: 'now', source: { type: 'welcome' as const }, files: [] };
  await current.adapter.handoffReview!(state);
  expect(api.handoffReview).toHaveBeenCalledWith(state);
  expect(api.saveReview).not.toHaveBeenCalled();
  const saved = current.adapter.publishReview!(state);
  expect(api.acknowledgeReviewSave).not.toHaveBeenCalled();
  finish({ status: 'saved', receipt: 'written' });
  await saved;
  expect(api.acknowledgeReviewSave).toHaveBeenCalledExactlyOnceWith('written');
  current.dispose();
});
