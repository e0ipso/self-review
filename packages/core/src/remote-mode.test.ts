// packages/core/src/remote-mode.test.ts
// Unit tests for the remote PR/MR session bootstrap. All core APIs
// (providers, materializer, mapper) are injected mocks — no real git, gh,
// or glab is ever spawned.

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import type {
  ForgeCommandResult,
  ForgeCommandRunner,
  ForgeProvider,
  ForgeThread,
  MaterializeResult,
} from './index';
import { CommandCancelledError, REVIEW_LEVEL_FILE_PATH } from './index';
import { DEFAULT_GIT_COMMAND_TIMEOUT_MS, materialize } from './materializer';
import { createIgnoreFilter } from './ignore-filter';
import { mapThreadsToReviewComments } from './thread-mapper';
import type { AppConfig, DiffFile, ReviewComment, ReviewState } from './types';
import type { LoadedConfig } from './config';
import { tokenizeGitDiffArgs } from './git-diff-args';
import { createGitLabProvider } from './gitlab-provider';
import { runFetchComments } from './fetch-comments';
import { gitSync } from './test-support/git-env';
import {
  startRemoteSession,
  bootstrapRemoteDiff,
  mergeRemoteThreads,
  applyRemoteProvenance,
  computeRemoteDrift,
  type RemoteSessionDeps,
} from './remote-mode';

// Wrapped real functions let one test inject a failure into the filter or map stage.
vi.mock('./ignore-filter', async importOriginal => {
  const actual = await importOriginal<typeof import('./ignore-filter')>();
  return { ...actual, createIgnoreFilter: vi.fn(actual.createIgnoreFilter) };
});
vi.mock('./thread-mapper', async importOriginal => {
  const actual = await importOriginal<typeof import('./thread-mapper')>();
  return { ...actual, mapThreadsToReviewComments: vi.fn(actual.mapThreadsToReviewComments) };
});

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

function makeMaterializeResult(overrides: Partial<MaterializeResult> = {}): MaterializeResult {
  return {
    repoPath: '/tmp/self-review-clone',
    baseSha: 'aaa111',
    headSha: 'bbb222',
    mode: 'temp-clone',
    ownedRefs: [],
    cleanup: vi.fn(async () => {}),
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
    detectExistingClone: vi.fn(async () => null),
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

/**
 * A modified file. With `newLines`, its new side carries those lines from
 * `start`, which is what the mapper reads to anchor a suggestion fence.
 */
function makeDiffFile(newPath: string, newLines: string[] = [], start = 3): DiffFile {
  return {
    oldPath: newPath,
    newPath,
    changeType: 'modified',
    isBinary: false,
    hunks:
      newLines.length === 0
        ? []
        : [
            {
              header: `@@ -${start},${newLines.length} +${start},${newLines.length} @@`,
              oldStart: start,
              oldLines: newLines.length,
              newStart: start,
              newLines: newLines.length,
              lines: newLines.map((content, index) => ({
                type: 'addition' as const,
                oldLineNumber: null,
                newLineNumber: start + index,
                content,
              })),
            },
          ],
  };
}

/** A thread anchored on `filePath` whose root body carries one fence. */
function makeSuggestionThread(filePath = 'src/a.ts'): ForgeThread {
  const base = makeThread('t1', filePath);
  return {
    ...base,
    root: {
      ...base.root,
      body: 'Prefer a constant.\n\n```suggestion\nconst b = 22;\n```\n',
    },
  };
}

function providerFor(threads: ForgeThread[]): ForgeProvider {
  return {
    forge: 'github',
    fetchBaseBranch: vi.fn(async () => 'main'),
    fetchThreads: vi.fn(async () => threads),
  };
}

// A ForgeCliUnavailableError lookalike built from the real class.
async function cliUnavailable(): Promise<never> {
  const { ForgeCliUnavailableError } = await import('./index');
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

    expect(deps.createProvider).toHaveBeenCalledWith('github', expect.any(Function));
    expect(deps.materialize).toHaveBeenCalledWith(
      expect.objectContaining({ forge: 'github', owner: 'octo', repo: 'repo', number: 42 }),
      'main',
      '/cwd',
      deps.runner,
      undefined,
      { signal: undefined }
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
      temporaryClone: true,
    });
  });

  it('selects the gitlab provider for merge request URLs', async () => {
    const deps = makeDeps();
    const session = await startRemoteSession(MR_URL, '/cwd', deps);
    expect(deps.createProvider).toHaveBeenCalledWith('gitlab', expect.any(Function));
    expect(session.remote.remoteForge).toBe('gitlab');
  });

  // No diff exists yet, so nothing is mapped; threads travel verbatim.
  it('carries the fetched threads verbatim and maps nothing before the diff exists', async () => {
    const session = await startRemoteSession(PR_URL, '/cwd', makeDeps());
    expect(session.fetchedThreads).toEqual([makeThread('t1')]);
    expect(session).not.toHaveProperty('fetchedComments');
  });

  it('forwards includeResolved to the provider', async () => {
    const deps = makeDeps();
    const provider = deps.createProvider('github', deps.runner);
    await startRemoteSession(PR_URL, '/cwd', deps, { includeResolved: true });
    expect(provider.fetchThreads).toHaveBeenCalledWith(expect.objectContaining({ number: 42 }), {
      includeResolved: true,
    });
  });

  // fetch-comments policy: a failed fetch is fatal and must not leak the clone.
  it("fails and releases the clone when threads are 'required' and the fetch is unavailable", async () => {
    const cleanup = vi.fn();
    const provider: ForgeProvider = {
      forge: 'github',
      fetchBaseBranch: vi.fn(async () => 'main'),
      fetchThreads: vi.fn(cliUnavailable),
    };
    const deps = makeDeps({
      createProvider: vi.fn(() => provider),
      materialize: vi.fn(async () => makeMaterializeResult({ cleanup })),
    });

    await expect(startRemoteSession(PR_URL, '/cwd', deps, { threads: 'required' })).rejects.toThrow(
      /gh/
    );
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("still attempts the thread fetch under 'required' when only the base-branch lookup lacked the CLI", async () => {
    const provider: ForgeProvider = {
      forge: 'github',
      fetchBaseBranch: vi.fn(cliUnavailable),
      fetchThreads: vi.fn(async () => [makeThread('t1')]),
    };
    const deps = makeDeps({ createProvider: vi.fn(() => provider) });

    const session = await startRemoteSession(PR_URL, '/cwd', deps, { threads: 'required' });

    expect(provider.fetchThreads).toHaveBeenCalledTimes(1);
    expect(session.fetchedThreads).toHaveLength(1);
    expect(session.remote.threadSyncAvailable).toBe(true);
  });

  it('falls back to the git-only default branch when the forge CLI is unavailable', async () => {
    const provider: ForgeProvider = {
      forge: 'github',
      fetchBaseBranch: vi.fn(cliUnavailable),
      fetchThreads: vi.fn(async () => [makeThread('t1')]),
    };
    const deps = makeDeps({ createProvider: vi.fn(() => provider) });
    const session = await startRemoteSession(PR_URL, '/cwd', deps);

    expect(deps.detectExistingClone).toHaveBeenCalledWith(expect.anything(), '/cwd', deps.runner, {
      signal: undefined,
    });
    expect(deps.resolveRemoteDefaultBranch).toHaveBeenCalledWith(
      expect.anything(),
      deps.runner,
      null,
      { signal: undefined }
    );
    expect(deps.materialize).toHaveBeenCalledWith(
      expect.anything(),
      'trunk',
      '/cwd',
      deps.runner,
      null,
      { signal: undefined }
    );
    // Thread fetch is skipped entirely — the CLI is known unavailable.
    expect(provider.fetchThreads).not.toHaveBeenCalled();
    expect(session.fetchedThreads).toEqual([]);
    expect(session.remote.threadSyncAvailable).toBe(false);
    // stderr note, no crash
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('thread sync unavailable'));
  });

  it('degrades cleanly when only the thread fetch fails', async () => {
    const provider: ForgeProvider = {
      forge: 'github',
      fetchBaseBranch: vi.fn(async () => 'main'),
      fetchThreads: vi.fn(cliUnavailable),
    };
    const deps = makeDeps({ createProvider: vi.fn(() => provider) });
    const session = await startRemoteSession(PR_URL, '/cwd', deps);

    expect(session.fetchedThreads).toEqual([]);
    expect(session.remote.threadSyncAvailable).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('thread sync unavailable'));
  });

  it('propagates materialization failures as fatal errors', async () => {
    const deps = makeDeps({
      materialize: vi.fn(async () => {
        throw new Error('git clone failed (exit code 128)');
      }),
    });
    await expect(startRemoteSession(PR_URL, '/cwd', deps)).rejects.toThrow(/git clone failed/);
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
    await expect(startRemoteSession(PR_URL, '/cwd', deps)).rejects.toThrow(/PR not found/);
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

    expect(deps.loadDiff).toHaveBeenCalledWith(['aaa111...bbb222'], '/tmp/self-review-clone');
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

  // SR-0037: expand-context tokenizes source.gitDiffArgs back into argv. A
  // plain join() passes the ordinary case and silently breaks the moment an
  // argument carries whitespace, so pin the round trip, not the string.
  it('renders a git-diff-args string that tokenizes back to the argv it loaded', async () => {
    const deps = makeDeps();
    const { payload, session } = await bootstrapRemoteDiff(PR_URL, '/cwd', [], deps);

    expect(payload.source.type).toBe('git');
    const rendered = (payload.source as { gitDiffArgs: string }).gitDiffArgs;
    // Sha ranges need no quoting, so the attribute keeps its historical shape.
    expect(rendered).toBe('aaa111...bbb222');
    expect(tokenizeGitDiffArgs(rendered)).toEqual(session.gitDiffArgs);
  });

  it('keeps the round trip intact for a ref whose name carries whitespace', async () => {
    const deps = makeDeps({
      materialize: vi.fn(async () =>
        makeMaterializeResult({ baseSha: 'release 1.0', headSha: "pr'42" })
      ),
    });
    const { payload, session } = await bootstrapRemoteDiff(PR_URL, '/cwd', [], deps);

    const rendered = (payload.source as { gitDiffArgs: string }).gitDiffArgs;
    expect(tokenizeGitDiffArgs(rendered)).toEqual(session.gitDiffArgs);
    expect(tokenizeGitDiffArgs(rendered)).toHaveLength(1);
  });

  // SR-0063: a `suggestion` fence only becomes a Suggestion when the mapper
  // is handed the reviewed diff, and that diff does not exist until loadDiff
  // returns — so the threads are mapped here, not in startRemoteSession.
  it('anchors a suggestion fence against the loaded diff', async () => {
    const deps = makeDeps({
      createProvider: vi.fn(() => providerFor([makeSuggestionThread()])),
      loadDiff: vi.fn(async (_args: string[], cwd: string) => ({
        files: [makeDiffFile('src/a.ts', ['const b = 2;'])],
        repository: cwd,
      })),
    });
    const { session } = await bootstrapRemoteDiff(PR_URL, '/cwd', [], deps);

    expect(session.fetchedComments).toHaveLength(1);
    expect(session.fetchedComments[0]).toMatchObject({ remoteId: 't1', filePath: 'src/a.ts' });
    expect(session.fetchedComments[0].suggestion).toEqual({
      originalCode: 'const b = 2;',
      proposedCode: 'const b = 22;',
    });
  });

  it('anchors against the ignore-filtered files the renderer receives', async () => {
    const deps = makeDeps({
      createProvider: vi.fn(() => providerFor([makeSuggestionThread('dist/bundle.js')])),
      loadDiff: vi.fn(async (_args: string[], cwd: string) => ({
        files: [makeDiffFile('dist/bundle.js', ['const b = 2;'])],
        repository: cwd,
      })),
    });
    const { payload, session } = await bootstrapRemoteDiff(PR_URL, '/cwd', ['dist/**'], deps);

    expect(payload.files).toEqual([]);
    // Nothing left to anchor against, so the fence stays plain body text
    // rather than a suggestion over code the reviewer never sees.
    expect(session.fetchedComments[0].suggestion).toBeNull();
    expect(session.fetchedComments[0].body).toContain('```suggestion');
  });

  it('keeps thread-sync degradation intact when the forge CLI is missing', async () => {
    const provider: ForgeProvider = {
      forge: 'github',
      fetchBaseBranch: vi.fn(cliUnavailable),
      fetchThreads: vi.fn(async () => [makeThread('t1')]),
    };
    const deps = makeDeps({ createProvider: vi.fn(() => provider) });
    const { session } = await bootstrapRemoteDiff(PR_URL, '/cwd', [], deps);

    expect(provider.fetchThreads).not.toHaveBeenCalled();
    expect(session.fetchedComments).toEqual([]);
    expect(session.remote.threadSyncAvailable).toBe(false);
  });

  it('cleans up the materialized clone when diff loading fails', async () => {
    const cleanup = vi.fn();
    const deps = makeDeps({
      materialize: vi.fn(async () => makeMaterializeResult({ cleanup })),
      loadDiff: vi.fn(async () => {
        throw new Error('fatal: bad revision');
      }),
    });
    await expect(bootstrapRemoteDiff(PR_URL, '/cwd', [], deps)).rejects.toThrow(
      'fatal: bad revision'
    );
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});

// App and fetch-comments must produce the same suggestions; one real repo, the real GitLab provider
// over a synthetic `glab` payload, both entry points end to end.
describe('GUI bootstrap and headless fetch-comments agree', () => {
  const MR = 'https://gitlab.com/group/proj/-/merge_requests/7';
  const FENCE = (proposal: string) => `Tighten this.\n\n\`\`\`suggestion\n${proposal}\n\`\`\`\n`;

  let repoPath: string;
  let baseSha: string;
  let headSha: string;

  beforeAll(() => {
    repoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'self-review-remote-parity-'));
    const git = (...args: string[]) => gitSync(args, { cwd: repoPath }).trim();
    git('-c', 'init.defaultBranch=main', 'init', '-q');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'Test');
    fs.mkdirSync(path.join(repoPath, 'src'));
    fs.mkdirSync(path.join(repoPath, 'dist'));
    fs.writeFileSync(path.join(repoPath, 'src/a.ts'), 'const a = 1;\nconst b = 2;\nconst c = 3;\n');
    fs.writeFileSync(path.join(repoPath, 'dist/bundle.js'), 'var x = 1;\n');
    git('add', '.');
    git('commit', '-q', '-m', 'base');
    baseSha = git('rev-parse', 'HEAD');
    git('checkout', '-q', '-b', 'feature');
    fs.writeFileSync(
      path.join(repoPath, 'src/a.ts'),
      'const a = 1;\nconst b = 20;\nconst c = 3;\n'
    );
    fs.writeFileSync(path.join(repoPath, 'dist/bundle.js'), 'var x = 10;\n');
    git('commit', '-q', '-a', '-m', 'change');
    headSha = git('rev-parse', 'HEAD');
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    vi.restoreAllMocks();
    fs.rmSync(repoPath, { recursive: true, force: true });
  });

  function position(filePath: string, newLine: number, positionHead: string) {
    return {
      position_type: 'text',
      head_sha: positionHead,
      old_path: filePath,
      new_path: filePath,
      old_line: null,
      new_line: newLine,
      line_range: null,
    };
  }

  /** A `glab` stand-in answering the MR lookup and the discussions list. */
  function glabRunner(discussions: unknown[]) {
    return async (_command: string, args: string[]) => ({
      stdout: JSON.stringify(
        args[1].endsWith('/discussions') ? discussions : { target_branch: 'main' }
      ),
      stderr: '',
      exitCode: 0,
    });
  }

  function sharedDeps(discussions: unknown[]): Partial<RemoteSessionDeps> {
    const runner = glabRunner(discussions);
    return {
      runner,
      createProvider: () => createGitLabProvider(runner),
      detectExistingClone: async () => null,
      resolveRemoteDefaultBranch: async () => 'main',
      materialize: async () => ({
        repoPath,
        baseSha,
        headSha,
        mode: 'existing-clone' as const,
        ownedRefs: [],
        cleanup: async () => {},
      }),
      // loadDiff is left to the real default: git runs over the repository.
    };
  }

  const shape = (c: ReviewComment) => ({
    remoteId: c.remoteId,
    filePath: c.filePath,
    lineRange: c.lineRange,
    suggestion: c.suggestion,
  });

  it('produces identical suggestions for the same forge payload, including for an ignored path', async () => {
    const discussions = [
      {
        id: 'd-src',
        notes: [
          {
            id: 101,
            body: FENCE('const b = B;'),
            author: { username: 'alice' },
            position: position('src/a.ts', 2, headSha),
          },
        ],
      },
      {
        id: 'd-dist',
        notes: [
          {
            id: 102,
            body: FENCE('var x = X;'),
            author: { username: 'alice' },
            position: position('dist/bundle.js', 1, headSha),
          },
        ],
      },
      {
        id: 'd-stale',
        notes: [
          {
            id: 103,
            body: FENCE('const c = C;'),
            author: { username: 'bob' },
            position: position('src/a.ts', 3, baseSha),
          },
        ],
      },
    ];
    const ignore = ['dist/**'];

    const { session, payload } = await bootstrapRemoteDiff(
      MR,
      repoPath,
      ignore,
      sharedDeps(discussions)
    );

    let published: ReviewState | undefined;
    await runFetchComments(MR, {
      cwd: repoPath,
      deps: {
        ...sharedDeps(discussions),
        publish: async (state, outputPath) => {
          published = state;
          return { outputPath, assetPaths: [] };
        },
        loadConfig: () => ({
          config: { outputFile: './review.xml', ignore } as AppConfig,
          provenance: { outputFile: 'default' } as LoadedConfig['provenance'],
          sources: [],
        }),
        now: () => new Date('2026-10-01T00:00:00.000Z'),
      },
    });

    const gui = session.fetchedComments;
    const headless = published!.files.flatMap(f => f.comments);
    const byId = (comments: ReviewComment[]) =>
      Object.fromEntries(comments.map(c => [c.remoteId, shape(c)]));
    expect(byId(headless)).toEqual(byId(gui));

    // The parity is not vacuous: the current-head thread on a reviewed file
    // is live, with its original code read out of the real diff.
    expect(byId(gui)['101'].suggestion).toEqual({
      originalCode: 'const b = 20;',
      proposedCode: 'const b = B;',
    });
    // The ignored path is absent from what the reviewer sees, so neither
    // front end anchors a suggestion over code the review never shows.
    expect(payload.files.map(f => f.newPath)).toEqual(['src/a.ts']);
    expect(byId(gui)['102'].suggestion).toBeNull();
    expect(gui.find(c => c.remoteId === '102')!.body).toContain('```suggestion');
    // The thread whose position names the base commit is outdated in both.
    expect(byId(gui)['103']).toEqual({
      remoteId: '103',
      filePath: 'src/a.ts',
      lineRange: null,
      suggestion: null,
    });
  });
});

// Whatever stage fails, the temp clone is gone and the signal honoured; scripted git runner over a
// real temp dir.
describe('session lifetime', () => {
  const BASE = 'a'.repeat(40);
  const HEAD = 'b'.repeat(40);

  function ok(stdout = ''): ForgeCommandResult {
    return { stdout, stderr: '', exitCode: 0 };
  }

  /** A git stand-in for the temp-clone path that can fail at one stage. */
  function scriptedGit(failAt?: 'clone' | 'fetch'): {
    runner: ForgeCommandRunner;
    tempDirs: string[];
    options: Array<Parameters<ForgeCommandRunner>[2]>;
  } {
    const tempDirs: string[] = [];
    const options: Array<Parameters<ForgeCommandRunner>[2]> = [];
    const runner: ForgeCommandRunner = async (_command, args, commandOptions) => {
      options.push(commandOptions);
      const sub = args[0] === '-C' ? args[2] : args[0];
      switch (sub) {
        case 'rev-parse': {
          const ref = args[args.length - 1];
          if (ref === '--show-toplevel') return { stdout: '', stderr: 'fatal: no', exitCode: 128 };
          if (ref.endsWith('/base')) return ok(`${BASE}\n`);
          if (ref.endsWith('/head')) return ok(`${HEAD}\n`);
          return { stdout: '', stderr: `fatal: unknown ${ref}`, exitCode: 128 };
        }
        case 'clone':
          tempDirs.push(args[args.length - 1]);
          if (failAt === 'clone') throw new Error('clone exploded');
          return ok();
        case 'fetch':
          if (failAt === 'fetch') throw new Error('fetch exploded');
          return ok();
        default:
          throw new Error(`unexpected git invocation: ${args.join(' ')}`);
      }
    };
    return { runner, tempDirs, options };
  }

  function lifetimeDeps(
    runner: ForgeCommandRunner,
    overrides: Partial<RemoteSessionDeps> = {}
  ): RemoteSessionDeps {
    return makeDeps({ runner, materialize, detectExistingClone: async () => null, ...overrides });
  }

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(['clone', 'fetch'] as const)(
    'leaves no temp clone behind when the %s stage throws',
    async stage => {
      const git = scriptedGit(stage);

      await expect(
        bootstrapRemoteDiff(PR_URL, '/cwd', [], lifetimeDeps(git.runner))
      ).rejects.toThrow(`${stage} exploded`);

      expect(git.tempDirs).toHaveLength(1);
      expect(fs.existsSync(git.tempDirs[0])).toBe(false);
    }
  );

  it('leaves no temp clone behind when the load stage throws', async () => {
    const git = scriptedGit();
    const deps = lifetimeDeps(git.runner, {
      loadDiff: vi.fn(async () => {
        throw new Error('load exploded');
      }),
    });

    await expect(bootstrapRemoteDiff(PR_URL, '/cwd', [], deps)).rejects.toThrow('load exploded');

    expect(fs.existsSync(git.tempDirs[0])).toBe(false);
  });

  it('leaves no temp clone behind when the filter stage throws', async () => {
    const git = scriptedGit();
    vi.mocked(createIgnoreFilter).mockImplementationOnce(() => {
      throw new Error('filter exploded');
    });

    await expect(
      bootstrapRemoteDiff(PR_URL, '/cwd', ['dist/**'], lifetimeDeps(git.runner))
    ).rejects.toThrow('filter exploded');

    expect(fs.existsSync(git.tempDirs[0])).toBe(false);
  });

  it('leaves no temp clone behind when the map stage throws', async () => {
    const git = scriptedGit();
    vi.mocked(mapThreadsToReviewComments).mockImplementationOnce(() => {
      throw new Error('map exploded');
    });

    await expect(bootstrapRemoteDiff(PR_URL, '/cwd', [], lifetimeDeps(git.runner))).rejects.toThrow(
      'map exploded'
    );

    expect(fs.existsSync(git.tempDirs[0])).toBe(false);
  });

  it('runs every git command under the session signal and the per-command timeout', async () => {
    const git = scriptedGit();
    const controller = new AbortController();

    const { session } = await bootstrapRemoteDiff(PR_URL, '/cwd', [], lifetimeDeps(git.runner), {
      signal: controller.signal,
    });
    await session.cleanup();

    expect(git.options.length).toBeGreaterThan(0);
    for (const options of git.options) {
      expect(options).toEqual({
        signal: controller.signal,
        timeoutMs: DEFAULT_GIT_COMMAND_TIMEOUT_MS,
      });
    }
  });

  it('hands the provider a runner bound to the same signal', async () => {
    const underlying = vi.fn(async () => ok('{}'));
    let providerRunner: ForgeCommandRunner | undefined;
    const provider = providerFor([]);
    const deps = makeDeps({
      runner: underlying,
      createProvider: vi.fn((_forge, runner) => {
        providerRunner = runner;
        return provider;
      }),
    });
    const controller = new AbortController();

    await startRemoteSession(PR_URL, '/cwd', deps, { signal: controller.signal });
    await providerRunner!('gh', ['api', 'x']);

    expect(underlying).toHaveBeenCalledWith('gh', ['api', 'x'], {
      signal: controller.signal,
      timeoutMs: DEFAULT_GIT_COMMAND_TIMEOUT_MS,
    });
  });

  it('does nothing when the signal is already aborted', async () => {
    const deps = makeDeps();

    await expect(
      startRemoteSession(PR_URL, '/cwd', deps, { signal: AbortSignal.abort() })
    ).rejects.toBeInstanceOf(CommandCancelledError);

    expect(deps.createProvider).not.toHaveBeenCalled();
    expect(deps.materialize).not.toHaveBeenCalled();
  });

  it("does not degrade a cancelled thread fetch under 'optional'; it releases the clone and rejects", async () => {
    const git = scriptedGit();
    const provider: ForgeProvider = {
      forge: 'github',
      fetchBaseBranch: vi.fn(async () => 'main'),
      fetchThreads: vi.fn(async () => {
        throw new CommandCancelledError('aborted', 'gh', ['api']);
      }),
    };
    const deps = lifetimeDeps(git.runner, { createProvider: vi.fn(() => provider) });

    await expect(startRemoteSession(PR_URL, '/cwd', deps)).rejects.toMatchObject({
      name: 'CommandCancelledError',
    });

    expect(fs.existsSync(git.tempDirs[0])).toBe(false);
  });

  it('honours an abort that lands during the diff load: no payload, no temp clone', async () => {
    const git = scriptedGit();
    const controller = new AbortController();
    const deps = lifetimeDeps(git.runner, {
      loadDiff: vi.fn(async (_args: string[], cwd: string) => {
        controller.abort();
        return { files: [makeDiffFile('src/a.ts')], repository: cwd };
      }),
    });

    await expect(
      bootstrapRemoteDiff(PR_URL, '/cwd', [], deps, { signal: controller.signal })
    ).rejects.toMatchObject({ name: 'CommandCancelledError', reason: 'aborted' });

    expect(fs.existsSync(git.tempDirs[0])).toBe(false);
  });

  it('awaits an asynchronous cleanup before a failure propagates', async () => {
    let released = false;
    const cleanup = vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      released = true;
    });
    const deps = makeDeps({
      materialize: vi.fn(async () => makeMaterializeResult({ cleanup })),
      loadDiff: vi.fn(async () => {
        throw new Error('load exploded');
      }),
    });

    await expect(bootstrapRemoteDiff(PR_URL, '/cwd', [], deps)).rejects.toThrow('load exploded');

    expect(released).toBe(true);
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
    temporaryClone: false,
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
    const { serializeReview } = await import('./xml-serializer');
    const { mapThreadsToReviewComments } = await import('./index');

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
        temporaryClone: false,
      }
    );

    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'self-review-test-'));
    try {
      const { xml } = await serializeReview(state, path.join(outDir, 'review.xml'));

      expect(xml).toContain(`remote-url="${PR_URL}"`);
      // The three source shapes are mutually exclusive: a remote save must
      // not also carry the local-git source attributes.
      expect(xml).not.toContain('git-diff-args=');
      expect(xml).not.toContain('repository=');
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
