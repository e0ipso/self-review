import type { JsonBodyResult } from './json-body-codec';

type Scalar = string | number | boolean | null;
type Entry = [string, Scalar | { ref: number }];
interface FlatNode {
  array: boolean;
  entries: Entry[];
}
export type JsonWorkerReply = JsonBodyResult | { ok: true; flat: FlatNode[] };

/** Native message cloning has a recursion limit that JSON.parse does not share. */
export function encodeJsonWorkerReply(result: JsonBodyResult): JsonWorkerReply {
  if (!result.ok || !needsFlatTransfer(result.value)) return result;
  const objects: object[] = [result.value as object];
  const nodes: FlatNode[] = [];
  for (let index = 0; index < objects.length; index++) {
    const value = objects[index] as Record<string, unknown>;
    const entries: Entry[] = [];
    for (const key of Object.keys(value)) {
      const child = value[key];
      if (child !== null && typeof child === 'object') {
        entries.push([key, { ref: objects.length }]);
        objects.push(child);
      } else entries.push([key, child as Scalar]);
    }
    nodes.push({ array: Array.isArray(value), entries });
  }
  return { ok: true, flat: nodes };
}

function needsFlatTransfer(value: unknown): boolean {
  const pending = [{ value, depth: 0 }];
  while (pending.length) {
    const { value, depth } = pending.pop()!;
    if (value === null || typeof value !== 'object') continue;
    if (depth >= 128) return true;
    for (const key of Object.keys(value)) {
      const child = (value as Record<string, unknown>)[key];
      if (child !== null && typeof child === 'object')
        pending.push({ value: child, depth: depth + 1 });
    }
  }
  return false;
}

/** Rebuild JSON containers iteratively, keeping own __proto__ properties inert. */
export function decodeJsonWorkerReply(reply: JsonWorkerReply): JsonBodyResult {
  if (!reply.ok || !('flat' in reply)) return reply;
  const values = reply.flat.map(node => (node.array ? [] : {})) as Record<string, unknown>[];
  reply.flat.forEach((node, index) => {
    for (const [key, entry] of node.entries) {
      const value = entry !== null && typeof entry === 'object' ? values[entry.ref] : entry;
      if (key === '__proto__')
        Object.defineProperty(values[index], key, {
          value,
          enumerable: true,
          writable: true,
          configurable: true,
        });
      else values[index][key] = value;
    }
  });
  return { ok: true, value: values[0] };
}
