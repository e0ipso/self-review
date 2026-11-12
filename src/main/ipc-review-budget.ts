// Bound validation work after Electron's structured clone, before canonical DTO validation.
import {
  MAX_SOURCE_ENTRIES,
  MAX_RESUME_XML_BYTES,
  MAX_IMAGE_BYTES,
  MAX_PUBLICATION_ASSET_BYTES,
} from '../../packages/core/src/input-budgets';

/** UTF-16 text bytes, including keys and extension fields, across one message. */
export const MAX_IPC_TEXT_BYTES = MAX_RESUME_XML_BYTES;
export const MAX_IPC_COLLECTION_ITEMS = MAX_SOURCE_ENTRIES;
/** Includes property values, array slots, and repeated references, not just unique objects. */
export const MAX_IPC_VALUES = MAX_SOURCE_ENTRIES * 16;
export const MAX_IPC_DEPTH = 64;

export function preflightReviewMessage(value: unknown): void {
  let values = 0;
  let textBytes = 0;
  let binaryBytes = 0;
  const active = new WeakSet<object>();
  const bufferLength = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength')!.get!;
  const refuse = (): never => {
    throw new Error('Review message exceeds desktop validation limits.');
  };
  const text = (value: string) => {
    textBytes += value.length * 2;
    if (textBytes > MAX_IPC_TEXT_BYTES) refuse();
  };
  function visit(node: unknown, depth: number): void {
    if (++values > MAX_IPC_VALUES || depth > MAX_IPC_DEPTH) refuse();
    if (typeof node === 'string') {
      text(node);
      return;
    }
    if (!node || typeof node !== 'object') return;
    let bytes: number | undefined;
    try {
      bytes = bufferLength.call(node);
    } catch {
      /* Not an ArrayBuffer. */
    }
    if (ArrayBuffer.isView(node)) bytes = node.byteLength;
    if (bytes !== undefined) {
      binaryBytes += bytes;
      if (bytes > MAX_IMAGE_BYTES || binaryBytes > MAX_PUBLICATION_ASSET_BYTES) refuse();
      return;
    }
    if (active.has(node)) throw new Error('Cyclic review messages are not supported.');
    active.add(node);
    if (Array.isArray(node)) {
      // Check length before inspecting even the first slot, including sparse arrays.
      if (node.length > MAX_IPC_COLLECTION_ITEMS || node.length > MAX_IPC_VALUES - values) refuse();
    }
    // Enumerate without allocating Object.keys/entries, including array extension properties.
    for (const key in node) {
      if (!Object.prototype.hasOwnProperty.call(node, key)) continue;
      text(key);
      visit((node as Record<string, unknown>)[key], depth + 1);
    }
    active.delete(node);
  }
  visit(value, 0);
}
