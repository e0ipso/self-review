import { afterEach, expect, it, vi } from 'vitest';
import type { DiffLoadPayload, ResumeLoadPayload } from '../shared/types';
import { createElectronAdapter } from './electron-adapter';

const bridges: ReturnType<typeof createElectronAdapter>[] = [];
afterEach(() => {
  bridges.splice(0).forEach(bridge => bridge.dispose());
});
function fixture() {
  const diffs = new Set<(value: DiffLoadPayload) => void>();
  const resumes = new Set<(value: ResumeLoadPayload) => void>();
  const subscribe =
    <T>(set: Set<(value: T) => void>) =>
    (callback: (value: T) => void) => {
      set.add(callback);
      return () => {
        set.delete(callback);
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
  const bridge = createElectronAdapter(api);
  bridges.push(bridge);
  return { api, bridge, diffs, resumes };
}
const payload: DiffLoadPayload = {
  files: [],
  source: { type: 'directory', sourcePath: '/review' },
};

it('does not subscribe or send a pre-aborted owned initial desktop diff', async () => {
  const f = fixture();
  const abort = new AbortController();
  abort.abort();
  await expect(f.bridge.adapter.initialReads!.loadDiff!(abort.signal)).rejects.toThrow(/cancelled/);
  expect(f.api.requestDiffData).not.toHaveBeenCalled();
  expect(f.diffs.size).toBe(0);
});
it('cancels only its initial diff waiter while retaining another waiter and pushed delivery', async () => {
  const f = fixture();
  const push = vi.fn();
  f.bridge.adapter.onDiffLoad!(push);
  const abort = new AbortController();
  const first = f.bridge.adapter.initialReads!.loadDiff!(abort.signal);
  const failed = expect(first).rejects.toThrow(/cancelled/);
  const second = f.bridge.adapter.initialReads!.loadDiff!(new AbortController().signal);
  abort.abort();
  await failed;
  expect(f.diffs.size).toBe(2);
  for (const deliver of [...f.diffs]) deliver(payload);
  expect(await second).toBe(payload);
  expect(push).toHaveBeenCalledExactlyOnceWith(payload);
  expect(f.diffs.size).toBe(1);
  expect(f.api.applySuggestion).not.toHaveBeenCalled();
  f.bridge.dispose();
  expect(f.diffs.size).toBe(0);
});
it('keeps an uncorrelated initial resume acknowledgement out of later pushes after diff cancellation', async () => {
  const f = fixture();
  const push = vi.fn();
  f.bridge.adapter.onResumeLoad!(push);
  expect(f.bridge.adapter.initialReads!.loadResumedReview).toBeUndefined();
  const resumed = f.bridge.adapter.loadResumedReview!();
  const abort = new AbortController();
  const diff = f.bridge.adapter.initialReads!.loadDiff!(abort.signal);
  const failed = expect(diff).rejects.toThrow(/cancelled/);
  abort.abort();
  await failed;
  const empty = { comments: [], viewedFiles: [] };
  for (const deliver of [...f.resumes]) deliver(empty);
  expect(await resumed).toBe(empty);
  expect(push).not.toHaveBeenCalled();
  const later = { comments: [], viewedFiles: ['later.ts'] };
  for (const deliver of [...f.resumes]) deliver(later);
  expect(push).toHaveBeenCalledExactlyOnceWith(later);
});
