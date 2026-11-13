import { EventEmitter } from 'node:events';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createDesktopStartupOperations } from './startup-operations';
import { createDesktopSession } from './desktop-session';
import { parseReviewXmlString } from '../../packages/core/src/xml-parser';

vi.mock('node:worker_threads', () => ({ Worker: vi.fn() }));

const xml =
  '<review><file path="a" viewed="true"><comment><body>saved</body></comment></file></review>';
const parsed = parseReviewXmlString(xml);
let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'startup-resume-binding-'));
  writeFileSync(join(directory, 'review.xml'), xml);
});
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(directory, { recursive: true, force: true });
});

function fixture() {
  const desktop = createDesktopSession(directory);
  desktop.review.resumeViewedFiles = ['prior'];
  const worker = new EventEmitter();
  const terminate = vi.fn(async () => 0);
  let id!: string;
  const postMessage = vi.fn((request: { id: string }) => {
    id = request.id;
  });
  Object.assign(worker, { terminate, postMessage });
  vi.mocked(Worker).mockImplementation(function () {
    return worker as Worker;
  });
  const operations = createDesktopStartupOperations(desktop);
  return {
    desktop,
    operations,
    terminate,
    postMessage,
    path: join(directory, 'review.xml'),
    deliver: () => worker.emit('message', { id, kind: 'parsed', parsed }),
  };
}

it('binds real startup resume to an owned worker and waits for cleanup before adopting feedback', async () => {
  const f = fixture();
  let release!: (code: number) => void;
  f.terminate.mockImplementation(() => new Promise(resolve => (release = resolve)));
  const pending = Promise.resolve(f.operations.resume(f.desktop.review, f.path));
  expect(f.postMessage).toHaveBeenCalledOnce();
  expect(f.desktop.review.resumeViewedFiles).toEqual(['prior']);
  f.deliver();
  await vi.waitFor(() => expect(f.terminate).toHaveBeenCalledOnce());
  expect(f.desktop.review.resumeComments).toEqual([]);
  release(0);
  await expect(pending).resolves.toBe(parsed);
  expect(f.desktop.review.resumeViewedFiles).toEqual(['a']);
  expect(f.desktop.review.resumeComments[0].body).toBe('saved');
});

it.each(['source replaced', 'remote closed'])(
  'refuses a stale startup resume after %s without adopting it',
  async change => {
    const f = fixture();
    const pending = Promise.resolve(f.operations.resume(f.desktop.review, f.path));
    if (change === 'source replaced')
      f.desktop.review.diffData = { files: [], source: { type: 'welcome' } };
    else await f.desktop.remote.dispose('shutdown');
    f.deliver();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(f.desktop.review.resumeViewedFiles).toEqual(['prior']);
    expect(f.desktop.review.resumeComments).toEqual([]);
    expect(f.terminate).toHaveBeenCalledOnce();
  }
);

it('propagates the startup cancellation reason and preserves resumed state', async () => {
  const f = fixture();
  const controller = new AbortController();
  const reason = new Error('Startup was cancelled');
  const pending = Promise.resolve(f.operations.resume(f.desktop.review, f.path, controller.signal));
  controller.abort(reason);
  f.deliver();
  await expect(pending).rejects.toBe(reason);
  expect(f.desktop.review.resumeViewedFiles).toEqual(['prior']);
  expect(f.desktop.review.resumeComments).toEqual([]);
  expect(f.terminate).toHaveBeenCalledOnce();
});
