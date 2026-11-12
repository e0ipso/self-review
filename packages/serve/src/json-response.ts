// Two bounded, cooperative passes over data-only DTOs: measure before headers,
// then encode into small chunks, waiting for the socket whenever it backs up.
import type { ServerResponse } from 'node:http';
import { setImmediate } from 'node:timers/promises';
import { SECURITY_HEADERS } from './http-transport';

export const MAX_JSON_RESPONSE_BYTES = 64 * 1024 * 1024;
export const MAX_JSON_RESPONSE_NODES = 2_000_000;
const MAX_DEPTH = 128;
const CHUNK_CHARS = 16 * 1024;

export class JsonResponseLimitError extends Error {}
export interface JsonResponseOptions {
  signal: AbortSignal;
  maxBytes?: number;
  maxNodes?: number;
}

function* quoted(text: string): Generator<string> {
  yield '"';
  for (let start = 0; start < text.length; ) {
    let end = Math.min(text.length, start + CHUNK_CHARS);
    // JSON.stringify escapes lone surrogates; never split an intact pair.
    if (
      end < text.length &&
      text.charCodeAt(end - 1) >= 0xd800 &&
      text.charCodeAt(end - 1) <= 0xdbff
    )
      end--;
    yield JSON.stringify(text.slice(start, end)).slice(1, -1);
    start = end;
  }
  yield '"';
}

function* tokens(value: unknown, maxNodes: number): Generator<string> {
  let nodes = 0;
  const ancestors = new Set<object>();
  function* visit(value: unknown, depth: number): Generator<string> {
    if (++nodes > maxNodes || depth > MAX_DEPTH)
      throw new JsonResponseLimitError('JSON response exceeds the serialization work limit');
    if (typeof value === 'string') {
      yield* quoted(value);
      return;
    }
    if (value === null || value === undefined) {
      yield 'null';
      return;
    }
    if (typeof value === 'boolean' || typeof value === 'number') {
      yield JSON.stringify(value);
      return;
    }
    if (typeof value !== 'object') throw new TypeError('Response must be a JSON DTO');
    if (ancestors.has(value)) throw new TypeError('Response contains a cycle');
    ancestors.add(value);
    try {
      if (Array.isArray(value)) {
        const length = value.length;
        if (length > maxNodes - nodes)
          throw new JsonResponseLimitError('JSON response exceeds the serialization work limit');
        yield '[';
        for (let i = 0; i < length; i++) {
          if (i) yield ',';
          const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
          if (descriptor && !('value' in descriptor))
            throw new TypeError('Response contains an accessor');
          yield* visit(descriptor?.value, depth + 1);
        }
        yield ']';
      } else {
        const keys = Object.keys(value);
        if (keys.length > maxNodes - nodes)
          throw new JsonResponseLimitError('JSON response exceeds the serialization work limit');
        yield '{';
        let first = true;
        for (const key of keys) {
          const descriptor = Object.getOwnPropertyDescriptor(value, key);
          if (!descriptor || !('value' in descriptor))
            throw new TypeError('Response contains an accessor');
          if (descriptor.value === undefined) {
            if (++nodes > maxNodes)
              throw new JsonResponseLimitError(
                'JSON response exceeds the serialization work limit'
              );
            continue;
          }
          if (!first) yield ',';
          first = false;
          yield* quoted(key);
          yield ':';
          yield* visit(descriptor.value, depth + 1);
        }
        yield '}';
      }
    } finally {
      ancestors.delete(value);
    }
  }
  yield* visit(value, 0);
}

async function* chunks(value: unknown, options: JsonResponseOptions): AsyncGenerator<string> {
  let bytes = 0;
  let steps = 0;
  let checkpointBytes = 0;
  let pending = '';
  for (const token of tokens(value, options.maxNodes ?? MAX_JSON_RESPONSE_NODES)) {
    options.signal.throwIfAborted();
    const tokenBytes = Buffer.byteLength(token);
    bytes += tokenBytes;
    checkpointBytes += tokenBytes;
    if (bytes > (options.maxBytes ?? MAX_JSON_RESPONSE_BYTES))
      throw new JsonResponseLimitError('JSON response exceeds the output byte limit');
    pending += token;
    if (pending.length >= CHUNK_CHARS) {
      yield pending;
      pending = '';
    }
    if (++steps % 2048 === 0 || checkpointBytes >= 256 * 1024) {
      await setImmediate(undefined, { signal: options.signal });
      checkpointBytes = 0;
    }
  }
  if (pending) yield pending;
}

function drain(res: ServerResponse, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      res.off('drain', ready);
      res.off('close', closed);
      res.off('error', failed);
      signal.removeEventListener('abort', aborted);
    };
    const ready = () => {
      cleanup();
      resolve();
    };
    const failed = (error: Error) => {
      cleanup();
      reject(error);
    };
    const closed = () => failed(new Error('JSON response disconnected'));
    const aborted = () => failed(signal.reason);
    res.once('drain', ready);
    res.once('close', closed);
    res.once('error', failed);
    signal.addEventListener('abort', aborted, { once: true });
    if (signal.aborted) aborted();
    else if (res.destroyed) closed();
  });
}

export async function sendLargeJson(
  res: ServerResponse,
  value: unknown,
  options: JsonResponseOptions
): Promise<void> {
  // No header or partial success for a preventable serialization refusal.
  for await (const _chunk of chunks(value, options)) {
    /* measure, without retaining */
  }
  options.signal.throwIfAborted();
  res.writeHead(200, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...SECURITY_HEADERS,
  });
  for await (const chunk of chunks(value, options)) {
    if (!res.write(chunk)) await drain(res, options.signal);
  }
  res.end();
}
