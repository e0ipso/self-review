import { EventEmitter } from 'node:events';
import { Worker } from 'node:worker_threads';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { createReviewSession, parseReviewXmlString, loadResumeDocument } from '@self-review/core';
import { createResumeLoader } from './resume-document-loader';
import { resumeAdopterFor } from './resume-adoption-compatibility';
import * as core from '@self-review/core';
import { buildResumeTestWorker } from './test-support/resume-worker';

let root: string;
beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'serve-resume-worker-'));
  await buildResumeTestWorker(join(root, 'worker.mjs'));
});
afterAll(() => rmSync(root, { recursive: true, force: true }));
const xml = `<review xmlns="urn:self-review:v3" remote-url="https://github.com/o/r/pull/1" remote-head-sha="aaa" remote-forge="github"><file path="x" viewed="true"><comment><body>00123 &amp;lt;</body><attachment path=".self-review-assets/a.png"/></comment></file></review>`;
const parsed = () => parseReviewXmlString(xml);

function fake(deliver: (worker: EventEmitter, id: string) => void) {
  const worker = new EventEmitter();
  const terminate = vi.fn(async () => 0);
  Object.assign(worker, {
    terminate,
    postMessage: ({ id }: { id: string }) => queueMicrotask(() => deliver(worker, id)),
  });
  return { worker, terminate, loader: createResumeLoader(undefined, () => worker as Worker) };
}

it('adopts only after termination, keeping comments, viewed, diagnostics and recorded origins', async () => {
  const session = createReviewSession();
  const document = parsed();
  const { loader, terminate, worker } = fake((worker, id) =>
    worker.emit('message', { id, kind: 'parsed', parsed: document })
  );
  terminate.mockImplementation(async () => {
    expect(session.resumeComments).toEqual([]);
    expect(session.attachmentOrigins.size).toBe(0);
    return 0;
  });
  expect(await loader(session, '/prior/review.xml')).toBe(document);
  expect(session.resumeComments[0].body).toBe('00123 &lt;');
  expect(session.resumeViewedFiles).toEqual(['x']);
  expect(session.attachmentOrigins.get('.self-review-assets/a.png')).toBe(
    '/prior/.self-review-assets/a.png'
  );
  expect(terminate).toHaveBeenCalledOnce();
  expect(worker.eventNames()).toEqual([]);
});

it.each(['error', 'exit', 'failure', 'unowned', 'malformed', 'abort', 'stale', 'delivery'])(
  'reaps the worker and preserves the previous session after %s',
  async kind => {
    const controller = new AbortController();
    let current = true;
    const session = createReviewSession();
    session.resumeViewedFiles = ['prior'];
    session.resumeImportDiagnostics = ['prior diagnostic'];
    session.attachmentOrigins = new Map([['prior', '/prior']]);
    const before = { ...session };
    const { loader, worker, terminate } = fake((worker, id) => {
      if (kind === 'error') worker.emit('error', new Error('worker failed'));
      else if (kind === 'exit') worker.emit('exit', 0);
      else if (kind === 'failure')
        worker.emit('message', {
          id,
          kind: 'failed',
          error: { code: 'parse-failed', message: 'invalid XML', details: ['detail'] },
        });
      else if (kind === 'unowned')
        worker.emit('message', { id: 'another', kind: 'parsed', parsed: parsed() });
      else if (kind === 'malformed') worker.emit('message', { id, kind: 'parsed', parsed: {} });
      else {
        worker.emit('message', { id, kind: 'parsed', parsed: parsed() });
        if (kind === 'abort') controller.abort();
        else current = false;
      }
    });
    if (kind === 'delivery')
      Object.assign(worker, {
        postMessage: () => {
          throw new Error('delivery failed');
        },
      });
    await expect(
      loader(session, '/review.xml', { signal: controller.signal, isCurrent: () => current })
    ).rejects.toThrow();
    expect(session).toEqual(before);
    expect(session.attachmentOrigins).toBe(before.attachmentOrigins);
    expect(terminate).toHaveBeenCalledOnce();
    expect(worker.eventNames()).toEqual([]);
  }
);

it('waits for termination before rejecting a deadline or accepting a late reply', async () => {
  vi.useFakeTimers();
  try {
    const { loader, worker, terminate } = fake(() => {});
    let release!: () => void;
    terminate.mockImplementation(
      () =>
        new Promise(resolve => {
          release = () => resolve(0);
        })
    );
    const session = createReviewSession();
    const failed = expect(loader(session, '/review.xml', { timeoutMs: 10 })).rejects.toMatchObject({
      name: 'TimeoutError',
    });
    await vi.advanceTimersByTimeAsync(10);
    expect(terminate).toHaveBeenCalledOnce();
    worker.emit('message', { id: 'late', kind: 'parsed', parsed: parsed() });
    expect(session.resumeComments).toEqual([]);
    release();
    await failed;
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});

it('does not start a worker for a pre-aborted startup', async () => {
  const create = vi.fn<() => Worker>();
  await expect(
    createResumeLoader(undefined, create)(createReviewSession(), '/review.xml', {
      signal: AbortSignal.abort(),
    })
  ).rejects.toMatchObject({ name: 'AbortError' });
  expect(create).not.toHaveBeenCalled();
});

it.each(['current', '2.0.4 projection'])('matches synchronous adoption with %s', async version => {
  const path = join(root, 'prior.xml');
  writeFileSync(path, xml);
  const synchronous = createReviewSession();
  loadResumeDocument(synchronous, path);
  const session = createReviewSession();
  const engine =
    version === 'current' ? core : { recordResumedAttachments: core.recordResumedAttachments };
  const loader = createResumeLoader(
    resumeAdopterFor(engine),
    () => new Worker(join(root, 'worker.mjs'))
  );
  const result = await loader(session, path);
  expect(result.remoteHeadSha).toBe('aaa');
  // Parser regenerates IDs; compare independently of those ephemeral keys.
  const stable = (value: unknown) =>
    JSON.stringify(value, (key, field) => (key === 'id' ? undefined : field));
  expect(stable(session.resumeComments)).toEqual(stable(synchronous.resumeComments));
  expect(session.resumeViewedFiles).toEqual(synchronous.resumeViewedFiles);
  expect(session.resumeImportDiagnostics).toEqual(synchronous.resumeImportDiagnostics);
  expect(session.attachmentOrigins).toEqual(synchronous.attachmentOrigins);
});

it('keeps the host event loop responsive while the actual worker parses a large document', async () => {
  const path = join(root, 'large.xml');
  writeFileSync(
    path,
    `<review><file path="x">${'<comment><body>long feedback &amp; text</body></comment>'.repeat(30000)}</file></review>`
  );
  const loader = createResumeLoader(undefined, () => new Worker(join(root, 'worker.mjs')));
  const session = createReviewSession();
  let completed = false;
  const parsing = loader(session, path).then(result => {
    completed = true;
    return result;
  });
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(completed).toBe(false);
  expect(session.resumeComments).toEqual([]);
  expect((await parsing).comments).toHaveLength(30000);
});

it.each(['abort', 'deadline'])('interrupts actual worker parsing on startup %s', async kind => {
  const controller = new AbortController();
  const session = createReviewSession();
  const worker = new Worker(join(root, 'worker.mjs'));
  const loader = createResumeLoader(undefined, () => worker);
  const failed = expect(
    loader(session, join(root, 'large.xml'), {
      signal: controller.signal,
      timeoutMs: kind === 'deadline' ? 1 : 30000,
    })
  ).rejects.toThrow();
  if (kind === 'abort') controller.abort(new Error('startup cancelled'));
  await failed;
  expect(worker.threadId).toBe(-1);
  expect(session.resumeComments).toEqual([]);
});

it('keeps zero and fractional startup command timeouts usable while bounding worker ownership', async () => {
  vi.useFakeTimers();
  try {
    const zero = fake(() => {});
    const failed = expect(
      zero.loader(createReviewSession(), '/review.xml', { timeoutMs: 0 })
    ).rejects.toMatchObject({ name: 'TimeoutError' });
    await vi.advanceTimersByTimeAsync(29999);
    expect(zero.terminate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await failed;
    expect(zero.terminate).toHaveBeenCalledOnce();
    const fractional = fake((worker, id) =>
      worker.emit('message', { id, kind: 'parsed', parsed: parsed() })
    );
    await fractional.loader(createReviewSession(), '/review.xml', { timeoutMs: 10.5 });
    expect(fractional.terminate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});
