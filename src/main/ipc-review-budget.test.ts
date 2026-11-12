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

it.each(['cycle', 'depth', 'width', 'text', 'sparse'])(
  'preflights Apply %s extensions before invoking its decoder',
  async kind => {
    const { suggestionRequest } = await import('./ipc-boundary');
    const extension: Record<string, unknown> = {};
    if (kind === 'cycle') extension.self = extension;
    if (kind === 'depth') {
      let nested: unknown = null;
      for (let i = 0; i < 66; i++) nested = { nested };
      extension.value = nested;
    }
    if (kind === 'width') for (let i = 0; i < MAX_IPC_VALUES; i++) extension[i] = null;
    if (kind === 'text') extension.value = 'x'.repeat(11 * 1024 * 1024);
    if (kind === 'sparse') extension.value = new Array(MAX_IPC_COLLECTION_ITEMS + 1);
    // Malformed known fields would normally fail in the canonical decoder first.
    expect(() => suggestionRequest({ extension })).toThrow(/limits|Cyclic/);
  }
);

it('admits both maximum supported Apply snippets, extensions and their original aliases', async () => {
  const { suggestionRequest } = await import('./ipc-boundary');
  const { MAX_SOURCE_FILE_BYTES } = await import('../../packages/core/src/input-budgets');
  const request = {
    filePath: 'a.txt',
    lineRange: { side: 'new', start: 1, end: 1, extension: 'kept' },
    suggestion: {
      originalCode: 'a'.repeat(MAX_SOURCE_FILE_BYTES),
      proposedCode: 'b'.repeat(MAX_SOURCE_FILE_BYTES),
      extension: { accepted: true },
    },
    extension: { alsoKept: [1, 2, 3] },
  };
  expect(suggestionRequest(request)).toBe(request);
  expect(suggestionRequest(request).suggestion).toBe(request.suggestion);
  expect(suggestionRequest(request).lineRange).toBe(request.lineRange);
});

it('checks the Apply text boundary without the smaller review-state cap', async () => {
  const { preflightApplyMessage, MAX_IPC_APPLY_TEXT_BYTES } = await import('./ipc-review-budget');
  preflightApplyMessage('a'.repeat(MAX_IPC_APPLY_TEXT_BYTES / 2));
  expect(() => preflightApplyMessage('a'.repeat(MAX_IPC_APPLY_TEXT_BYTES / 2 + 1))).toThrow(
    /limits/
  );
});
