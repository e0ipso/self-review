import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { IpcMainInvokeEvent } from 'electron';
import { CommandCancelledError } from '../../packages/core/src/forge-provider';
import { startDirectoryReview } from './directory-review';
import { DirectorySelection } from './directory-selection';
import { ReviewTransition } from './review-transition';
import { expect, it, vi } from 'vitest';
import { createReviewSession } from '../../packages/core/src/review-handlers';
import { bindDesktopReviewOperations } from './review-operations';
import { registerContentHandlers } from './content-ipc';
import { DesktopOperations } from './desktop-operations';
import { IPC } from '../shared/ipc-channels';
import type { createIpcBoundary } from './ipc-boundary';

it('registers content capabilities against supplied operations without engine module mocking', async () => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const register = (name: string, _decode: unknown, handler: (...args: unknown[]) => unknown) =>
    handlers.set(name, handler);
  const boundary = { onCommand: register, handleCommand: register } as unknown as ReturnType<
    typeof createIpcBoundary
  >;
  const read = vi.fn(async () => ({ dataUri: 'data:image/png;base64,AA==' }));
  registerContentHandlers(
    {
      getDiffLoad: () => null,
      getConfigLoad: () => null,
      getResumeLoad: () => null,
      getFileHunks: () => null,
      submitReviewState: vi.fn(),
      invalidateReviewState: vi.fn(),
      expandContext: async () => null,
      readAttachment: async () => ({ ok: false, reason: 'not-authorized', message: 'missing' }),
      loadImage: read,
    },
    boundary,
    new DesktopOperations()
  );
  expect(await handlers.get(IPC.DIFF_LOAD_IMAGE)!({}, 'a.png')).toEqual({
    dataUri: 'data:image/png;base64,AA==',
  });
  expect(read).toHaveBeenCalledWith('a.png', expect.any(AbortSignal));
});

it('binds current snapshot ownership and refuses mutations while publication owns the review', () => {
  const session = createReviewSession();
  let writable = true;
  const operations = bindDesktopReviewOperations(session, () => writable);
  const current = operations.captureSnapshot();
  current();
  session.diffData = { source: { type: 'welcome' }, files: [] };
  expect(current).toThrow(/session has changed/);
  writable = false;
  expect(() =>
    operations.submitReviewState({ timestamp: '', source: { type: 'welcome' }, files: [] })
  ).toThrow(/finishing/);
  expect(session.reviewState).toBeNull();
});

it('passes a directory operation cancellation through its bound engine before source loading', async () => {
  const root = await mkdtemp(join(tmpdir(), 'desktop-cancel-scan-'));
  try {
    await writeFile(join(root, 'a.ts'), 'unchanged\n');
    const session = createReviewSession();
    session.diffData = { source: { type: 'welcome' }, files: [] };
    const transition = new ReviewTransition(session);
    const capture = () => () => {};
    const selection = new DirectorySelection(transition, capture, async () => root);
    const event = {} as IpcMainInvokeEvent;
    await selection.choose(event);
    const boundary = { capture } as unknown as ReturnType<typeof createIpcBoundary>;
    const abort = new AbortController();
    abort.abort(new Error('window replaced'));
    await expect(
      startDirectoryReview(
        event,
        root,
        abort.signal,
        bindDesktopReviewOperations(session),
        boundary,
        transition,
        selection,
        { confirmPayload: vi.fn(async () => true) }
      )
    ).rejects.toBeInstanceOf(CommandCancelledError);
    expect(session.diffData.source.type).toBe('welcome');
    expect(session.reviewedPaths.size).toBe(0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('keeps the directory capture in the host while sending only the prepared payload', async () => {
  const root = await mkdtemp(join(tmpdir(), 'desktop-directory-capture-'));
  try {
    await writeFile(join(root, 'image.png'), Buffer.from([0, 255, 128]));
    const session = createReviewSession();
    session.diffData = { source: { type: 'welcome' }, files: [] };
    const review = bindDesktopReviewOperations(session);
    const prepared = await review.prepareDirectoryReview(root);
    vi.spyOn(review, 'prepareDirectoryReview').mockResolvedValue(prepared);
    const commit = vi.spyOn(review, 'commitReviewStart');
    const transition = new ReviewTransition(session);
    const capture = () => () => {};
    const selection = new DirectorySelection(transition, capture, async () => root);
    const event = {} as IpcMainInvokeEvent;
    await selection.choose(event);
    const send = vi.fn();
    const boundary = {
      capture,
      assertPeer: () => ({ webContents: { send } }),
    } as unknown as ReturnType<typeof createIpcBoundary>;
    await startDirectoryReview(
      event,
      root,
      new AbortController().signal,
      review,
      boundary,
      transition,
      selection,
      { confirmPayload: vi.fn(async () => true) }
    );
    expect(session.loadedReview).toBe(prepared.loadedReview);
    expect(commit).toHaveBeenCalledWith(prepared.payload, prepared.identity, prepared.loadedReview);
    expect(session.diffData).toBe(prepared.payload);
    expect(session.sourceIdentity).toBe(prepared.identity);
    expect(send.mock.calls.map(([channel]) => channel)).toEqual([IPC.DIFF_LOAD, IPC.RESUME_LOAD]);
    expect(send.mock.calls[1][1]).toEqual({ comments: [], viewedFiles: [] });
    expect(send.mock.calls[0][0]).toBe(IPC.DIFF_LOAD);
    expect(send.mock.calls[0][1]).not.toHaveProperty('loadedReview');
    expect(send.mock.calls[0][1]).not.toHaveProperty('identity');
    expect(await review.loadImage('image.png', new AbortController().signal)).toHaveProperty(
      'dataUri'
    );
    await writeFile(join(root, 'image.png'), Buffer.from([0, 1, 2, 3]));
    expect(await review.loadImage('image.png', new AbortController().signal)).toHaveProperty(
      'error'
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('binds authoritative attachment storage after authorization with the request signal', async () => {
  const session = createReviewSession();
  const reference = '.self-review-assets/photo.png';
  const target = '/virtual/original/.self-review-assets/photo.png';
  session.attachmentOrigins = new Map([[reference, target]]);
  const signal = new AbortController().signal;
  const result = { ok: true as const, data: new Uint8Array([0, 255, 128]).buffer };
  const reader = {
    calls: [] as string[],
    async readAssetFile(path: string, options: { signal?: AbortSignal }) {
      this.calls.push(path);
      expect(options.signal).toBe(signal);
      return result;
    },
  };
  const reportDiagnostic = vi.fn();
  const operations = bindDesktopReviewOperations(session, undefined, {
    attachmentReader: reader,
    reportDiagnostic,
  });
  expect(await operations.readAttachment('../secret', signal)).toMatchObject({
    ok: false,
    reason: 'not-authorized',
  });
  expect(reader.calls).toEqual([]);
  expect(await operations.readAttachment(reference, signal)).toBe(result);
  expect(reader.calls).toEqual([target]);
  expect(reportDiagnostic).toHaveBeenCalledExactlyOnceWith(
    '[attachment:read] Refused: "../secret"'
  );
});

it('preserves supplied attachment failure without native fallback', async () => {
  const session = createReviewSession();
  const reference = '.self-review-assets/photo.png';
  session.attachmentOrigins = new Map([
    [reference, '/virtual/original/.self-review-assets/photo.png'],
  ]);
  const error = new Error('supplied attachment store failed');
  const readAssetFile = vi.fn(async () => {
    throw error;
  });
  const operations = bindDesktopReviewOperations(session, undefined, {
    attachmentReader: { readAssetFile },
  });
  await expect(operations.readAttachment(reference, new AbortController().signal)).rejects.toBe(
    error
  );
  expect(readAssetFile).toHaveBeenCalledOnce();
});

it.each(['capture', 'throw', 'reject', 'default'] as const)(
  'routes desktop attachment diagnostics through the %s reporter without changing refusal',
  async mode => {
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reportDiagnostic = vi.fn((_message: string) => {
      if (mode === 'throw') throw new Error('diagnostic sink failed');
      if (mode === 'reject') return Promise.reject(new Error('diagnostic sink rejected'));
    });
    try {
      const operations = bindDesktopReviewOperations(
        createReviewSession(),
        undefined,
        mode === 'default' ? {} : { reportDiagnostic }
      );
      expect(
        await operations.readAttachment('../secret', new AbortController().signal)
      ).toMatchObject({ ok: false, reason: 'not-authorized' });
      const message = '[attachment:read] Refused: "../secret"';
      if (mode === 'default') {
        expect(stderr).toHaveBeenCalledExactlyOnceWith(message);
        expect(reportDiagnostic).not.toHaveBeenCalled();
      } else {
        expect(reportDiagnostic).toHaveBeenCalledExactlyOnceWith(message);
        expect(stderr).not.toHaveBeenCalled();
      }
    } finally {
      stderr.mockRestore();
    }
  }
);
