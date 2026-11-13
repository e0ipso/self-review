import { setImmediate } from 'node:timers/promises';
import { MAX_IPC_COLLECTION_ITEMS, MAX_IPC_DEPTH, MAX_IPC_VALUES } from './ipc-review-budget';
import {
  MAX_IMAGE_BYTES,
  MAX_PUBLICATION_ASSET_BYTES,
  MAX_SOURCE_FILE_LINES,
} from '../../packages/core/src/input-budgets';

// Includes a 10 MiB preview's base64 text without narrowing the existing image limit.
export const MAX_CONTENT_TEXT_BYTES = 32 * 1024 * 1024;

/** Bound traversal and structured clone before delivery. Large diffs inspect the metadata
 * projection before preparePayload allocates its file copies; skipped hunks stay in the host. */
function* contentBudgetTraversal(value: unknown, metadataOnly: boolean): Generator<void> {
  let steps = 0;
  let values = 0;
  let textBytes = 0;
  let binaryBytes = 0;
  const active = new WeakSet<object>();
  const refuse = (): never => {
    throw new Error('Review content exceeds desktop delivery limits.');
  };
  const text = (value: string) => {
    textBytes += value.length * 2;
    if (textBytes > MAX_CONTENT_TEXT_BYTES) refuse();
  };
  type Role = 'payload' | 'files' | 'file' | 'hunks' | 'hunk' | 'lines' | 'other';
  function* visit(node: unknown, depth: number, role: Role): Generator<void> {
    if (++steps % 2048 === 0) yield;
    if (++values > MAX_IPC_VALUES || depth > MAX_IPC_DEPTH) refuse();
    if (typeof node === 'string') {
      text(node);
      return;
    }
    if (!node || typeof node !== 'object') return;
    const bytes =
      node instanceof ArrayBuffer
        ? node.byteLength
        : ArrayBuffer.isView(node)
          ? node.byteLength
          : undefined;
    if (bytes !== undefined) {
      binaryBytes += bytes;
      if (bytes > MAX_IMAGE_BYTES || binaryBytes > MAX_PUBLICATION_ASSET_BYTES) refuse();
      return;
    }
    if (active.has(node)) throw new Error('Cyclic review content cannot be delivered.');
    active.add(node);
    if (
      Array.isArray(node) &&
      (node.length > (role === 'lines' ? MAX_SOURCE_FILE_LINES : MAX_IPC_COLLECTION_ITEMS) ||
        node.length > MAX_IPC_VALUES - values)
    )
      refuse();
    for (const key in node) {
      if (!Object.prototype.hasOwnProperty.call(node, key)) continue;
      if (++steps % 2048 === 0) yield;
      text(key);
      if (metadataOnly && role === 'file' && key === 'hunks') {
        ++values;
        continue;
      }
      // A Core-admitted file can contain one 100k-line hunk. Other collections keep
      // their smaller cap; the aggregate traversal and text budgets still apply.
      let childRole: Role = 'other';
      if (key === 'hunks') childRole = 'hunks';
      else if (role === 'hunks') childRole = 'hunk';
      else if (role === 'hunk' && key === 'lines') childRole = 'lines';
      else if (role === 'payload' && key === 'files') childRole = 'files';
      else if (role === 'files') childRole = 'file';
      yield* visit((node as Record<string, unknown>)[key], depth + 1, childRole);
    }
    active.delete(node);
  }
  yield* visit(value, 0, 'payload');
}

/** Original synchronous boundary, also used by legacy push helpers. */
export function checkContentBudget(value: unknown, metadataOnly = false): void {
  for (const _span of contentBudgetTraversal(value, metadataOnly)) {
    // Drain the same traversal without scheduling another event-loop turn.
  }
}

/** Trusted outgoing data only. Untrusted IPC DTO admission remains synchronous. */
export async function checkContentBudgetAsync(
  value: unknown,
  metadataOnly = false,
  assertCurrent: () => void = () => {}
): Promise<void> {
  assertCurrent();
  for (const _span of contentBudgetTraversal(value, metadataOnly)) {
    assertCurrent();
    await setImmediate();
    assertCurrent();
  }
  assertCurrent();
}
