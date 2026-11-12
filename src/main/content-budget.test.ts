import { setImmediate } from 'node:timers/promises';
import { expect, it, vi } from 'vitest';
import {
  checkContentBudget,
  checkContentBudgetAsync,
  MAX_CONTENT_TEXT_BYTES,
} from './content-budget';
import { MAX_IPC_COLLECTION_ITEMS, MAX_IPC_DEPTH, MAX_IPC_VALUES } from './ipc-review-budget';
import {
  MAX_IMAGE_BYTES,
  MAX_PUBLICATION_ASSET_BYTES,
  MAX_SOURCE_FILE_LINES,
} from '../../packages/core/src/input-budgets';

function outcome(value: unknown, metadata = false): string | null {
  try {
    checkContentBudget(value, metadata);
    return null;
  } catch (error) {
    return (error as Error).message;
  }
}
function deep(depth: number): unknown {
  let value: unknown = null;
  while (depth--) value = { value };
  return value;
}
const cyclic: Record<string, unknown> = {};
cyclic.self = cyclic;
const shared = { text: 'shared' };
const text = 'a'.repeat(MAX_CONTENT_TEXT_BYTES / 2);
const binary = new ArrayBuffer(MAX_IMAGE_BYTES);
const fixtures: [string, () => unknown][] = [
  ['text at limit', () => text],
  ['text above limit', () => text + 'a'],
  ['depth at limit', () => deep(MAX_IPC_DEPTH)],
  ['depth above limit', () => deep(MAX_IPC_DEPTH + 1)],
  ['sparse collection at limit', () => new Array(MAX_IPC_COLLECTION_ITEMS)],
  ['sparse collection above limit', () => new Array(MAX_IPC_COLLECTION_ITEMS + 1)],
  ['binary at limit', () => binary],
  ['binary above limit', () => new ArrayBuffer(MAX_IMAGE_BYTES + 1)],
  [
    'binary aggregate above limit',
    () => Array(Math.floor(MAX_PUBLICATION_ASSET_BYTES / MAX_IMAGE_BYTES) + 1).fill(binary),
  ],
  ['repeated object', () => [shared, shared]],
  ['cycle', () => cyclic],
  ['aggregate values', () => Array(18).fill(Array(MAX_IPC_COLLECTION_ITEMS).fill(null))],
  ['full source hunk', () => ({ hunks: [{ lines: Array(MAX_SOURCE_FILE_LINES).fill('') }] })],
  ['oversized source hunk', () => ({ hunks: [{ lines: new Array(MAX_SOURCE_FILE_LINES + 1) }] })],
];

it.each(fixtures)('keeps synchronous and cooperative budget parity for %s', async (_name, make) => {
  const value = make();
  const expected = outcome(value);
  if (expected === null) await expect(checkContentBudgetAsync(value)).resolves.toBeUndefined();
  else await expect(checkContentBudgetAsync(value)).rejects.toThrow(expected);
});

it('refuses oversized collections before reading their first slot in both forms', async () => {
  const value = new Array(MAX_IPC_COLLECTION_ITEMS + 1);
  const read = vi.fn(() => {
    throw new Error('slot read');
  });
  Object.defineProperty(value, 0, { get: read, enumerable: true });
  expect(() => checkContentBudget(value)).toThrow('delivery limits');
  await expect(checkContentBudgetAsync(value)).rejects.toThrow('delivery limits');
  expect(read).not.toHaveBeenCalled();
});

it('yields to the event loop during a supported full hunk and stops at a cancelled span', async () => {
  const value = { hunks: [{ lines: Array(MAX_SOURCE_FILE_LINES).fill('') }] };
  let finished = false;
  const abort = new AbortController();
  const work = checkContentBudgetAsync(value, false, () => abort.signal.throwIfAborted());
  void work.then(
    () => {
      finished = true;
    },
    () => {}
  );
  await setImmediate();
  expect(finished).toBe(false);
  abort.abort(new Error('cancelled between spans'));
  await expect(work).rejects.toThrow('cancelled between spans');
  expect(MAX_IPC_VALUES).toBeGreaterThan(MAX_SOURCE_FILE_LINES);
});

it('counts metadata keys and skips only file hunks in the lazy projection', async () => {
  const value = { files: [{ hunks: { invalid: text + 'a' }, path: 'a' }] };
  expect(outcome(value, true)).toBeNull();
  await expect(checkContentBudgetAsync(value, true)).resolves.toBeUndefined();
  await expect(checkContentBudgetAsync(value)).rejects.toThrow('delivery limits');
});
