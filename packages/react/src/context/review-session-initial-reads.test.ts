import { expect, it, vi } from 'vitest';
import type { DiffLoadPayload, ResumeLoadPayload } from '@self-review/types';
import type { ReviewAdapter } from '../adapter';
import { createReviewSession, createReviewSessionStore } from './review-session';
import { createReviewSessionController } from './review-session-controller';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const payload = (path = '/review'): DiffLoadPayload => ({
  files: [
    { oldPath: 'a.txt', newPath: 'a.txt', changeType: 'modified', isBinary: false, hunks: [] },
  ],
  source: { type: 'directory', sourcePath: path },
});
function fixture(adapter: ReviewAdapter, staticDiff = false) {
  const store = createReviewSessionStore(
    createReviewSession(
      staticDiff ? payload().files : undefined,
      staticDiff ? payload().source : undefined
    )
  );
  const controller = createReviewSessionController(store, adapter, staticDiff);
  const dispose = controller.activate();
  return { store, controller, dispose };
}
const tick = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

it('prefers owned initial reads, forwards the signal and waits for resume acknowledgement', async () => {
  const resumed = deferred<ResumeLoadPayload>();
  const initial = vi.fn(async (signal: AbortSignal) => {
    expect(signal.aborted).toBe(false);
    return payload();
  });
  const resume = vi.fn((_signal: AbortSignal) => resumed.promise);
  const legacyLoad = vi.fn(async () => payload('/legacy'));
  const legacyResume = vi.fn(async () => ({ comments: [] }));
  const f = fixture({
    loadDiff: legacyLoad,
    loadResumedReview: legacyResume,
    initialReads: { loadDiff: initial, loadResumedReview: resume },
  });
  const disconnect = f.controller.connect();
  await tick();
  expect(initial).toHaveBeenCalledOnce();
  expect(resume).toHaveBeenCalledWith(expect.any(AbortSignal));
  expect(f.store.getSnapshot().resumePending).toBe(true);
  expect(legacyLoad).not.toHaveBeenCalled();
  expect(legacyResume).not.toHaveBeenCalled();
  resumed.resolve({ comments: [] });
  await tick();
  expect(f.store.getSnapshot().resumePending).toBe(false);
  expect(f.store.getSnapshot().diffSource).toEqual(payload().source);
  disconnect();
  f.dispose();
});

it('aborts a superseded or retried owned load while retaining its promise until settlement', async () => {
  const first = deferred<DiffLoadPayload>();
  const second = deferred<DiffLoadPayload>();
  const signals: AbortSignal[] = [];
  const load = vi.fn((signal: AbortSignal) => {
    signals.push(signal);
    return signals.length === 1
      ? Promise.resolve(payload())
      : signals.length === 2
        ? first.promise
        : second.promise;
  });
  let push!: (p: DiffLoadPayload) => void;
  const f = fixture({
    loadDiff: vi.fn(),
    initialReads: { loadDiff: load },
    onDiffLoad: cb => {
      push = cb;
      return () => {};
    },
  });
  const disconnect = f.controller.connect();
  await tick();
  let settled = false;
  const firstRetry = f.controller.retryLoad();
  const retry = f.controller.retryLoad().then(() => {
    settled = true;
  });
  expect(signals).toHaveLength(3);
  expect(signals[1].aborted).toBe(true);
  expect(signals[2].aborted).toBe(false);
  push(payload('/pushed'));
  expect(signals[2].aborted).toBe(true);
  await tick();
  expect(settled).toBe(false);
  second.resolve(payload('/stale-2'));
  first.resolve(payload('/stale-1'));
  await retry;
  await firstRetry;
  await tick();
  expect(f.store.getSnapshot().diffSource).toEqual(payload('/pushed').source);
  expect(f.store.getSnapshot().loadError).toBeNull();
  disconnect();
  f.dispose();
});

it('aborts retried and superseded resume reads and accepts only the owning acknowledgement', async () => {
  const first = deferred<ResumeLoadPayload>();
  const second = deferred<ResumeLoadPayload>();
  const signals: AbortSignal[] = [];
  let push!: (p: ResumeLoadPayload) => void;
  const f = fixture(
    {
      loadDiff: vi.fn(),
      initialReads: {
        loadResumedReview: signal => {
          signals.push(signal);
          return signals.length === 1 ? first.promise : second.promise;
        },
      },
      onResumeLoad: cb => {
        push = cb;
        return () => {};
      },
    },
    true
  );
  const disconnect = f.controller.connect();
  const retry = f.controller.retryResume();
  expect(signals[0].aborted).toBe(true);
  expect(signals[1].aborted).toBe(false);
  push({ comments: [], viewedFiles: ['a.txt'] });
  expect(signals[1].aborted).toBe(true);
  first.resolve({ comments: [] });
  second.reject(new Error('obsolete'));
  await retry;
  await tick();
  expect(f.store.getSnapshot().resumePending).toBe(false);
  expect(f.store.getSnapshot().files[0].viewed).toBe(true);
  expect(f.store.getSnapshot().resumeError).toBeNull();
  disconnect();
  f.dispose();
});

it('keeps a welcome resume read alive across its real diff and cancels it on disposal', async () => {
  const pending = deferred<ResumeLoadPayload>();
  let signal!: AbortSignal;
  let push!: (p: DiffLoadPayload) => void;
  const welcome: DiffLoadPayload = { files: [], source: { type: 'welcome' } };
  const f = fixture({
    loadDiff: async () => welcome,
    initialReads: {
      loadResumedReview: owned => {
        signal = owned;
        return pending.promise;
      },
    },
    onDiffLoad: cb => {
      push = cb;
      return () => {};
    },
  });
  const disconnect = f.controller.connect();
  await tick();
  expect(signal).toBeInstanceOf(AbortSignal);
  push(payload());
  expect(signal.aborted).toBe(false);
  pending.resolve({ comments: [], viewedFiles: ['a.txt'] });
  await tick();
  expect(f.store.getSnapshot().resumePending).toBe(false);
  expect(f.store.getSnapshot().files[0].viewed).toBe(true);
  disconnect();
  f.dispose();
});

it('requests cancellation on disposal and reconnects with fresh work', async () => {
  const pending = [deferred<DiffLoadPayload>(), deferred<DiffLoadPayload>()];
  const signals: AbortSignal[] = [];
  const f = fixture({
    loadDiff: vi.fn(),
    initialReads: {
      loadDiff: signal => {
        signals.push(signal);
        return pending[signals.length - 1].promise;
      },
    },
  });
  const disconnect = f.controller.connect();
  disconnect();
  f.dispose();
  expect(signals[0].aborted).toBe(true);
  const dispose = f.controller.activate();
  const disconnect2 = f.controller.connect();
  expect(signals[1].aborted).toBe(false);
  pending[0].resolve(payload('/old'));
  pending[1].resolve(payload('/current'));
  await tick();
  expect(f.store.getSnapshot().diffSource).toEqual(payload('/current').source);
  disconnect2();
  dispose();
});

it('reports owned failures once and recovers only on manual retry with the same actions', async () => {
  const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(payload());
  const resume = vi
    .fn()
    .mockRejectedValueOnce(new Error('no feedback'))
    .mockResolvedValue({ comments: [] });
  const f = fixture({
    loadDiff: vi.fn(),
    initialReads: { loadDiff: load, loadResumedReview: resume },
  });
  const disconnect = f.controller.connect();
  await tick();
  expect(f.store.getSnapshot().loadError).toBe('offline');
  expect(load).toHaveBeenCalledOnce();
  await f.controller.retryLoad();
  expect(f.store.getSnapshot().loadError).toBeNull();
  expect(f.store.getSnapshot().resumeError).toBe('no feedback');
  expect(f.store.getSnapshot().resumePending).toBe(false);
  await f.controller.retryResume();
  expect(f.store.getSnapshot().resumeError).toBeNull();
  expect(f.store.getSnapshot().resumePending).toBe(false);
  disconnect();
  f.dispose();
});

it('cancels initial feedback on a different remote snapshot and waits for its owning push', async () => {
  const remote = (head: string): DiffLoadPayload => ({
    ...payload('/clone'),
    source: { type: 'git', repository: '/clone', gitDiffArgs: `base...${head}` },
    remote: {
      remoteUrl: 'https://github.com/owner/repo/pull/1',
      remoteForge: 'github',
      remoteBaseSha: 'base',
      remoteHeadSha: head,
      temporaryClone: false,
      threadSyncAvailable: true,
    },
  });
  const pending = deferred<ResumeLoadPayload>();
  let signal!: AbortSignal;
  let pushDiff!: (p: DiffLoadPayload) => void;
  let pushResume!: (p: ResumeLoadPayload) => void;
  const resume = vi.fn((owned: AbortSignal) => {
    signal = owned;
    return pending.promise;
  });
  const f = fixture({
    loadDiff: async () => remote('old'),
    initialReads: { loadResumedReview: resume },
    onDiffLoad: cb => {
      pushDiff = cb;
      return () => {};
    },
    onResumeLoad: cb => {
      pushResume = cb;
      return () => {};
    },
  });
  const disconnect = f.controller.connect();
  await tick();
  expect(signal.aborted).toBe(false);
  pushDiff(remote('new'));
  expect(signal.aborted).toBe(true);
  expect(f.store.getSnapshot().resumePending).toBe(true);
  pending.resolve({ comments: [], viewedFiles: ['a.txt'] });
  await tick();
  expect(f.store.getSnapshot().files[0].viewed).toBe(false);
  await f.controller.retryResume();
  expect(resume).toHaveBeenCalledOnce();
  expect(f.store.getSnapshot().resumeError).toContain('earlier remote snapshot');
  pushResume({ comments: [] });
  expect(f.store.getSnapshot().resumeError).toBeNull();
  expect(f.store.getSnapshot().resumePending).toBe(false);
  disconnect();
  f.dispose();
});

it('classifies a subscribed initial echo before requesting its saved feedback', async () => {
  const pendingDiff = deferred<DiffLoadPayload>();
  const pendingResume = deferred<ResumeLoadPayload>();
  const resume = vi.fn((_signal: AbortSignal) => pendingResume.promise);
  let push!: (p: DiffLoadPayload) => void;
  let signal!: AbortSignal;
  const f = fixture({
    loadDiff: vi.fn(),
    initialReads: {
      loadDiff: owned => {
        signal = owned;
        return pendingDiff.promise;
      },
      loadResumedReview: resume,
    },
    onDiffLoad: cb => {
      push = cb;
      return () => {};
    },
    onResumeLoad: () => () => {},
  });
  const disconnect = f.controller.connect();
  push(payload());
  expect(signal.aborted).toBe(false);
  expect(resume).not.toHaveBeenCalled();
  expect(f.store.getSnapshot().resumePending).toBe(true);
  pendingDiff.resolve(payload());
  await tick();
  expect(resume).toHaveBeenCalledOnce();
  pendingResume.resolve({ comments: [], viewedFiles: ['a.txt'] });
  await tick();
  expect(f.store.getSnapshot().files[0].viewed).toBe(true);
  expect(f.store.getSnapshot().resumePending).toBe(false);
  disconnect();
  f.dispose();
});

it('retains unknown initial provenance across a replacement push and never reinterprets cached feedback', async () => {
  const pending = deferred<DiffLoadPayload>();
  let push!: (p: DiffLoadPayload) => void;
  const resume = vi.fn(async (_signal: AbortSignal) => ({ comments: [], viewedFiles: ['a.txt'] }));
  let signal!: AbortSignal;
  const f = fixture({
    loadDiff: vi.fn(),
    initialReads: {
      loadDiff: owned => {
        signal = owned;
        return pending.promise;
      },
      loadResumedReview: resume,
    },
    onDiffLoad: cb => {
      push = cb;
      return () => {};
    },
  });
  const disconnect = f.controller.connect();
  push(payload('/replacement'));
  expect(signal.aborted).toBe(false);
  pending.resolve(payload('/original'));
  await tick();
  expect(f.store.getSnapshot().diffSource).toEqual(payload('/replacement').source);
  expect(f.store.getSnapshot().files[0].viewed).toBe(false);
  expect(f.store.getSnapshot().resumePending).toBe(false);
  expect(resume).not.toHaveBeenCalled();
  disconnect();
  f.dispose();
});
