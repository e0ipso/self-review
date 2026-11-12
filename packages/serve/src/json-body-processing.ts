import { Worker } from 'node:worker_threads';
import type { JsonBodyResult } from './json-body-codec';
import { decodeJsonWorkerReply, type JsonWorkerReply } from './json-body-transfer';
import { MAX_REVIEW_BODY_BYTES } from './protocol';

export const INLINE_JSON_BODY_BYTES = 128 * 1024;
function unreadableBody(): JsonBodyResult {
  return { ok: false, status: 400, error: 'request body could not be read' };
}
export interface JsonBodyLease {
  signal: AbortSignal;
  parse(chunks: ArrayBuffer[], signal: AbortSignal): Promise<JsonBodyResult>;
  release(): void;
}
/** A worker owns decoding/parsing only. Its host joins termination before releasing admission. */
export type JsonParserWorker = Pick<Worker, 'on' | 'off' | 'postMessage' | 'terminate'>;
export async function parseInJsonWorker(
  worker: JsonParserWorker,
  chunks: ArrayBuffer[],
  signal: AbortSignal
): Promise<JsonBodyResult> {
  let reply!: (value: JsonWorkerReply) => void;
  const outcome = new Promise<JsonWorkerReply>(resolve => {
    reply = resolve;
  });
  let exited!: () => void;
  const exit = new Promise<void>(resolve => {
    exited = resolve;
  });
  const onMessage = (result: JsonWorkerReply) => reply(result);
  const onError = () => reply(unreadableBody());
  const onExit = () => {
    exited();
    reply(unreadableBody());
  };
  const onAbort = () => reply(unreadableBody());
  worker.on('message', onMessage);
  worker.on('error', onError);
  worker.on('exit', onExit);
  signal.addEventListener('abort', onAbort, { once: true });
  try {
    if (signal.aborted) onAbort();
    else {
      try {
        worker.postMessage(chunks, chunks);
      } catch {
        onError();
      }
    }
    const result = await outcome;
    try {
      await worker.terminate();
    } catch {
      // A failed terminate does not prove the worker stopped. Retain ownership until exit.
      await exit;
      return unreadableBody();
    }
    return signal.aborted ? unreadableBody() : decodeJsonWorkerReply(result);
  } finally {
    worker.off('message', onMessage);
    worker.off('error', onError);
    worker.off('exit', onExit);
    signal.removeEventListener('abort', onAbort);
  }
}

/** Two reservations, at most 64 MiB of admitted input, and no waiting queue.
 * Reservations include collecting bodies and workers whose termination is still pending.
 */
export class JsonBodyProcessing {
  private readonly active = new Set<{
    controller: AbortController;
    done: Promise<void>;
  }>();
  private reservedBytes = 0;
  private stopping = false;
  constructor(
    private readonly createWorker: () => JsonParserWorker = () =>
      new Worker(new URL('./json-body-worker.js', import.meta.url))
  ) {}

  reserve(maxBytes: number): JsonBodyLease | null {
    if (
      !Number.isSafeInteger(maxBytes) ||
      maxBytes < 1 ||
      this.stopping ||
      this.active.size >= 2 ||
      this.reservedBytes + maxBytes > 2 * MAX_REVIEW_BODY_BYTES
    )
      return null;
    const controller = new AbortController();
    let releaseDone!: () => void;
    const done = new Promise<void>(resolve => {
      releaseDone = resolve;
    });
    const entry = { controller, done };
    this.active.add(entry);
    this.reservedBytes += maxBytes;
    let parsing = false;
    let released = false;
    const release = () => {
      if (released || parsing) return;
      released = true;
      this.active.delete(entry);
      this.reservedBytes -= maxBytes;
      releaseDone();
    };
    return {
      signal: controller.signal,
      parse: async (chunks, signal) => {
        if (released || parsing) throw new Error('JSON body reservation is no longer available.');
        parsing = true;
        try {
          const combined = AbortSignal.any([controller.signal, signal]);
          if (combined.aborted) return unreadableBody();
          return await parseInJsonWorker(this.createWorker(), chunks, combined);
        } finally {
          parsing = false;
          release();
        }
      },
      release,
    };
  }

  shutdown(): Promise<void> {
    this.stopping = true;
    for (const entry of this.active) entry.controller.abort();
    return Promise.all([...this.active].map(entry => entry.done)).then(() => {});
  }
}

export const defaultJsonBodyProcessing = new JsonBodyProcessing();
