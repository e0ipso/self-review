import { EventEmitter } from 'node:events';
import { afterEach, expect, it, vi } from 'vitest';
import { Worker } from 'node:worker_threads';
import { loadResumeDocumentAsync } from './resume-document-loader';
import { createReviewSession } from '../../packages/core/src/review-session';
import { parseReviewXmlString } from '../../packages/core/src/xml-parser';

vi.mock('node:worker_threads', () => ({ Worker: vi.fn() }));
afterEach(() => vi.restoreAllMocks());

function prepareWorker(deliver: (worker: EventEmitter, id: string) => void) {
  const worker = new EventEmitter();
  const terminate = vi.fn(async () => 0);
  Object.assign(worker, {
    terminate,
    postMessage: ({ id }: { id: string }) => queueMicrotask(() => deliver(worker, id)),
  });
  vi.mocked(Worker).mockImplementation(function () {
    return worker as Worker;
  });
  return { worker, terminate };
}

it('adopts feedback only after the owned worker has terminated', async () => {
  const parsed = parseReviewXmlString(`<review><file path="x" viewed="true"><comment>
    <body>00123 &amp;lt;</body><attachment path=".self-review-assets/a.png"/>
    </comment></file></review>`);
  const session = createReviewSession();
  const { terminate } = prepareWorker((worker, id) =>
    worker.emit('message', { id, kind: 'parsed', parsed })
  );
  terminate.mockImplementation(async () => {
    expect(session.resumeComments).toEqual([]);
    expect(session.attachmentOrigins.size).toBe(0);
    return 0;
  });
  expect(await loadResumeDocumentAsync(session, '/prior/review.xml')).toBe(parsed);
  expect(session.resumeComments[0].body).toBe('00123 &lt;');
  expect(session.resumeViewedFiles).toEqual(['x']);
  expect(session.attachmentOrigins.get('.self-review-assets/a.png')).toBe(
    '/prior/.self-review-assets/a.png'
  );
  expect(terminate).toHaveBeenCalledTimes(1);
  expect(vi.mocked(Worker).mock.calls[0][0]).toMatch(/resume-parser-worker\.js$/);
});

it.each(['failure', 'abort', 'stale'])(
  'preserves all prior session fields after %s',
  async kind => {
    const parsed = parseReviewXmlString('<review><file path="new" viewed="true"/></review>');
    const controller = new AbortController();
    let current = true;
    const session = createReviewSession();
    session.resumeViewedFiles = ['prior'];
    session.resumeImportDiagnostics = ['prior diagnostic'];
    session.attachmentOrigins = new Map([['prior', '/prior']]);
    const before = { ...session };
    prepareWorker((worker, id) => {
      if (kind === 'failure') worker.emit('error', new Error('worker failed'));
      else {
        worker.emit('message', { id, kind: 'parsed', parsed });
        if (kind === 'abort') controller.abort();
        else current = false;
      }
    });
    await expect(
      loadResumeDocumentAsync(session, '/review.xml', {
        signal: controller.signal,
        isCurrent: () => current,
      })
    ).rejects.toThrow();
    expect(session).toEqual(before);
    expect(session.attachmentOrigins).toBe(before.attachmentOrigins);
  }
);

it('does not create a worker for an already cancelled operation', async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(
    loadResumeDocumentAsync(createReviewSession(), '/review.xml', {
      signal: controller.signal,
    })
  ).rejects.toMatchObject({ name: 'AbortError' });
  expect(Worker).not.toHaveBeenCalled();
});
