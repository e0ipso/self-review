import { it, expect, vi } from 'vitest';
import type { DiffLoadPayload, ResumeLoadPayload } from '../shared/types';
import { createElectronAdapter } from './electron-adapter';

it('removes one-shot listeners after replies and pending listeners when disposed', async () => {
  let diff!: (payload: DiffLoadPayload) => void;
  let resume!: (payload: ResumeLoadPayload) => void;
  const offDiff = vi.fn();
  const offResume = vi.fn();
  const api = {
    onDiffLoad: vi.fn(callback => {
      diff = callback;
      return offDiff;
    }),
    onResumeLoad: vi.fn(callback => {
      resume = callback;
      return offResume;
    }),
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
    onGuideLoad: vi.fn(),
  };
  const { adapter, dispose } = createElectronAdapter(api);
  const loading = adapter.loadDiff();
  const payload: DiffLoadPayload = { files: [], source: { type: 'welcome' } };
  diff(payload);
  expect(await loading).toBe(payload);
  expect(offDiff).toHaveBeenCalledOnce();
  const resumed = adapter.loadResumedReview!();
  const comments = { comments: [], viewedFiles: [] };
  resume(comments);
  expect(await resumed).toBe(comments);
  expect(offResume).toHaveBeenCalledOnce();
  void adapter.loadResumedReview!();
  dispose();
  dispose();
  expect(offResume).toHaveBeenCalledTimes(2);
});
