import { EventEmitter } from 'node:events';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { BrowserWindow, IpcMain, IpcRenderer } from 'electron';
import { afterEach, expect, it, vi } from 'vitest';
import { createReviewSession } from '../../packages/core/src/review-handlers';
import { DEFAULT_CONFIG } from '../../packages/react/src/config-defaults';
import { createElectronAPI } from '../preload/bridge';
import { createElectronAdapter } from '../renderer/electron-adapter';
import { ElectronRequests } from '../renderer/electron-requests';
import { IPC } from '../shared/ipc-channels';
import { registerContentHandlers } from './content-ipc';
import { createIpcBoundary } from './ipc-boundary';
import { DesktopOperations } from './desktop-operations';
import { bindDesktopReviewOperations } from './review-operations';
import { MAX_IPC_COLLECTION_ITEMS } from './ipc-review-budget';
import { MAX_CONTENT_TEXT_BYTES } from './content-budget';

function fixture(limit = 32) {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const renderer = new EventEmitter();
  const frame = {};
  const sender = Object.assign(new EventEmitter(), {
    mainFrame: frame,
    isDestroyed: () => false,
    send: vi.fn((channel: string, ...args: unknown[]) => renderer.emit(channel, {}, ...args)),
  });
  // This fake also exercises the declared 32-request capacity.
  sender.setMaxListeners(64);
  let window = { webContents: sender, isDestroyed: () => false } as unknown as BrowserWindow;
  const event = { sender, senderFrame: frame };
  const session = createReviewSession();
  session.diffData = { source: { type: 'directory', sourcePath: '/review' }, files: [] };
  session.config = DEFAULT_CONFIG;
  const review = bindDesktopReviewOperations(session);
  const operations = new DesktopOperations(limit);
  const boundary = createIpcBoundary(
    {
      on: (channel: string, handler: (...args: unknown[]) => unknown) =>
        handlers.set(channel, handler),
      handle: (channel: string, handler: (...args: unknown[]) => unknown) =>
        handlers.set(channel, handler),
    } as unknown as IpcMain,
    () => window
  );
  registerContentHandlers(review, boundary, operations);
  const invoke = (channel: string, ...args: unknown[]) =>
    Promise.resolve().then(() => handlers.get(channel)!(event, ...args));
  const api = createElectronAPI({
    on: renderer.on.bind(renderer),
    removeListener: renderer.removeListener.bind(renderer),
    invoke,
    send: (channel: string, ...args: unknown[]) => handlers.get(channel)!(event, ...args),
  } as unknown as IpcRenderer);
  const bridge = createElectronAdapter(api);
  return {
    session,
    review,
    operations,
    api,
    bridge,
    sender,
    renderer,
    handlers,
    event,
    invoke,
    replacePeer: () => {
      window = null as unknown as BrowserWindow;
    },
    close: async () => {
      bridge.dispose();
      await operations.dispose('test finished', 1);
    },
  };
}
const cases: ReturnType<typeof fixture>[] = [];
const setup = (limit?: number) => {
  const f = fixture(limit);
  cases.push(f);
  return f;
};
afterEach(async () => {
  for (const f of cases.splice(0)) await f.close();
  vi.useRealTimers();
});
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

it('cancels a first-party adapter/preload/main read and recovers real operation admission', async () => {
  const f = setup(1);
  let signal!: AbortSignal;
  const entered = vi.spyOn(f.review, 'loadImage').mockImplementation((_path, input) => {
    signal = input;
    return new Promise((_resolve, reject) =>
      input.addEventListener('abort', () => reject(input.reason), { once: true })
    );
  });
  const controller = new AbortController();
  const reading = f.bridge.adapter.reads!.loadImage!('a.png', controller.signal);
  const rejected = expect(reading).rejects.toThrow(/cancelled/);
  await flush();
  expect(entered).toHaveBeenCalledOnce();
  expect(signal.aborted).toBe(false);
  await expect(f.operations.read(async () => true)).rejects.toThrow(/Too many/);
  controller.abort();
  await rejected;
  await flush();
  expect(signal.aborted).toBe(true);
  await expect(f.operations.read(async () => 'recovered')).resolves.toBe('recovered');
  expect(f.sender.listenerCount('render-process-gone')).toBe(0);
});

it('binds file and context reads, permits context merging and preserves host serialization', async () => {
  const f = setup();
  vi.spyOn(f.review, 'getFileHunks').mockReturnValue([]);
  await expect(
    f.bridge.adapter.reads!.loadFileContent!('a.ts', new AbortController().signal)
  ).resolves.toEqual([]);
  const expand = vi
    .spyOn(f.review, 'expandContext')
    .mockImplementation(async (_request, signal) => {
      expect(signal.aborted).toBe(false);
      // Core merges context into a new payload while preserving the source and reviewed membership.
      f.session.diffData = { ...f.session.diffData!, files: [] };
      return { hunks: [], totalLines: 10 };
    });
  await expect(
    f.bridge.adapter.reads!.expandContext!(
      { filePath: 'a.ts', contextLines: 5 },
      new AbortController().signal
    )
  ).resolves.toEqual({ hunks: [], totalLines: 10 });
  let release!: () => void;
  const sourceWrite = f.operations.apply(
    () =>
      new Promise<void>(resolve => {
        release = resolve;
      })
  );
  await flush();
  await expect(
    f.bridge.adapter.reads!.expandContext!(
      { filePath: 'a.ts', contextLines: 5 },
      new AbortController().signal
    )
  ).rejects.toThrow(/already in progress/);
  expect(expand).toHaveBeenCalledOnce();
  release();
  await sourceWrite;
});

it('refuses id collisions and foreign-frame cancellation; old ids never cancel a newer request', async () => {
  const f = setup();
  const signals: AbortSignal[] = [];
  vi.spyOn(f.review, 'loadImage').mockImplementation((_path, signal) => {
    signals.push(signal);
    return new Promise((_resolve, reject) =>
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    );
  });
  const first = f.invoke(IPC.CONTENT_READ, { id: '1', kind: 'image', filePath: 'a.png' });
  await flush();
  await expect(
    f.invoke(IPC.CONTENT_READ, { id: '1', kind: 'file', filePath: 'b.ts' })
  ).rejects.toThrow(/already pending/);
  f.handlers.get(IPC.CONTENT_CANCEL)!({ ...f.event, senderFrame: {} }, '1');
  expect(signals[0].aborted).toBe(false);
  await f.invoke(IPC.CONTENT_CANCEL, '1');
  expect(await first).toMatchObject({ kind: 'error' });
  await expect(
    f.invoke(IPC.CONTENT_READ, { id: '1', kind: 'image', filePath: 'b.png' })
  ).rejects.toThrow(/already used/);
  const second = f.invoke(IPC.CONTENT_READ, { id: '2', kind: 'image', filePath: 'b.png' });
  await flush();
  await f.invoke(IPC.CONTENT_CANCEL, '1');
  expect(signals[1].aborted).toBe(false);
  await f.invoke(IPC.CONTENT_CANCEL, '2');
  await second;
});

it('bounds ids, request metadata, context payloads and pending reads before work', async () => {
  const f = setup(1);
  const load = vi
    .spyOn(f.review, 'loadImage')
    .mockImplementation(
      (_path, signal) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener('abort', () => reject(signal.reason), { once: true })
        )
    );
  for (const input of [
    { id: 'x'.repeat(1000), kind: 'image', filePath: 'a.png' },
    { id: '1', kind: 'image', filePath: 'x'.repeat(4097) },
    { id: '1', kind: 'apply', filePath: 'a.ts' },
    { id: '1', kind: 'context', request: { filePath: 'a.ts', contextLines: -1 } },
    { id: '1', kind: 'image', filePath: 'a.png', extra: {} },
  ])
    await expect(f.invoke(IPC.CONTENT_READ, input)).rejects.toThrow();
  expect(load).not.toHaveBeenCalled();
  for (const channel of [IPC.DIFF_LOAD_IMAGE, IPC.DIFF_LOAD_FILE, IPC.ATTACHMENT_READ])
    await expect(f.invoke(channel, 'x'.repeat(4097))).rejects.toThrow(/request limits/);
  await expect(
    f.invoke(IPC.DIFF_EXPAND_CONTEXT, { filePath: 'x'.repeat(4097), contextLines: 5 })
  ).rejects.toThrow(/request limits/);
  expect(load).not.toHaveBeenCalled();
  const first = f.invoke(IPC.CONTENT_READ, { id: '1', kind: 'image', filePath: 'a.png' });
  await flush();
  expect(
    await f.invoke(IPC.CONTENT_READ, { id: '2', kind: 'file', filePath: 'a.ts' })
  ).toMatchObject({ kind: 'error', message: expect.stringMatching(/Too many/) });
  await f.invoke(IPC.CONTENT_CANCEL, '1');
  await first;
  expect(await f.invoke(IPC.CONTENT_READ, { id: '3', kind: 'file', filePath: 'a.ts' })).toEqual({
    kind: 'file',
    hunks: null,
  });
});

it('caps correlated reads at 32 even with spare desktop capacity and recovers after cancellation', async () => {
  const f = setup(64);
  const load = vi
    .spyOn(f.review, 'loadImage')
    .mockImplementation(
      (_path, signal) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener('abort', () => reject(signal.reason), { once: true })
        )
    );
  const requests = Array.from({ length: 32 }, (_, i) =>
    f.invoke(IPC.CONTENT_READ, { id: String(i + 1), kind: 'image', filePath: 'a.png' })
  );
  await flush();
  expect(load).toHaveBeenCalledTimes(32);
  await expect(
    f.invoke(IPC.CONTENT_READ, { id: '33', kind: 'image', filePath: 'a.png' })
  ).rejects.toThrow(/Too many pending content reads/);
  await f.invoke(IPC.CONTENT_CANCEL, '1');
  await requests[0];
  requests.push(f.invoke(IPC.CONTENT_READ, { id: '34', kind: 'image', filePath: 'a.png' }));
  await flush();
  expect(load).toHaveBeenCalledTimes(33);
  for (const id of [...Array.from({ length: 31 }, (_, i) => String(i + 2)), '34'])
    await f.invoke(IPC.CONTENT_CANCEL, id);
  await Promise.all(requests);
  expect(f.sender.listenerCount('render-process-gone')).toBe(0);
});

it.each(['replacement', 'renderer', 'shutdown', 'deadline'] as const)(
  'aborts reads and releases listener/timer ownership on %s',
  async reason => {
    vi.useFakeTimers();
    const f = setup();
    let signal!: AbortSignal;
    vi.spyOn(f.review, 'loadImage').mockImplementation((_path, input) => {
      signal = input;
      return new Promise((_resolve, reject) =>
        input.addEventListener('abort', () => reject(input.reason), { once: true })
      );
    });
    const reading = f.invoke(IPC.CONTENT_READ, { id: '1', kind: 'image', filePath: 'a.png' });
    await flush();
    if (reason === 'replacement') {
      f.session.diffData = { source: { type: 'welcome' }, files: [] };
      await vi.advanceTimersByTimeAsync(50);
    }
    if (reason === 'renderer') f.sender.emit('render-process-gone');
    if (reason === 'shutdown') await f.operations.dispose('shutdown');
    if (reason === 'deadline') await vi.advanceTimersByTimeAsync(30_000);
    expect(await reading).toMatchObject({ kind: 'error' });
    expect(signal.aborted).toBe(true);
    expect(f.sender.listenerCount('render-process-gone')).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  }
);

it('decodes useful attachment failures across the new protocol and preserves legacy missing-only null', async () => {
  const f = setup();
  const root = await mkdtemp(join(tmpdir(), 'desktop-attachment-errors-'));
  try {
    f.session.outputPathInfo = {
      resolvedOutputPath: join(root, 'review.xml'),
      outputPathWritable: true,
    };
    const assets = join(root, '.self-review-assets');
    await mkdir(assets);
    await writeFile(join(assets, 'good.png'), 'bytes');
    await mkdir(join(assets, 'directory.png'));
    await symlink(join(assets, 'good.png'), join(assets, 'link.png'));
    for (const path of ['.self-review-assets/missing.png']) {
      expect(await f.api.readAttachment(path)).toBeNull();
      expect(await f.bridge.adapter.readAttachment!(path)).toBeNull();
    }
    expect(
      Buffer.from(
        (await f.bridge.adapter.readAttachment!('.self-review-assets/good.png'))!
      ).toString()
    ).toBe('bytes');
    for (const path of [
      '/etc/passwd',
      '.self-review-assets/directory.png',
      '.self-review-assets/link.png',
    ]) {
      await expect(f.api.readAttachment(path)).rejects.toThrow();
      await expect(f.bridge.adapter.readAttachment!(path)).rejects.toMatchObject({
        message: expect.any(String),
        code: expect.any(String),
      });
    }
    const read = vi.spyOn(f.review, 'readAttachment');
    for (const reason of ['too-large', 'io-error'] as const) {
      read.mockResolvedValueOnce({ ok: false, reason, message: `Useful ${reason} detail` });
      await expect(
        f.bridge.adapter.readAttachment!('.self-review-assets/good.png')
      ).rejects.toMatchObject({ code: reason, message: `Useful ${reason} detail` });
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('coalesces pushed-event storms before preparation and delivers diff, guide and empty resume in order', async () => {
  const f = setup();
  f.session.guideData = { overview: 'guide', groups: [] };
  const diff = vi.spyOn(f.review, 'getDiffLoad');
  const config = vi.spyOn(f.review, 'getConfigLoad');
  const resume = vi.spyOn(f.review, 'getResumeLoad');
  for (let i = 0; i < 1000; i++) {
    f.api.requestDiffData();
    f.api.requestConfig();
    f.api.requestResumeData();
  }
  expect(diff).not.toHaveBeenCalled();
  await flush();
  expect(diff).toHaveBeenCalledOnce();
  expect(config).toHaveBeenCalledOnce();
  expect(resume).toHaveBeenCalledOnce();
  const order = f.sender.send.mock.calls.map(([channel]) => channel);
  expect(order.indexOf(IPC.DIFF_LOAD)).toBeLessThan(order.indexOf(IPC.GUIDE_LOAD));
  expect(order.indexOf(IPC.GUIDE_LOAD)).toBeLessThan(order.indexOf(IPC.RESUME_LOAD));
  expect(f.sender.send).toHaveBeenCalledWith(IPC.RESUME_LOAD, { comments: [], viewedFiles: [] });
  expect(f.sender.listenerCount('destroyed')).toBe(0);
});

it('refuses overload and oversized loads without fake readiness, then permits explicit recovery and later pushes', async () => {
  const f = setup(1);
  let release!: () => void;
  const occupying = f.operations.read(
    () =>
      new Promise<void>(resolve => {
        release = resolve;
      })
  );
  await flush();
  const busy = f.bridge.adapter.loadDiff();
  await expect(busy).rejects.toThrow(/Too many/);
  release();
  await occupying;
  await flush();
  const first = f.bridge.adapter.loadDiff();
  await expect(first).resolves.toMatchObject({ files: [] });
  await flush();
  f.session.diffData!.files = new Array(MAX_IPC_COLLECTION_ITEMS + 1);
  f.sender.send.mockClear();
  const refused = f.bridge.adapter.loadDiff();
  await expect(refused).rejects.toThrow(/delivery limits/);
  expect(f.sender.send.mock.calls.every(([channel]) => channel === IPC.CONTENT_REFUSED)).toBe(true);
  f.session.diffData!.files = [];
  await flush();
  await expect(f.bridge.adapter.loadDiff()).resolves.toMatchObject({ files: [] });
  await flush();
  const later = vi.fn();
  f.bridge.adapter.onDiffLoad!(later);
  f.api.requestDiffData();
  await flush();
  expect(later).toHaveBeenCalledOnce();
});

it('bounds raw metadata before file projection and skips retained hunks in metadata-only delivery', async () => {
  const f = setup();
  const unvisited = vi.fn(() => {
    throw new Error('hunks visited');
  });
  const file = {
    oldPath: 'a.ts',
    newPath: 'a.ts',
    changeType: 'added' as const,
    isBinary: false,
    get hunks(): never {
      return unvisited();
    },
  };
  f.session.diffData = {
    source: { type: 'directory', sourcePath: '/review' },
    isLargePayload: true,
    files: [file],
  };
  // preparePayload copies file properties. A plain retained array demonstrates the wire projection;
  // metadata text is rejected before preparePayload can touch a getter at all.
  f.session.diffData.source = {
    type: 'directory',
    sourcePath: 'x'.repeat(MAX_CONTENT_TEXT_BYTES / 2 + 1),
  };
  await expect(f.bridge.adapter.loadDiff()).rejects.toThrow(/delivery limits/);
  expect(unvisited).not.toHaveBeenCalled();
  file.oldPath = 'a.ts';
  Object.defineProperty(file, 'hunks', {
    value: new Array(MAX_IPC_COLLECTION_ITEMS + 1),
    enumerable: true,
  });
  f.session.diffData.source = { type: 'directory', sourcePath: '/review' };
  await flush();
  const result = await f.bridge.adapter.loadDiff();
  expect(result.files[0]).toMatchObject({ hunks: [], contentLoaded: false });
});

it('drops queued delivery after peer replacement', async () => {
  const f = setup();
  f.api.requestDiffData();
  f.replacePeer();
  await flush();
  expect(f.sender.send).not.toHaveBeenCalled();
});

it('refuses resume hydration with a refused diff and keeps the last good pushed payload', async () => {
  const f = setup();
  const received: unknown[] = [];
  f.bridge.adapter.onDiffLoad!(value => received.push(value));
  f.api.requestDiffData();
  await flush();
  expect(received).toHaveLength(1);
  f.session.diffData!.files = new Array(MAX_IPC_COLLECTION_ITEMS + 1);
  f.sender.send.mockClear();
  f.api.requestDiffData();
  f.api.requestResumeData();
  await flush();
  expect(received).toHaveLength(1);
  expect(f.sender.send).toHaveBeenCalledWith(
    IPC.CONTENT_REFUSED,
    expect.objectContaining({ kind: 'resume' })
  );
  expect(f.sender.send.mock.calls.some(([channel]) => channel === IPC.RESUME_LOAD)).toBe(false);
});

it('propagates the renderer deadline through preload cancellation', async () => {
  vi.useFakeTimers();
  const f = setup();
  const bridge = createElectronAdapter(f.api, new ElectronRequests(10));
  let signal!: AbortSignal;
  vi.spyOn(f.review, 'loadImage').mockImplementation((_path, input) => {
    signal = input;
    return new Promise((_resolve, reject) =>
      input.addEventListener('abort', () => reject(input.reason), { once: true })
    );
  });
  const reading = bridge.adapter.loadImage!('a.png');
  const rejected = expect(reading).rejects.toThrow(/timed out/);
  await flush();
  await vi.advanceTimersByTimeAsync(10);
  await rejected;
  expect(signal.aborted).toBe(true);
  bridge.dispose();
  expect(vi.getTimerCount()).toBe(0);
});
