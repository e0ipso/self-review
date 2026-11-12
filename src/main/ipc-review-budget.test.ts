import { expect, it, vi } from 'vitest';
import { reviewState } from './ipc-boundary';
import {
  preflightReviewMessage,
  MAX_IPC_TEXT_BYTES,
  MAX_IPC_COLLECTION_ITEMS,
  MAX_IPC_VALUES,
} from './ipc-review-budget';
import {
  MAX_IMAGE_BYTES,
  MAX_PUBLICATION_ASSET_BYTES,
} from '../../packages/core/src/input-budgets';

it('accepts the exact text and collection limits and rejects the next unit', () => {
  preflightReviewMessage('a'.repeat(MAX_IPC_TEXT_BYTES / 2));
  expect(() => preflightReviewMessage('a'.repeat(MAX_IPC_TEXT_BYTES / 2 + 1))).toThrow(/limits/);
  preflightReviewMessage(new Array(MAX_IPC_COLLECTION_ITEMS).fill(null));
  expect(() => preflightReviewMessage(new Array(MAX_IPC_COLLECTION_ITEMS + 1))).toThrow(/limits/);
});
it('bounds repeated aliases, deep values, cycles, and sparse collections', () => {
  const repeated = new Array(MAX_IPC_COLLECTION_ITEMS).fill(null);
  expect(() =>
    preflightReviewMessage(new Array(Math.ceil(MAX_IPC_VALUES / repeated.length)).fill(repeated))
  ).toThrow(/limits/);
  const cycle: unknown[] = [];
  cycle.push(cycle);
  expect(() => preflightReviewMessage(cycle)).toThrow(/Cyclic/);
  let deep: unknown = null;
  for (let i = 0; i < 66; i++) deep = { deep };
  expect(() => preflightReviewMessage(deep)).toThrow(/limits/);
  expect(() =>
    reviewState({
      timestamp: 'now',
      source: { type: 'welcome' },
      files: new Array(MAX_IPC_COLLECTION_ITEMS + 1),
    })
  ).toThrow(/limits/);
});
it('counts binary occurrences without copying and preserves existing attachment bounds', () => {
  const data = new ArrayBuffer(MAX_IMAGE_BYTES);
  preflightReviewMessage(data);
  expect(() => preflightReviewMessage(new ArrayBuffer(MAX_IMAGE_BYTES + 1))).toThrow(/limits/);
  expect(() =>
    preflightReviewMessage(
      new Array(Math.floor(MAX_PUBLICATION_ASSET_BYTES / MAX_IMAGE_BYTES) + 1).fill(data)
    )
  ).toThrow(/limits/);
});

it('rejects oversized collections before visiting their first element', () => {
  const first = vi.fn(() => {
    throw new Error('inspected an oversized collection');
  });
  const files = new Array(MAX_IPC_COLLECTION_ITEMS + 1);
  Object.defineProperty(files, '0', { get: first });
  expect(() => reviewState({ timestamp: 'now', source: { type: 'welcome' }, files })).toThrow(
    /limits/
  );
  expect(first).not.toHaveBeenCalled();
});

it('accepts canonically valid reviews at the collection and text boundaries', () => {
  const file = { path: 'a.ts', changeType: 'added', viewed: false, comments: [] };
  const valid = {
    timestamp: 'now',
    source: { type: 'welcome' },
    files: new Array(MAX_IPC_COLLECTION_ITEMS).fill(file),
  };
  expect(reviewState(valid)).toBe(valid);
  // The empty DTO contributes 31 UTF-16 code units of keys and the source type.
  const textBoundary = {
    timestamp: 'a'.repeat(MAX_IPC_TEXT_BYTES / 2 - 31),
    source: { type: 'welcome' },
    files: [],
  };
  expect(reviewState(textBoundary)).toBe(textBoundary);
  expect(() => reviewState({ ...textBoundary, timestamp: textBoundary.timestamp + 'a' })).toThrow(
    /limits/
  );
});
