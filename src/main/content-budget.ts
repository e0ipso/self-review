import { MAX_IPC_COLLECTION_ITEMS, MAX_IPC_DEPTH, MAX_IPC_VALUES } from './ipc-review-budget';
import {
  MAX_IMAGE_BYTES,
  MAX_PUBLICATION_ASSET_BYTES,
} from '../../packages/core/src/input-budgets';

// Includes a 10 MiB preview's base64 text without narrowing the existing image limit.
export const MAX_CONTENT_TEXT_BYTES = 32 * 1024 * 1024;

/** Bound traversal and structured clone before delivery. Large diffs inspect the metadata
 * projection before preparePayload allocates its file copies; skipped hunks stay in the host. */
export function checkContentBudget(value: unknown, metadataOnly = false): void {
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
  function visit(node: unknown, depth: number, role: 'payload' | 'files' | 'file' | 'other'): void {
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
      (node.length > MAX_IPC_COLLECTION_ITEMS || node.length > MAX_IPC_VALUES - values)
    )
      refuse();
    for (const key in node) {
      if (!Object.prototype.hasOwnProperty.call(node, key)) continue;
      text(key);
      if (metadataOnly && role === 'file' && key === 'hunks') {
        ++values;
        continue;
      }
      const childRole =
        role === 'payload' && key === 'files' ? 'files' : role === 'files' ? 'file' : 'other';
      visit((node as Record<string, unknown>)[key], depth + 1, childRole);
    }
    active.delete(node);
  }
  visit(value, 0, 'payload');
}
