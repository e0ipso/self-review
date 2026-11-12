import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createReviewSession } from '@self-review/core';
import { createReviewServer, listenLoopback } from './server';
import { createServeLifecycle } from './lifecycle';
import { REQUEST_SHUTDOWN } from './request-admission';
import { MAX_STATIC_ASSET_BYTES, STATIC_READ_CHUNK_BYTES, serveStatic } from './static-assets';

// Keep real filesystem behavior while allowing one containment syscall to fail.
vi.mock('node:fs', async original => ({ ...(await original<typeof import('node:fs')>()) }));

let root: string;
let server: ReturnType<typeof createReviewServer>;
let url: string;
const requests: http.ClientRequest[] = [];
const releaseCleanup: (() => void)[] = [];
const capability = 'test-capability';
const reportDiagnostic = vi.fn<(message: string) => void>();

function makeServer(requestTimeoutMs?: number) {
  return createReviewServer({
    session: createReviewSession(),
    output: { path: path.join(root, 'review.xml'), origin: 'explicit' },
    capability,
    clientDir: root,
    maxRequests: 1,
    requestTimeoutMs,
    reportDiagnostic,
  });
}
beforeEach(async () => {
  reportDiagnostic.mockReset();
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'static-stream-')));
  fs.writeFileSync(path.join(root, 'index.html'), 'hello');
  server = makeServer();
  ({ url } = await listenLoopback(server));
});
afterEach(async () => {
  for (const release of releaseCleanup.splice(0)) release();
  for (const request of requests.splice(0)) request.destroy();
  const drained = server[REQUEST_SHUTDOWN]();
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
  await drained;
  vi.restoreAllMocks();
  fs.rmSync(root, { recursive: true, force: true });
});
function sparse(name: string, size: number) {
  const file = path.join(root, name);
  fs.closeSync(fs.openSync(file, 'w'));
  fs.truncateSync(file, size);
  return file;
}
function paused(name: string): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    const request = http.get(url + name, response => {
      response.pause();
      // Aborted partial responses are expected in cancellation tests.
      response.on('error', () => {});
      resolve(response);
    });
    requests.push(request);
    request.on('error', reject);
  });
}
function config() {
  return fetch(url + 'api/config', { headers: { authorization: `Bearer ${capability}` } });
}

/** Observe real descriptor I/O without replacing the reader, file or response. */
function observeFile(
  filePath: string,
  onRead?: (position: number) => void,
  beforeClose?: () => Promise<void>
) {
  const originalOpen = fs.promises.open.bind(fs.promises);
  let handle: fs.promises.FileHandle | undefined;
  let readBytes = 0;
  let largestRead = 0;
  let closed = false;
  vi.spyOn(fs.promises, 'open').mockImplementation(async (...args) => {
    const file = await originalOpen(...args);
    if (args[0] === filePath) {
      handle = file;
      const read = file.read.bind(file);
      vi.spyOn(file, 'read').mockImplementation(async options => {
        onRead?.(Number(options?.position));
        const result = await read(options);
        readBytes += result.bytesRead;
        largestRead = Math.max(largestRead, options?.length ?? options?.buffer?.byteLength ?? 0);
        return result;
      });
      const close = file.close.bind(file);
      vi.spyOn(file, 'close').mockImplementation(async () => {
        await beforeClose?.();
        await close();
        closed = true;
      });
    }
    return file;
  });
  return {
    get handle() {
      return handle;
    },
    get readBytes() {
      return readBytes;
    },
    get largestRead() {
      return largestRead;
    },
    get closed() {
      return closed;
    },
  };
}

describe('bounded static file delivery', () => {
  it('refuses oversized assets explicitly without opening a successful response', async () => {
    sparse('oversized.js', 32 * 1024 * 1024 + 1);
    const response = await fetch(url + 'oversized.js');
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: 'static asset exceeds 32 MiB limit' });
  });

  it('serves empty assets, preserves MIME and security headers, and decodes once', async () => {
    sparse('empty.woff2', 0);
    fs.writeFileSync(path.join(root, '%2E%2E%2Fliteral.js'), 'literal');
    const empty = await fetch(url + 'empty.woff2');
    expect(empty.status).toBe(200);
    expect(empty.headers.get('content-length')).toBe('0');
    expect(empty.headers.get('content-type')).toBe('font/woff2');
    expect(empty.headers.get('referrer-policy')).toBe('no-referrer');
    expect(await empty.text()).toBe('');
    const literal = await fetch(url + '%252E%252E%252Fliteral.js');
    expect(await literal.text()).toBe('literal');
  });

  it.each([
    'missing',
    '%E0%A4%A',
    '..%2Fsecret',
    'folder',
    'escape',
    'loop',
    'index.html/child',
    '%00',
    'x'.repeat(256),
  ])('keeps %s unavailable as 404', async name => {
    fs.mkdirSync(path.join(root, 'folder'));
    fs.symlinkSync(os.tmpdir(), path.join(root, 'escape'));
    fs.symlinkSync('loop', path.join(root, 'loop'));
    const response = await fetch(url + name);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'not found' });
    expect(reportDiagnostic).not.toHaveBeenCalled();
  });

  it('refuses a FIFO without waiting for a writer', async () => {
    execFileSync('mkfifo', [path.join(root, 'fifo')]);
    const response = await fetch(url + 'fifo');
    expect(response.status).toBe(404);
  });

  it('does not deliver a static file when its supplied lifetime is already cancelled', async () => {
    const single = http.createServer((_req, res) => {
      void serveStatic(res, root, '/', { signal: AbortSignal.abort() });
    });
    try {
      const address = await listenLoopback(single);
      await expect(fetch(address.url)).rejects.toThrow();
    } finally {
      single.closeAllConnections();
      await new Promise<void>(resolve => single.close(() => resolve()));
    }
  });

  it('applies response backpressure, bounds reads and releases a disconnected descriptor', async () => {
    const size = 16 * 1024 * 1024;
    const observed = observeFile(sparse('slow.js', size));
    const response = await paused('slow.js');
    expect(response.headers['content-length']).toBe(String(size));
    await vi.waitFor(() => expect(observed.readBytes).toBeGreaterThan(0));
    // A paused real TCP peer cannot accept the complete file into its socket buffers.
    expect((await config()).status).toBe(503);
    expect(observed.readBytes).toBeLessThan(size);
    expect(observed.largestRead).toBeLessThanOrEqual(STATIC_READ_CHUNK_BYTES);
    expect(observed.closed).toBe(false);
    response.destroy();
    await vi.waitFor(() => expect(observed.closed).toBe(true));
    expect(observed.readBytes).toBeLessThan(size);
    expect(observed.handle?.fd).toBe(-1);
    await vi.waitFor(async () => expect((await config()).status).toBe(200));
  });

  it('keeps the admission slot until disconnected file cleanup finishes', async () => {
    let release!: () => void;
    const pending = new Promise<void>(resolve => {
      release = resolve;
    });
    releaseCleanup.push(release);
    let closing = false;
    const observed = observeFile(sparse('cleanup.js', 16 * 1024 * 1024), undefined, async () => {
      closing = true;
      await pending;
    });
    const response = await paused('cleanup.js');
    response.destroy();
    await vi.waitFor(() => expect(closing).toBe(true));
    expect((await config()).status).toBe(503);
    release();
    await vi.waitFor(async () => expect((await config()).status).toBe(200));
    expect(observed.closed).toBe(true);
  });

  it('cancels a slow static response and closes its file while shutdown drains', async () => {
    const size = 16 * 1024 * 1024;
    const observed = observeFile(sparse('shutdown.js', size));
    const response = await paused('shutdown.js');
    await server[REQUEST_SHUTDOWN]();
    expect(observed.closed).toBe(true);
    expect(reportDiagnostic).not.toHaveBeenCalled();
    expect(observed.readBytes).toBeLessThan(size);
    response.destroy();
    expect((await config()).status).toBe(503);
  });

  it('cancels a backpressured static stream at its admitted request deadline', async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    server = makeServer(50);
    ({ url } = await listenLoopback(server));
    const size = 16 * 1024 * 1024;
    const observed = observeFile(sparse('deadline.js', size));
    const response = await paused('deadline.js');
    await vi.waitFor(() => expect(observed.closed).toBe(true));
    expect(observed.readBytes).toBeLessThan(size);
    expect(reportDiagnostic).toHaveBeenCalledExactlyOnceWith(
      expect.stringMatching(/^\[serve\] Request deadline exceeded: kind=read elapsedMs=\d+$/)
    );
    response.destroy();
    await vi.waitFor(async () => expect((await config()).status).toBe(200));
    expect(reportDiagnostic).toHaveBeenCalledOnce();
  });

  it.each(['capture', 'throw', 'reject'])(
    'reports an initial read failure through a non-throwing %s reporter',
    async kind => {
      reportDiagnostic.mockImplementation(() => {
        if (kind === 'throw') throw new Error('reporter failed');
        if (kind === 'reject') return Promise.reject(new Error('reporter failed'));
      });
      const observed = observeFile(path.join(root, 'index.html'), () => {
        throw new Error('read failed');
      });
      const response = await fetch(url);
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'internal error' });
      expect(reportDiagnostic).toHaveBeenCalledExactlyOnceWith(
        expect.stringContaining('GET / failed: Error: read failed')
      );
      await vi.waitFor(() => expect(observed.closed).toBe(true));
      expect((await config()).status).toBe(200);
    }
  );

  it.each(['open', 'lstat', 'containment', 'root containment'] as const)(
    'reports unexpected %s I/O failures without returning details to the client',
    async operation => {
      const failure = Object.assign(new Error('private filesystem detail'), { code: 'EIO' });
      if (operation === 'containment' || operation === 'root containment') {
        const original = fs.promises.realpath.bind(fs.promises);
        vi.spyOn(fs.promises, 'realpath').mockImplementation(async (...args) => {
          if (args[0] === (operation === 'containment' ? path.join(root, 'index.html') : root))
            throw failure;
          return original(...args);
        });
      } else {
        vi.spyOn(fs.promises, operation).mockRejectedValueOnce(failure);
      }
      const response = await fetch(url);
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'internal error' });
      expect(reportDiagnostic).toHaveBeenCalledExactlyOnceWith(
        expect.stringContaining('private filesystem detail')
      );
      expect((await config()).status).toBe(200);
    }
  );

  it('closes an opened file when its name is swapped to an escaping symlink', async () => {
    const target = path.join(root, 'index.html');
    const originalOpen = fs.promises.open.bind(fs.promises);
    let opened: fs.promises.FileHandle | undefined;
    vi.spyOn(fs.promises, 'open').mockImplementation(async (...args) => {
      opened = await originalOpen(...args);
      fs.renameSync(target, path.join(root, 'original.html'));
      fs.symlinkSync('/etc/passwd', target);
      return opened;
    });
    const response = await fetch(url);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'not found' });
    await vi.waitFor(() => expect(opened?.fd).toBe(-1));
  });

  it('limits a growing file to its original content length', async () => {
    const file = sparse('growing.js', 2 * 64 * 1024);
    const observed = observeFile(file, position => {
      if (position > 0) fs.appendFileSync(file, 'more bytes');
    });
    const response = await fetch(url + 'growing.js');
    expect(response.status).toBe(200);
    expect((await response.arrayBuffer()).byteLength).toBe(2 * 64 * 1024);
    await vi.waitFor(() => expect(observed.closed).toBe(true));
    expect(observed.readBytes).toBe(2 * 64 * 1024);
  });

  it('rejects a truncated read as an incomplete response instead of a successful short body', async () => {
    const file = sparse('shrinking.js', 2 * 64 * 1024);
    const observed = observeFile(file, position => {
      if (position > 0) fs.truncateSync(file, 0);
    });
    const result = fetch(url + 'shrinking.js').then(response => response.arrayBuffer());
    await expect(result).rejects.toThrow();
    await vi.waitFor(() => expect(observed.closed).toBe(true));
    expect(reportDiagnostic).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining('Static asset shortened during delivery.')
    );
  });

  it('delivers the largest allowed asset completely with bounded descriptor reads', async () => {
    const observed = observeFile(sparse('maximum.js', MAX_STATIC_ASSET_BYTES));
    const response = await fetch(url + 'maximum.js');
    expect(response.status).toBe(200);
    expect((await response.arrayBuffer()).byteLength).toBe(MAX_STATIC_ASSET_BYTES);
    await vi.waitFor(() => expect(observed.closed).toBe(true));
    expect(observed.readBytes).toBe(MAX_STATIC_ASSET_BYTES);
    expect(observed.largestRead).toBeLessThanOrEqual(STATIC_READ_CHUNK_BYTES);
  });
});

it('runs the deadline during pending containment I/O and retains admission until it settles', async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  server = makeServer(50);
  ({ url } = await listenLoopback(server));
  let release!: () => void;
  const pending = new Promise<void>(resolve => {
    release = resolve;
  });
  releaseCleanup.push(release);
  const realpath = fs.promises.realpath.bind(fs.promises);
  let entered = false;
  vi.spyOn(fs.promises, 'realpath').mockImplementation(async (...args) => {
    if (args[0] === root) {
      entered = true;
      await pending;
    }
    return realpath(...args);
  });
  const opened = vi.spyOn(fs.promises, 'open');
  const reading = fetch(url).catch(error => error);
  await vi.waitFor(() => expect(entered).toBe(true));
  await vi.waitFor(() => expect(reportDiagnostic).toHaveBeenCalledOnce());
  await reading;
  expect(reportDiagnostic).toHaveBeenCalledExactlyOnceWith(
    expect.stringMatching(/^\[serve\] Request deadline exceeded: kind=read elapsedMs=\d+$/)
  );
  expect((await config()).status).toBe(503);
  const exit = vi.fn();
  let expire!: () => void;
  const lifetime = createServeLifecycle({
    exit,
    scheduleDeadline: run => {
      expire = run;
      return () => {};
    },
  });
  lifetime.attach(server);
  lifetime.stop(143);
  expire();
  expect(exit).not.toHaveBeenCalled();
  let drained = false;
  const shutdown = server[REQUEST_SHUTDOWN]().then(() => {
    drained = true;
  });
  await new Promise<void>(resolve => setImmediate(resolve));
  expect(drained).toBe(false);
  release();
  await shutdown;
  await vi.waitFor(() => expect(exit).toHaveBeenCalledExactlyOnceWith(143));
  expect(opened).not.toHaveBeenCalled();
  expect(reportDiagnostic).toHaveBeenCalledOnce();
});

it('retains an opened descriptor through cancelled containment recheck and deferred close', async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  server = makeServer(50);
  ({ url } = await listenLoopback(server));
  let releaseMetadata!: () => void;
  const metadata = new Promise<void>(resolve => {
    releaseMetadata = resolve;
  });
  releaseCleanup.push(releaseMetadata);
  let releaseClose!: () => void;
  const closing = new Promise<void>(resolve => {
    releaseClose = resolve;
  });
  releaseCleanup.push(releaseClose);
  let closeStarted = false;
  const observed = observeFile(path.join(root, 'index.html'), undefined, async () => {
    closeStarted = true;
    await closing;
  });
  const realpath = fs.promises.realpath.bind(fs.promises);
  let calls = 0;
  vi.spyOn(fs.promises, 'realpath').mockImplementation(async (...args) => {
    if (args[0] === root && ++calls === 2) await metadata;
    return realpath(...args);
  });
  const reading = fetch(url).catch(error => error);
  await vi.waitFor(() => expect(reportDiagnostic).toHaveBeenCalledOnce());
  await reading;
  expect(observed.handle).toBeDefined();
  expect(closeStarted).toBe(false);
  expect((await config()).status).toBe(503);
  releaseMetadata();
  await vi.waitFor(() => expect(closeStarted).toBe(true));
  expect((await config()).status).toBe(503);
  expect(observed.closed).toBe(false);
  releaseClose();
  await vi.waitFor(async () => expect((await config()).status).toBe(200));
  expect(observed.closed).toBe(true);
  expect(observed.readBytes).toBe(0);
  expect(reportDiagnostic).toHaveBeenCalledExactlyOnceWith(
    expect.stringMatching(/^\[serve\] Request deadline exceeded: kind=read elapsedMs=\d+$/)
  );
});
