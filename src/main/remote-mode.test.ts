// src/main/remote-mode.test.ts
// Unit tests for the remote PR/MR session bootstrap. All core APIs
// (providers, materializer, mapper) are injected mocks — no real git, gh,
// or glab is ever spawned.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import type {
  ForgeProvider,
  ForgeThread,
  MaterializeResult,
} from '../../packages/core/src/index';
import { REVIEW_LEVEL_FILE_PATH } from '../../packages/core/src/index';
import type { DiffFile, ReviewComment, ReviewState } from '../shared/types';
import {
  startRemoteSession,
  bootstrapRemoteDiff,
  mergeRemoteThreads,
  applyRemoteProvenance,
  computeRemoteDrift,
  type RemoteSessionDeps,
} from './remote-mode';

const PR_URL = 'https://github.com/octo/repo/pull/42';
const MR_URL = 'https://gitlab.com/group/proj/-/merge_requests/7';

function makeThread(remoteId: string, filePath = 'src/a.ts'): ForgeThread {
  return {
    root: { remoteId, author: 'octocat', body: `thread ${remoteId}` },
    replies: [],
    anchor: {
      filePath,
      side: 'new',
      startLine: 3,
      endLine: 3,
      outdated: false,
    },
  };
}

function makeMaterializeResult(
  overrides: Partial<MaterializeResult> = {}
): MaterializeResult {
  return {
    repoPath: '/tmp/self-review-clone',
    baseSha: 'aaa111',
    headSha: 'bbb222',
    mode: 'temp-clone',
    cleanup: vi.fn(),
    ...overrides,
  };
}

function makeDeps(overrides: Partial<RemoteSessionDeps> = {}): RemoteSessionDeps {
  const provider: ForgeProvider = {
    forge: 'github',
    fetchBaseBranch: vi.fn(async () => 'main'),
    fetchThreads: vi.fn(async () => [makeThread('t1')]),
  };
  return {
    createProvider: vi.fn(() => provider),
    materialize: vi.fn(async () => makeMaterializeResult()),
    resolveRemoteDefaultBranch: vi.fn(async () => 'trunk'),
    runner: vi.fn(async () => ({ stdout: '', stderr: '', exitCode: 0 })),
    loadDiff: vi.fn(async (_args: string[], cwd: string) => ({
      files: [makeDiffFile('src/a.ts')],
      repository: cwd,
    })),
    ...overrides,
  };
}

function makeDiffFile(newPath: string): DiffFile {
  return {
    oldPath: newPath,
    newPath,
    changeType: 'modified',
    isBinary: false,
    hunks: [],
  };
}

// A ForgeCliUnavailableError lookalike built from the real class.
async function cliUnavailable(): Promise<never> {
  const { ForgeCliUnavailableError } = await import(
    '../../packages/core/src/index'
  );
  throw new ForgeCliUnavailableError('github', 'gh', 'gh not found');
}

describe('startRemoteSession', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('rejects a URL that is not a PR/MR URL', async () => {
    await expect(
      startRemoteSession('https://example.com/not-a-pr', '/cwd', makeDeps())
    ).rejects.toThrow(/not a recognized/i);
  });

  it('materializes with the provider base branch and yields the sha range', async () => {
    const deps = makeDeps();
    const session = await startRemoteSession(PR_URL, '/cwd', deps);

    expect(deps.createProvider).toHaveBeenCalledWith('github', deps.runner);
    expect(deps.materialize).toHaveBeenCalledWith(
      expect.objectContaining({ forge: 'github', owner: 'octo', repo: 'repo', number: 42 }),
      'main',
      '/cwd',
      deps.runner
    );
    expect(session.repoPath).toBe('/tmp/self-review-clone');
    expect(session.gitDiffArgs).toEqual(['aaa111...bbb222']);
    expect(session.mode).toBe('temp-clone');
    expect(session.remote).toEqual({
      remoteUrl: PR_URL,
      remoteBaseSha: 'aaa111',
      remoteHeadSha: 'bbb222',
      remoteForge: 'github',
      threadSyncAvailable: true,
    });
  });

  it('selects the gitlab provider for merge request URLs', async () => {
    const deps = makeDeps();
    const session = await startRemoteSession(MR_URL, '/cwd', deps);
    expect(deps.createProvider).toHaveBeenCalledWith('gitlab', deps.runner);
    expect(session.remote.remoteForge).toBe('gitlab');
  });

  it('maps fetched threads into review comments', async () => {
    const session = await startRemoteSession(PR_URL, '/cwd', makeDeps());
    expect(session.fetchedComments).toHaveLength(1);
    expect(session.fetchedComments[0]).toMatchObject({
      remoteId: 't1',
      author: 'octocat',
      filePath: 'src/a.ts',
    });
  });

  it('falls back to the git-only default branch when the forge CLI is unavailable', async () => {
    const provider: ForgeProvider = {
      forge: 'github',
      fetchBaseBranch: vi.fn(cliUnavailable),
      fetchThreads: vi.fn(async () => [makeThread('t1')]),
    };
    const deps = makeDeps({ createProvider: vi.fn(() => provider) });
    const session = await startRemoteSession(PR_URL, '/cwd', deps);

    expect(deps.resolveRemoteDefaultBranch).toHaveBeenCalled();
    expect(deps.materialize).toHaveBeenCalledWith(
      expect.anything(),
      'trunk',
      '/cwd',
      deps.runner
    );
    // Thread fetch is skipped entirely — the CLI is known unavailable.
    expect(provider.fetchThreads).not.toHaveBeenCalled();
    expect(session.fetchedComments).toEqual([]);
    expect(session.remote.threadSyncAvailable).toBe(false);
    // stderr note, no crash
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('thread sync unavailable')
    );
  });

  it('degrades cleanly when only the thread fetch fails', async () => {
    const provider: ForgeProvider = {
      forge: 'github',
      fetchBaseBranch: vi.fn(async () => 'main'),
      fetchThreads: vi.fn(cliUnavailable),
    };
    const deps = makeDeps({ createProvider: vi.fn(() => provider) });
    const session = await startRemoteSession(PR_URL, '/cwd', deps);

    expect(session.fetchedComments).toEqual([]);
    expect(session.remote.threadSyncAvailable).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('thread sync unavailable')
    );
  });

  it('propagates materialization failures as fatal errors', async () => {
    const deps = makeDeps({
      materialize: vi.fn(async () => {
        throw new Error('git clone failed (exit code 128)');
      }),
    });
    await expect(startRemoteSession(PR_URL, '/cwd', deps)).rejects.toThrow(
      /git clone failed/
    );
  });

  it('propagates non-CLI base-branch failures as fatal errors', async () => {
    const provider: ForgeProvider = {
      forge: 'github',
      fetchBaseBranch: vi.fn(async () => {
        throw new Error('PR not found');
      }),
      fetchThreads: vi.fn(async () => []),
    };
    const deps = makeDeps({ createProvider: vi.fn(() => provider) });
    await expect(startRemoteSession(PR_URL, '/cwd', deps)).rejects.toThrow(
      /PR not found/
    );
  });
});

describe('bootstrapRemoteDiff', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads the diff from the materialized clone and builds a git-mode payload', async () => {
    const deps = makeDeps();
    const { payload, session } = await bootstrapRemoteDiff(PR_URL, '/cwd', [], deps);

    expect(deps.loadDiff).toHaveBeenCalledWith(
      ['aaa111...bbb222'],
      '/tmp/self-review-clone'
    );
    expect(payload.source).toEqual({
      type: 'git',
      gitDiffArgs: 'aaa111...bbb222',
      repository: '/tmp/self-review-clone',
    });
    expect(payload.remote).toEqual(session.remote);
    expect(payload.files).toHaveLength(1);
  });

  it('applies the ignore filter to the loaded files', async () => {
    const deps = makeDeps({
      loadDiff: vi.fn(async (_args: string[], cwd: string) => ({
        files: [makeDiffFile('src/a.ts'), makeDiffFile('dist/bundle.js')],
        repository: cwd,
      })),
    });
    const { payload } = await bootstrapRemoteDiff(PR_URL, '/cwd', ['dist/**'], deps);
    expect(payload.files.map(f => f.newPath)).toEqual(['src/a.ts']);
  });
});

describe('mergeRemoteThreads', () => {
  function comment(id: string, remoteId?: string): ReviewComment {
    return {
      id,
      filePath: 'src/a.ts',
      lineRange: null,
      body: id,
      category: '',
      suggestion: null,
      ...(remoteId ? { remoteId } : {}),
    };
  }

  it('keeps the resumed copy when a fetched thread shares its remote id', () => {
    const resumed = [comment('resumed-1', 't1'), comment('local-1')];
    const fetched = [comment('fetched-1', 't1'), comment('fetched-2', 't2')];

    const merged = mergeRemoteThreads(resumed, fetched);

    expect(merged.map(c => c.id)).toEqual(['resumed-1', 'local-1', 'fetched-2']);
  });

  it('returns fetched threads unchanged when nothing was resumed', () => {
    const fetched = [comment('fetched-1', 't1')];
    expect(mergeRemoteThreads([], fetched)).toEqual(fetched);
  });

  it('does not mutate its inputs', () => {
    const resumed = [comment('resumed-1', 't1')];
    const fetched = [comment('fetched-1', 't2')];
    const resumedCopy = structuredClone(resumed);
    const fetchedCopy = structuredClone(fetched);
    mergeRemoteThreads(resumed, fetched);
    expect(resumed).toEqual(resumedCopy);
    expect(fetched).toEqual(fetchedCopy);
  });
});

describe('applyRemoteProvenance', () => {
  const remote = {
    remoteUrl: PR_URL,
    remoteBaseSha: 'aaa111',
    remoteHeadSha: 'bbb222',
    remoteForge: 'github' as const,
    threadSyncAvailable: true,
  };

  function makeState(): ReviewState {
    return {
      timestamp: '2026-08-04T00:00:00.000Z',
      source: { type: 'git', gitDiffArgs: 'aaa111...bbb222', repository: '/tmp/clone' },
      files: [],
    };
  }

  it('copies the four provenance fields onto the state', () => {
    const state = applyRemoteProvenance(makeState(), remote);
    expect(state.remoteUrl).toBe(PR_URL);
    expect(state.remoteBaseSha).toBe('aaa111');
    expect(state.remoteHeadSha).toBe('bbb222');
    expect(state.remoteForge).toBe('github');
  });

  it('does not mutate the input state', () => {
    const original = makeState();
    applyRemoteProvenance(original, remote);
    expect(original.remoteUrl).toBeUndefined();
  });
});

describe('computeRemoteDrift', () => {
  it('returns null when the resumed document recorded no head sha', () => {
    expect(computeRemoteDrift(undefined, 'bbb222')).toBeNull();
  });

  it('reports drift when the shas differ', () => {
    expect(computeRemoteDrift('old111', 'bbb222')).toEqual({
      recordedHeadSha: 'old111',
      liveHeadSha: 'bbb222',
      drifted: true,
    });
  });

  it('reports no drift when the shas match', () => {
    expect(computeRemoteDrift('bbb222', 'bbb222')).toEqual({
      recordedHeadSha: 'bbb222',
      liveHeadSha: 'bbb222',
      drifted: false,
    });
  });
});

describe('remote state assembly serializes to valid XML', () => {
  it('carries remote-* root attributes, keeps remote-id/author on fetched threads, and none on new material', async () => {
    const { serializeReview } = await import(
      '../../packages/core/src/xml-serializer'
    );
    const { mapThreadsToReviewComments } = await import(
      '../../packages/core/src/index'
    );

    const fetched = mapThreadsToReviewComments([
      makeThread('t1', 'src/a.ts'),
      // Anchor-less thread → review-level sentinel path ''.
      { root: { remoteId: 't2', author: 'octocat', body: 'overall' }, replies: [], anchor: null },
    ]);
    const local: ReviewComment = {
      id: 'local-1',
      filePath: 'src/a.ts',
      lineRange: null,
      body: 'my new finding',
      category: 'bug',
      suggestion: null,
    };

    const state: ReviewState = applyRemoteProvenance(
      {
        timestamp: '2026-08-04T00:00:00.000Z',
        source: { type: 'git', gitDiffArgs: 'aaa111...bbb222', repository: '/tmp/clone' },
        files: [
          {
            path: 'src/a.ts',
            changeType: 'modified',
            viewed: false,
            comments: [fetched[0], local],
          },
          {
            // Documented choice: review-level threads live in a file entry
            // on the sentinel path so every comment stays inside a
            // <file path="..."> element.
            path: REVIEW_LEVEL_FILE_PATH,
            changeType: 'modified',
            viewed: false,
            comments: [fetched[1]],
          },
        ],
      },
      {
        remoteUrl: PR_URL,
        remoteBaseSha: 'aaa111',
        remoteHeadSha: 'bbb222',
        remoteForge: 'github',
        threadSyncAvailable: true,
      }
    );

    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'self-review-test-'));
    try {
      const xml = await serializeReview(state, path.join(outDir, 'review.xml'));

      expect(xml).toContain(`remote-url="${PR_URL}"`);
      expect(xml).toContain('remote-base-sha="aaa111"');
      expect(xml).toContain('remote-head-sha="bbb222"');
      expect(xml).toContain('remote-forge="github"');
      expect(xml).toContain('remote-id="t1"');
      expect(xml).toContain('remote-id="t2"');
      expect(xml).toContain('author="octocat"');
      expect(xml).toContain('<file path=""');
      // The new local comment carries neither remote-id nor author: slice
      // from its own <comment opening tag to the body text.
      const bodyIdx = xml.indexOf('my new finding');
      const openIdx = xml.lastIndexOf('<comment', bodyIdx);
      const localBlock = xml.slice(openIdx, bodyIdx);
      expect(localBlock).not.toContain('remote-id=');
      expect(localBlock).not.toContain('author=');
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  });
});
