import { TextDecoder } from 'node:util';

export type JsonBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; status: number; error: string };

/** The inline and worker paths share strict UTF-8 and the historical BOM refusal. */
export function decodeJsonBody(chunks: readonly Uint8Array[]): JsonBodyResult {
  try {
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
      Buffer.concat(chunks)
    );
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, status: 400, error: 'body must be valid JSON' };
  }
}
