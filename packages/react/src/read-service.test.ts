import { expect, it, vi } from 'vitest';
import {
  canReadFileContent,
  canReadResumedReview,
  loadInitialDiff,
  loadInitialResumedReview,
  expandContext,
  loadFileContent,
  loadImage,
  readAttachment,
} from './read-service';

it('accepts only the corresponding read capabilities, with modern priority and legacy fallback', async () => {
  const signal = new AbortController().signal;
  const image = { dataUri: 'data:image/png;base64,AA==' };
  const load = vi.fn(async () => image);
  const legacy = vi.fn(async () => image);
  await expect(
    loadImage({ reads: { loadImage: load }, loadImage: legacy }, 'a.png', signal)
  ).resolves.toEqual(image);
  expect(load).toHaveBeenCalledWith('a.png', signal);
  expect(legacy).not.toHaveBeenCalled();
  await expect(loadImage({ loadImage: legacy }, 'a.png', signal)).resolves.toEqual(image);
  expect(legacy).toHaveBeenCalledWith('a.png');
  const hunks = vi.fn(async () => []);
  expect(canReadFileContent({ loadFileContent: hunks })).toBe(true);
  await expect(loadFileContent({ loadFileContent: hunks }, 'a', signal)).resolves.toEqual([]);
  const bytes = new ArrayBuffer(1);
  await expect(
    readAttachment({ reads: { readAttachment: async () => bytes } }, 'asset', signal)
  ).resolves.toBe(bytes);
  await expect(
    expandContext(
      { expandContext: async () => ({ hunks: [], totalLines: 7 }) },
      { filePath: 'a', contextLines: 2 },
      signal
    )
  ).resolves.toEqual({ hunks: [], totalLines: 7 });
});

it('retains old full-adapter object literals and unsupported hosts at compatibility entry points', async () => {
  const signal = new AbortController().signal;
  await expect(
    loadImage(
      { loadDiff: vi.fn(), loadImage: async () => ({ dataUri: 'data:' }), publishReview: vi.fn() },
      'a.png',
      signal
    )
  ).resolves.toEqual({ dataUri: 'data:' });
  expect(canReadFileContent({ loadDiff: vi.fn() })).toBe(false);
  await expect(loadFileContent({ loadDiff: vi.fn() }, 'a', signal)).rejects.toThrow(
    'does not support'
  );
});

it('rejects obsolete legacy read results and never starts an already aborted read', async () => {
  const controller = new AbortController();
  let resolve!: (value: ArrayBuffer | null) => void;
  const read = vi.fn(
    () =>
      new Promise<ArrayBuffer | null>(yes => {
        resolve = yes;
      })
  );
  const pending = readAttachment({ readAttachment: read }, 'asset', controller.signal);
  controller.abort();
  resolve(null);
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  await expect(
    readAttachment({ readAttachment: read }, 'asset', controller.signal)
  ).rejects.toMatchObject({ name: 'AbortError' });
  expect(read).toHaveBeenCalledOnce();
});

it('keeps initial reads additive, cancellable and separate from mutation capabilities', async () => {
  const controller = new AbortController();
  const payload = { files: [], source: { type: 'welcome' as const } };
  const loadDiff = vi.fn(async () => payload);
  const loadResumedReview = vi.fn(async () => ({ comments: [] }));
  const ownedDiff = vi.fn(async () => payload);
  const ownedResume = vi.fn(async () => ({ comments: [] }));
  const applySuggestion = vi.fn();
  const host = {
    loadDiff,
    loadResumedReview,
    applySuggestion,
    initialReads: { loadDiff: ownedDiff, loadResumedReview: ownedResume },
  };
  await expect(loadInitialDiff(host, controller.signal)).resolves.toBe(payload);
  await expect(loadInitialResumedReview(host, controller.signal)).resolves.toEqual({
    comments: [],
  });
  expect(ownedDiff).toHaveBeenCalledWith(controller.signal);
  expect(ownedResume).toHaveBeenCalledWith(controller.signal);
  expect(loadDiff).not.toHaveBeenCalled();
  expect(loadResumedReview).not.toHaveBeenCalled();
  expect(applySuggestion).not.toHaveBeenCalled();
  expect(canReadResumedReview({ loadDiff })).toBe(false);
  expect(canReadResumedReview(host)).toBe(true);
  await expect(loadInitialDiff({ loadDiff }, controller.signal)).resolves.toBe(payload);
  await expect(
    loadInitialResumedReview({ loadDiff, loadResumedReview }, controller.signal)
  ).resolves.toEqual({ comments: [] });
  expect(loadDiff.mock.calls).toEqual([[]]);
  expect(loadResumedReview.mock.calls).toEqual([[]]);
  controller.abort();
  await expect(loadInitialDiff(host, controller.signal)).rejects.toMatchObject({
    name: 'AbortError',
  });
  expect(ownedDiff).toHaveBeenCalledOnce();
});
