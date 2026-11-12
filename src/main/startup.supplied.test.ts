import { expect, it, vi } from 'vitest';
import { initializeSession } from './startup';
import { createDesktopSession } from './desktop-session';
import type { StartupOperations, StartupPlan } from './startup-operations';
import { DEFAULT_CONFIG } from '../../packages/react/src/config-defaults';

function fixture() {
  const desktop = createDesktopSession(process.cwd());
  const plan: StartupPlan = {
    config: DEFAULT_CONFIG,
    gitDiffArgs: [],
    source: { mode: 'welcome' },
    output: desktop.output,
    remoteUrl: null,
    resumeFrom: null,
  };
  const operations: StartupOperations = {
    prepare: vi.fn(async () => plan),
    loadLocal: vi.fn(async () => ({
      payload: { files: [], source: { type: 'welcome' as const } },
      identity: null,
    })),
    loadRemote: vi.fn(async () => {
      throw new Error('unexpected remote load');
    }),
    resume: vi.fn(async () => ({
      comments: [],
      viewedFiles: ['a.ts'],
      gitDiffArgs: '',
      source: { type: 'welcome' as const },
      importDiagnostics: [],
    })),
    guide: vi.fn(async () => null),
    reportDiagnostic: vi.fn(),
  };
  return { desktop, plan, operations };
}
it('uses only supplied startup effects and preserves the launch directory and signal', async () => {
  const { desktop, operations, plan } = fixture();
  const confirm = vi.fn(async () => true);
  await expect(initializeSession(desktop, undefined, confirm, operations)).resolves.toBe(true);
  expect(operations.prepare).toHaveBeenCalledWith(desktop.cwd, desktop.operations.signal);
  expect(operations.loadLocal).toHaveBeenCalledWith(plan, desktop.cwd, desktop.operations.signal);
  expect(confirm).not.toHaveBeenCalled();
  expect(desktop.review.diffData?.source.type).toBe('welcome');
});
it('waits for supplied resume hydration before reporting startup ready', async () => {
  const { desktop, operations, plan } = fixture();
  plan.resumeFrom = 'previous.xml';
  let release!: () => void;
  operations.resume = vi.fn(async () => {
    await new Promise<void>(resolve => {
      release = resolve;
    });
    return {
      comments: [],
      viewedFiles: ['a.ts'],
      gitDiffArgs: '',
      source: { type: 'welcome' as const },
      importDiagnostics: [],
    };
  });
  let ready = false;
  const pending = initializeSession(desktop, undefined, async () => true, operations).then(
    result => {
      ready = result;
    }
  );
  await vi.waitFor(() => expect(operations.resume).toHaveBeenCalled());
  expect(ready).toBe(false);
  expect(operations.resume).toHaveBeenCalledWith(
    desktop.review,
    `${desktop.cwd}/previous.xml`,
    desktop.operations.signal
  );
  release();
  await pending;
  expect(ready).toBe(true);
  expect(desktop.review.resumeViewedFiles).toEqual(['a.ts']);
});
it('rejects a load completed after cancellation without committing its diff', async () => {
  const { desktop, operations } = fixture();
  const abort = new AbortController();
  operations.loadLocal = async () => {
    abort.abort(new Error('expired'));
    return { payload: { files: [], source: { type: 'welcome' as const } }, identity: null };
  };
  await expect(
    initializeSession(desktop, abort.signal, async () => true, operations)
  ).rejects.toThrow('expired');
  expect(desktop.review.diffData).toBeNull();
});

it('keeps a declined native load uncommitted and never loads resume or guide', async () => {
  const { desktop, operations, plan } = fixture();
  plan.source = { mode: 'directory', sourcePath: desktop.cwd };
  operations.loadLocal = async () => ({
    payload: { files: [], source: { type: 'directory', sourcePath: desktop.cwd } },
    identity: null,
  });
  plan.resumeFrom = 'previous.xml';
  await expect(initializeSession(desktop, undefined, async () => false, operations)).resolves.toBe(
    false
  );
  expect(desktop.review.diffData).toBeNull();
  expect(operations.resume).not.toHaveBeenCalled();
  expect(operations.guide).not.toHaveBeenCalled();
});
it('commits the supplied identity and loads read-only guide paths using the launch cwd', async () => {
  const { desktop, operations, plan } = fixture();
  const { cwd } = desktop;
  plan.source = { mode: 'directory', sourcePath: cwd };
  const identity: import('../shared/types').ReviewSourceIdentity = {
    mode: 'directory',
    sourceRoot: cwd,
    invocationCwd: cwd,
    gitDiffArgv: [],
    pathPrefix: '',
    oldSide: { kind: 'none' },
    newSide: { kind: 'directory' },
  };
  operations.loadLocal = async () => ({
    payload: {
      files: [{ oldPath: '', newPath: 'a.ts', hunks: [], changeType: 'added', isBinary: false }],
      source: { type: 'directory', sourcePath: cwd },
    },
    identity,
  });
  await initializeSession(desktop, undefined, async () => true, operations);
  expect(desktop.review.sourceIdentity).toBe(identity);
  expect(desktop.review.reviewedPaths.has('a.ts')).toBe(true);
  expect(operations.guide).toHaveBeenCalledWith(plan.output.path, plan.config, ['a.ts'], {
    cwd,
    reportDiagnostic: operations.reportDiagnostic,
  });
});
it('keeps remote cleanup owned through confirmation, resume drift, and guide loading', async () => {
  const { desktop, operations, plan } = fixture();
  plan.source = { mode: 'remote' };
  plan.remoteUrl = 'https://github.com/example/repo/pull/1';
  plan.resumeFrom = 'previous.xml';
  const cleanup = vi.fn(async () => {});
  const remote = {
    remoteUrl: plan.remoteUrl,
    remoteBaseSha: 'base',
    remoteHeadSha: 'live',
    remoteForge: 'github' as const,
    temporaryClone: true,
    threadSyncAvailable: true,
  };
  operations.resume = async session => {
    session.resumeImportDiagnostics = ['Kept feedback visible.'];
    return {
      comments: [],
      viewedFiles: [],
      gitDiffArgs: '',
      source: { type: 'welcome' },
      importDiagnostics: [],
      remoteHeadSha: 'recorded',
    };
  };
  operations.loadRemote = vi.fn(async () => ({
    payload: {
      files: [],
      source: { type: 'git' as const, repository: desktop.cwd, gitDiffArgs: 'base...live' },
    },
    identity: {
      mode: 'remote' as const,
      sourceRoot: desktop.cwd,
      invocationCwd: desktop.cwd,
      gitDiffArgv: ['base...live'],
      pathPrefix: '',
      oldSide: { kind: 'commit' as const, sha: 'base' },
      newSide: { kind: 'commit' as const, sha: 'live' },
    },
    session: {
      remote,
      cleanup,
      fetchedComments: [],
      fetchedThreads: [],
      repoPath: desktop.cwd,
      gitDiffArgs: ['base...live'],
      mode: 'temp-clone' as const,
      forgeUrl: {
        forge: 'github' as const,
        host: 'github.com',
        owner: 'example',
        repo: 'repo',
        number: 1,
      },
    },
  }));
  await expect(initializeSession(desktop, undefined, async () => true, operations)).resolves.toBe(
    true
  );
  expect(operations.loadLocal).not.toHaveBeenCalled();
  expect(operations.loadRemote).toHaveBeenCalledWith(
    plan.remoteUrl,
    desktop.cwd,
    plan.config.ignore,
    expect.any(AbortSignal)
  );
  expect(desktop.remoteInfo).toBe(remote);
  expect(desktop.review.resumeRemoteDrift).toEqual({
    recordedHeadSha: 'recorded',
    liveHeadSha: 'live',
    drifted: true,
  });
  expect(operations.reportDiagnostic).toHaveBeenCalledWith(
    '[main] Resume import: Kept feedback visible.'
  );
  expect(cleanup).not.toHaveBeenCalled();
  await desktop.remote.dispose('done');
  expect(cleanup).toHaveBeenCalledOnce();
});
