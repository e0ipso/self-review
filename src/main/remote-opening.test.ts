import { afterEach, expect, it, vi } from 'vitest';
import { createDesktopSession } from './desktop-session';
import { createRemoteOpeningOperation, REMOTE_OPEN_TIMEOUT_MS } from './remote-opening';
import { bindRemoteOpening } from './remote-opening-binding';
import { commitDiffData } from '../../packages/core/src/review-handlers';
import { parseForgeUrl } from '../../packages/core/src/forge-provider';
import type { RemoteBootstrapResult } from '../../packages/core/src/remote-mode';
import type { DiffLoadPayload, GuideLoadPayload, ResumeLoadPayload } from '../shared/types';
import { IPC } from '../shared/ipc-channels';
import { MAX_CONTENT_TEXT_BYTES } from './content-budget';
import { registerRemoteOpenHandler } from './remote-open-handler';
import type { createIpcBoundary } from './ipc-boundary';
import type { IpcMainInvokeEvent } from 'electron';
import { EventEmitter } from 'node:events';

const url = 'https://github.com/owner/repo/pull/1';
function result(): RemoteBootstrapResult {
  const remote = {
    remoteUrl: url,
    remoteBaseSha: 'b'.repeat(40),
    remoteHeadSha: 'a'.repeat(40),
    remoteForge: 'github' as const,
    threadSyncAvailable: true,
    temporaryClone: false,
  };
  return {
    session: {
      forgeUrl: parseForgeUrl(url)!,
      repoPath: '/review',
      gitDiffArgs: ['base...head'],
      mode: 'existing-clone',
      cleanup: vi.fn(async () => {}),
      remote,
      fetchedThreads: [],
      fetchedComments: [],
    },
    payload: {
      source: { type: 'git', repository: '/review', gitDiffArgs: 'base...head' },
      files: [],
      remote,
    },
    identity: {
      mode: 'remote',
      sourceRoot: '/review',
      invocationCwd: '/launch',
      gitDiffArgv: ['base...head'],
      pathPrefix: '',
      oldSide: { kind: 'commit', sha: remote.remoteBaseSha },
      newSide: { kind: 'commit', sha: remote.remoteHeadSha },
    },
  };
}
function fixture() {
  const desktop = createDesktopSession('/launch');
  const welcome = { source: { type: 'welcome' as const }, files: [] };
  desktop.review.diffData = welcome;
  const acquired = result();
  const acquire = vi.fn(async () => acquired);
  const guide = vi.fn<
    (payload: DiffLoadPayload, signal: AbortSignal) => Promise<GuideLoadPayload | null>
  >(async () => null);
  const adopt = vi.fn(
    (loaded: RemoteBootstrapResult, guide: GuideLoadPayload | null, resume: ResumeLoadPayload) => {
      commitDiffData(desktop.review, loaded.payload, loaded.identity);
      desktop.review.guideData = guide;
      desktop.review.resumeComments = resume.comments;
      desktop.remoteInfo = loaded.session.remote;
    }
  );
  const open = createRemoteOpeningOperation({
    remote: desktop.remote,
    transition: desktop.transition,
    acquire,
    loadGuide: guide,
    adopt,
  });
  const abort = new AbortController();
  const owner = {
    signal: abort.signal,
    assertCurrent: vi.fn(),
    confirm: vi.fn(async () => true),
    send: vi.fn(),
  };
  return { desktop, welcome, acquired, acquire, guide, adopt, open, abort, owner };
}
afterEach(() => vi.useRealTimers());

it.each(['diff', 'guide', 'resume'] as const)(
  'rejects oversized %s before adopting or sending a replacement',
  async piece => {
    const f = fixture();
    const huge = 'x'.repeat(MAX_CONTENT_TEXT_BYTES / 2 + 1);
    const comments = [
      {
        id: 'prior',
        filePath: '',
        body: 'prior',
        lineRange: null,
        category: 'note',
        suggestion: null,
      },
    ];
    f.desktop.review.resumeComments = comments;
    const identity = f.desktop.review.sourceIdentity;
    const membership = f.desktop.review.reviewedPaths;
    if (piece === 'diff') f.acquired.payload.diagnostics = [huge];
    if (piece === 'guide') f.guide.mockResolvedValue({ overview: huge, groups: [] });
    if (piece === 'resume') f.acquired.session.fetchedComments = [{ ...comments[0], body: huge }];
    await expect(f.open(url, f.owner)).rejects.toThrow(/delivery limits/);
    expect(f.desktop.review.diffData).toBe(f.welcome);
    expect(f.desktop.review.sourceIdentity).toBe(identity);
    expect(f.desktop.review.reviewedPaths).toBe(membership);
    expect(f.desktop.review.resumeComments).toBe(comments);
    expect(f.desktop.remoteInfo).toBeNull();
    expect(f.adopt).not.toHaveBeenCalled();
    expect(f.owner.send).not.toHaveBeenCalled();
    expect(f.acquired.session.cleanup).toHaveBeenCalledOnce();
    const retry = result();
    await f.desktop.remote.open(async () => retry);
    await f.desktop.remote.dispose('test finished');
    expect(retry.session.cleanup).toHaveBeenCalledOnce();
  }
);

it('validates the real lazy projection and preserves mutable host aliases', async () => {
  const f = fixture();
  f.acquired.payload.isLargePayload = true;
  const hunks = [
    {
      header: 'x'.repeat(MAX_CONTENT_TEXT_BYTES / 2 + 1),
      oldStart: 0,
      oldLines: 0,
      newStart: 1,
      newLines: 0,
      lines: [],
    },
  ];
  f.acquired.payload.files = [
    { oldPath: '', newPath: 'a.ts', changeType: 'added', isBinary: false, hunks },
  ];
  f.guide.mockResolvedValue({ overview: 'guide', groups: [] });
  try {
    expect(await f.open(url, f.owner)).toBe(true);
    expect(f.desktop.review.diffData).toBe(f.acquired.payload);
    expect(f.desktop.review.sourceIdentity).toBe(f.acquired.identity);
    expect(f.acquired.payload.files[0].hunks).toBe(hunks);
    expect(f.owner.send.mock.calls.map(([channel]) => channel)).toEqual([
      IPC.DIFF_LOAD,
      IPC.GUIDE_LOAD,
      IPC.RESUME_LOAD,
    ]);
    expect(f.owner.send.mock.calls[0][1]).toMatchObject({
      files: [{ hunks: [], contentLoaded: false }],
    });
    expect(f.owner.send.mock.calls[2][1]).toEqual({ comments: [], viewedFiles: [] });
    expect(f.acquired.session.cleanup).not.toHaveBeenCalled();
  } finally {
    await f.desktop.remote.dispose('test finished');
  }
});

it.each(['cancel', 'peer', 'transition', 'decline'] as const)(
  'preserves the old review on %s before adoption',
  async reason => {
    const f = fixture();
    f.owner.confirm.mockImplementation(async () => {
      if (reason === 'cancel') f.abort.abort(new Error('cancelled by owner'));
      if (reason === 'peer')
        f.owner.assertCurrent.mockImplementation(() => {
          throw new Error('peer replaced');
        });
      if (reason === 'transition')
        f.desktop.review.diffData = { source: { type: 'welcome' }, files: [] };
      return reason !== 'decline';
    });
    if (reason === 'decline') expect(await f.open(url, f.owner)).toBe(false);
    else await expect(f.open(url, f.owner)).rejects.toThrow();
    expect(f.adopt).not.toHaveBeenCalled();
    expect(f.owner.send).not.toHaveBeenCalled();
    expect(f.acquired.session.cleanup).toHaveBeenCalledOnce();
  }
);

it('a stale failed opening never releases a newer remote owner', async () => {
  const f = fixture();
  const newer = result();
  f.guide.mockImplementation(async () => {
    await f.desktop.remote.cancelOpen();
    await f.desktop.remote.open(async () => newer);
    f.owner.assertCurrent.mockImplementation(() => {
      throw new Error('peer replaced');
    });
    return null;
  });
  try {
    await expect(f.open(url, f.owner)).rejects.toThrow(/peer replaced/);
    expect(f.acquired.session.cleanup).toHaveBeenCalledOnce();
    expect(newer.session.cleanup).not.toHaveBeenCalled();
    expect(f.owner.send).not.toHaveBeenCalled();
  } finally {
    await f.desktop.remote.dispose('test finished');
  }
  expect(newer.session.cleanup).toHaveBeenCalledOnce();
});

it('does not release an adopted remote or send readiness when its peer is lost during delivery', async () => {
  const f = fixture();
  f.owner.send.mockImplementation(() => {
    f.owner.assertCurrent.mockImplementation(() => {
      throw new Error('peer lost');
    });
  });
  try {
    await expect(f.open(url, f.owner)).rejects.toThrow(/peer lost/);
    expect(f.desktop.review.diffData).toBe(f.acquired.payload);
    expect(f.acquired.session.cleanup).not.toHaveBeenCalled();
    expect(f.owner.send.mock.calls.map(([channel]) => channel)).toEqual([IPC.DIFF_LOAD]);
  } finally {
    await f.desktop.remote.dispose('test finished');
  }
});

it('retains remote and transition admission until deadline-cancelled guide work settles', async () => {
  vi.useFakeTimers();
  const f = fixture();
  let release!: () => void;
  let guideSignal!: AbortSignal;
  f.guide.mockImplementation((_payload, signal) => {
    guideSignal = signal;
    return new Promise(resolve => {
      release = () => resolve(null);
    });
  });
  const opening = f.open(url, f.owner);
  const rejected = expect(opening).rejects.toThrow(/longer than 10 minutes/);
  for (let i = 0; i < 15; i++) await Promise.resolve();
  await vi.advanceTimersByTimeAsync(REMOTE_OPEN_TIMEOUT_MS);
  expect(guideSignal.aborted).toBe(true);
  expect(f.acquired.session.cleanup).not.toHaveBeenCalled();
  await expect(f.open(url, f.owner)).rejects.toThrow(/already being opened/);
  release();
  await rejected;
  expect(f.acquired.session.cleanup).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});

it('the registrar authenticates and maps results from a supplied application operation', async () => {
  const f = fixture();
  const window = Object.assign(new EventEmitter(), { webContents: { send: vi.fn() } });
  let invoke!: (event: IpcMainInvokeEvent, url: string) => Promise<unknown>;
  const boundary = {
    capture: () => () => {},
    assertPeer: () => window,
    handleCommand: (_channel: string, _decode: unknown, handler: typeof invoke) => {
      invoke = handler;
    },
  } as unknown as ReturnType<typeof createIpcBoundary>;
  const supplied = vi.fn<ReturnType<typeof bindRemoteOpening>>(async () => false);
  registerRemoteOpenHandler(f.desktop, boundary, { confirmPayload: async () => true }, supplied);
  expect(await invoke({} as IpcMainInvokeEvent, url)).toEqual({
    ok: false,
    error: 'Review cancelled.',
  });
  expect(supplied).toHaveBeenCalledWith(
    url,
    expect.objectContaining({
      signal: expect.any(AbortSignal),
      assertCurrent: expect.any(Function),
    })
  );
  expect(window.listenerCount('closed')).toBe(0);
  expect(await invoke({} as IpcMainInvokeEvent, 'invalid')).toEqual({
    ok: false,
    error: 'Enter a GitHub PR or GitLab MR URL.',
  });
  expect(supplied).toHaveBeenCalledOnce();
});

it('owns cooperative preparation cancellation through release of only the newly acquired remote', async () => {
  const { setImmediate } = await import('node:timers/promises');
  const f = fixture();
  f.acquired.payload.files = [
    {
      oldPath: '',
      newPath: 'a.ts',
      changeType: 'added',
      isBinary: false,
      hunks: [
        {
          header: '@@ -0,0 +1,100000 @@',
          oldStart: 0,
          oldLines: 0,
          newStart: 1,
          newLines: 100000,
          lines: Array.from({ length: 100000 }, (_, i) => ({
            type: 'addition',
            content: '',
            newLineNumber: i + 1,
            oldLineNumber: null,
          })),
        },
      ],
    },
  ];
  const work = f.open(url, f.owner);
  const rejected = expect(work).rejects.toThrow('cancelled during preparation');
  await setImmediate();
  expect(f.adopt).not.toHaveBeenCalled();
  expect(f.acquired.session.cleanup).not.toHaveBeenCalled();
  f.abort.abort(new Error('cancelled during preparation'));
  await rejected;
  expect(f.desktop.review.diffData).toBe(f.welcome);
  expect(f.adopt).not.toHaveBeenCalled();
  expect(f.owner.send).not.toHaveBeenCalled();
  expect(f.acquired.session.cleanup).toHaveBeenCalledOnce();
});
