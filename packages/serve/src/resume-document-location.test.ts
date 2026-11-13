import { EventEmitter } from 'node:events';
import { Worker } from 'node:worker_threads';
import { afterEach, expect, it, vi } from 'vitest';
import { loadResumeDocumentAsync } from './resume-document-loader';
import { createReviewSession } from '@self-review/core';
import { parseReviewXmlString } from '@self-review/core';

vi.mock('node:worker_threads', () => ({ Worker: vi.fn() }));
const cleanup: (() => void)[] = [];
afterEach(async () => {
  cleanup.splice(0).forEach(release => release());
  await Promise.resolve();
  vi.restoreAllMocks();
});
function deferred() {
  let resolve!: (value: string) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<string>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  cleanup.push(() => resolve('/virtual/physical'));
  return { promise, resolve, reject };
}
function fixture() {
  const parsed = parseReviewXmlString(`<review><file path="x" viewed="true"><comment>
    <body>saved</body><attachment path=".self-review-assets/a.png" media-type="image/png"/>
    <reply><body>reply</body><attachment path=".self-review-assets/b.png" media-type="image/png"/></reply>
    </comment></file></review>`);
  const worker = new EventEmitter();
  const terminate = vi.fn(async () => 0);
  Object.assign(worker, {
    terminate,
    postMessage: ({ id }: { id: string }) =>
      queueMicrotask(() => worker.emit('message', { id, kind: 'parsed', parsed })),
  });
  vi.mocked(Worker).mockImplementation(function () {
    return worker as Worker;
  });
  const session = createReviewSession();
  session.resumeViewedFiles = ['prior'];
  session.resumeImportDiagnostics = ['prior diagnostic'];
  const before = { ...session };
  return { parsed, session, before, terminate };
}

it('waits for worker release and the supplied directory before adopting either attachment origin', async () => {
  const f = fixture();
  let release!: () => void;
  f.terminate.mockImplementation(
    () =>
      new Promise(resolve => {
        release = () => resolve(0);
      })
  );
  const directory = deferred();
  const paths = {
    realpath(target: string) {
      expect(this).toBe(paths);
      expect(target).toBe('/virtual/link');
      return directory.promise;
    },
  };
  const inspect = vi.spyOn(paths, 'realpath');
  const pending = loadResumeDocumentAsync(f.session, '/virtual/link/prior.xml', {
    paths,
    signal: undefined,
  });
  await vi.waitFor(() => expect(f.terminate).toHaveBeenCalledOnce());
  expect(inspect).not.toHaveBeenCalled();
  expect(f.session).toEqual(f.before);
  release();
  await vi.waitFor(() => expect(inspect).toHaveBeenCalledOnce());
  expect(f.session).toEqual(f.before);
  directory.resolve('/virtual/physical');
  expect(await pending).toBe(f.parsed);
  expect(f.session.resumeComments).toBe(f.parsed.comments);
  expect(f.session.resumeViewedFiles).toBe(f.parsed.viewedFiles);
  expect(f.session.attachmentOrigins).toEqual(
    new Map([
      ['.self-review-assets/a.png', '/virtual/physical/.self-review-assets/a.png'],
      ['.self-review-assets/b.png', '/virtual/physical/.self-review-assets/b.png'],
    ])
  );
});

it('leaves relative location interpretation to the supplied path provider', async () => {
  const f = fixture();
  const paths = {
    async realpath(target: string) {
      expect(target).toBe('drafts/..');
      return '/virtual/reviews';
    },
  };
  await loadResumeDocumentAsync(f.session, 'drafts/../review.xml', { paths, signal: undefined });
  expect(f.session.attachmentOrigins.get('.self-review-assets/a.png')).toBe(
    '/virtual/reviews/.self-review-assets/a.png'
  );
});

it('preserves a supplied location failure and every previous session field', async () => {
  const f = fixture();
  const error = new Error('virtual location failed');
  const paths = {
    realpath: vi.fn(async () => {
      throw error;
    }),
  };
  await expect(
    loadResumeDocumentAsync(f.session, '/virtual/prior.xml', { paths, signal: undefined })
  ).rejects.toBe(error);
  expect(paths.realpath).toHaveBeenCalledOnce();
  expect(f.session).toEqual(f.before);
  expect(f.session.attachmentOrigins).toBe(f.before.attachmentOrigins);
});

it.each(['abort', 'replacement'])(
  'joins directory lookup and refuses stale adoption after %s',
  async change => {
    const f = fixture();
    const directory = deferred();
    const paths = { realpath: vi.fn(() => directory.promise) };
    const controller = new AbortController();
    let current = true;
    let settled = false;
    const observed = loadResumeDocumentAsync(f.session, '/virtual/prior.xml', {
      paths,
      signal: controller.signal,
      isCurrent: () => current,
    }).then(
      value => {
        settled = true;
        return { value };
      },
      (error: unknown) => {
        settled = true;
        return { error };
      }
    );
    await vi.waitFor(() => expect(paths.realpath).toHaveBeenCalledOnce());
    const reason = new Error('cancelled during location lookup');
    if (change === 'abort') controller.abort(reason);
    else current = false;
    await new Promise<void>(resolve => setImmediate(resolve));
    expect(settled).toBe(false);
    expect(f.session).toEqual(f.before);
    directory.reject(new Error('lookup settled'));
    const outcome = await observed;
    expect(outcome).toHaveProperty('error');
    if ('error' in outcome) {
      if (change === 'abort') expect(outcome.error).toBe(reason);
      else expect(outcome.error).toMatchObject({ name: 'AbortError' });
    }
    expect(f.session).toEqual(f.before);
  }
);

it('refuses a nonabsolute resolved directory without replacing state', async () => {
  const f = fixture();
  const paths = {
    async realpath() {
      return 'relative';
    },
  };
  await expect(
    loadResumeDocumentAsync(f.session, '/virtual/prior.xml', { paths, signal: undefined })
  ).rejects.toThrow(TypeError);
  expect(f.session).toEqual(f.before);
});
