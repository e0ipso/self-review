import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { ReviewXmlError } from '@self-review/core';
import { runResumeWorker } from './resume-worker-lifetime';
import { buildResumeTestWorker } from './test-support/resume-worker';

let directory: string;
beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), 'serve-worker-contract-'));
  await buildResumeTestWorker(join(directory, 'worker.mjs'));
});
afterAll(() => rmSync(directory, { recursive: true, force: true }));

it('retains typed read failure name, stack, details and native cause from the real worker', async () => {
  const path = join(directory, 'missing.xml');
  const worker = new Worker(join(directory, 'worker.mjs'));
  const error = await runResumeWorker(worker, { id: 'read', path }).catch(error => error);
  expect(worker.threadId).toBe(-1);
  expect(error).toBeInstanceOf(ReviewXmlError);
  expect(error).toMatchObject({ name: 'ReviewXmlError', code: 'read-failed', details: [] });
  expect(error.stack).toContain('parseReviewXml');
  expect(error.cause).toBeInstanceOf(Error);
  expect(error.cause).toMatchObject({ code: 'ENOENT', path });
});

it('retains parser budgets and the requested input path', async () => {
  const path = join(directory, 'oversized.xml');
  writeFileSync(path, 'x'.repeat(16 * 1024 * 1024 + 1));
  const worker = new Worker(join(directory, 'worker.mjs'));
  const error = await runResumeWorker(worker, { id: 'budget', path }).catch(error => error);
  expect(worker.threadId).toBe(-1);
  expect(error).toBeInstanceOf(ReviewXmlError);
  expect(error.code).toBe('input-too-large');
  expect(error.message).toContain(path);
});

it('retains cancellation identity as cause when worker release fails', async () => {
  const controller = new AbortController();
  const reason = new Error('shutdown');
  const terminationError = new Error('termination failed');
  const worker = Object.assign(new EventEmitter(), {
    postMessage: vi.fn(),
    terminate: vi.fn(async () => {
      throw terminationError;
    }),
  });
  const result = runResumeWorker(
    worker as unknown as Worker,
    { id: 'cancel', path: '/review.xml' },
    { signal: controller.signal }
  );
  controller.abort(reason);
  await expect(result).rejects.toMatchObject({
    name: 'ResumeWorkerTerminationError',
    cause: reason,
    terminationError,
  });
  expect(worker.eventNames()).toEqual([]);
});
