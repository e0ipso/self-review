// materializer.test.ts
// Tests for the clone-aware diff materializer. The scripted-runner suites
// never spawn git; the session-ownership suite drives the real materializer
// over a real local clone of a bare "forge" repository, because the ref
// race it pins only exists against real refs.

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { ForgeCommandResult, ForgeCommandRunner, ForgeUrl } from './forge-provider';
import { CommandCancelledError } from './forge-provider';
import { gitSync } from './test-support/git-env';
import {
  defaultGitRunner,
  detectExistingClone,
  materialize,
  resolveRemoteDefaultBranch,
} from './materializer';
import type { MaterializeResult } from './materializer';

const BASE_SHA = 'a'.repeat(40);
const HEAD_SHA = 'b'.repeat(40);

const githubUrl: ForgeUrl = {
  forge: 'github',
  host: 'github.com',
  owner: 'e0ipso',
  repo: 'self-review',
  number: 126,
};

const gitlabUrl: ForgeUrl = {
  forge: 'gitlab',
  host: 'gitlab.example.com',
  owner: 'group/subgroup',
  repo: 'project',
  number: 42,
};

const SESSION_BASE_REF = /^refs\/self-review\/[^/]+\/base$/;
const SESSION_HEAD_REF = /^refs\/self-review\/[^/]+\/head$/;

function ok(stdout = ''): ForgeCommandResult {
  return { stdout, stderr: '', exitCode: 0 };
}

function fail(stderr: string, exitCode = 128): ForgeCommandResult {
  return { stdout: '', stderr, exitCode };
}

type Handler =
  | ForgeCommandResult
  | ((args: string[], options?: Parameters<ForgeCommandRunner>[2]) => ForgeCommandResult);

/**
 * Build a scripted runner. Handlers are keyed by git subcommand (the first
 * argument after an optional `-C <dir>` pair) and receive the args with the
 * `-C <dir>` prefix stripped. Every call is recorded verbatim in `calls`.
 */
function createRunner(handlers: Record<string, Handler>): {
  runner: ForgeCommandRunner;
  calls: string[][];
} {
  const calls: string[][] = [];
  const runner: ForgeCommandRunner = async (command, args, options) => {
    calls.push([command, ...args]);
    let stripped = args;
    if (stripped[0] === '-C') {
      stripped = stripped.slice(2);
    }
    const handler = handlers[stripped[0]];
    if (handler === undefined) {
      throw new Error(`unexpected git invocation: ${args.join(' ')}`);
    }
    return typeof handler === 'function' ? handler(stripped, options) : handler;
  };
  return { runner, calls };
}

/** Resolve the session refs the way a real clone would, by their suffix. */
function sessionRefRevParse(args: string[]): ForgeCommandResult | null {
  if (SESSION_BASE_REF.test(args[1])) return ok(`${BASE_SHA}\n`);
  if (SESSION_HEAD_REF.test(args[1])) return ok(`${HEAD_SHA}\n`);
  return null;
}

/** Handlers for a happy-path existing clone at /home/user/project. */
function existingCloneHandlers(remotesOutput: string): Record<string, Handler> {
  return {
    'rev-parse': args => {
      if (args[1] === '--show-toplevel') return ok('/home/user/project\n');
      return sessionRefRevParse(args) ?? fail(`fatal: unknown rev ${args[1]}`);
    },
    remote: ok(remotesOutput),
    fetch: ok(),
    'update-ref': ok(),
  };
}

/** Handlers for the temp-clone path (cwd is not a repo). */
function tempCloneHandlers(): Record<string, Handler> {
  return {
    'rev-parse': args => {
      if (args[1] === '--show-toplevel') {
        return fail('fatal: not a git repository');
      }
      return sessionRefRevParse(args) ?? fail(`fatal: unknown rev ${args[1]}`);
    },
    clone: ok(),
    fetch: ok(),
  };
}

function findCall(calls: string[][], subcommand: string): string[] | undefined {
  return calls.find(call => call.includes(subcommand));
}

function findCalls(calls: string[][], subcommand: string): string[][] {
  return calls.filter(call => call.includes(subcommand));
}

describe('materialize', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  describe('existing-clone path', () => {
    it('matches an SSH (scp-style) remote and reuses the clone', async () => {
      const { runner, calls } = createRunner(
        existingCloneHandlers(
          'origin\tgit@github.com:e0ipso/self-review.git (fetch)\n' +
            'origin\tgit@github.com:e0ipso/self-review.git (push)\n'
        )
      );

      const result = await materialize(githubUrl, 'main', '/home/user/project/sub', runner);

      expect(result.mode).toBe('existing-clone');
      expect(result.repoPath).toBe('/home/user/project');
      expect(result.baseSha).toBe(BASE_SHA);
      expect(result.headSha).toBe(HEAD_SHA);
      expect(findCall(calls, 'clone')).toBeUndefined();
    });

    it('matches an HTTPS remote with a .git suffix', async () => {
      const { runner, calls } = createRunner(
        existingCloneHandlers('origin\thttps://github.com/e0ipso/self-review.git (fetch)\n')
      );

      const result = await materialize(githubUrl, 'main', '/home/user/project', runner);

      expect(result.mode).toBe('existing-clone');
      expect(findCall(calls, 'clone')).toBeUndefined();
    });

    it('matches an HTTPS remote without a .git suffix', async () => {
      const { runner } = createRunner(
        existingCloneHandlers('origin\thttps://github.com/e0ipso/self-review (fetch)\n')
      );

      const result = await materialize(githubUrl, 'main', '/home/user/project', runner);

      expect(result.mode).toBe('existing-clone');
    });

    it('matches case-insensitively on host and owner/repo', async () => {
      const { runner } = createRunner(
        existingCloneHandlers('origin\thttps://GitHub.com/E0ipso/Self-Review.git (fetch)\n')
      );

      const result = await materialize(githubUrl, 'main', '/home/user/project', runner);

      expect(result.mode).toBe('existing-clone');
    });

    it('matches an ssh:// remote for a GitLab subgroup namespace', async () => {
      const { runner, calls } = createRunner(
        existingCloneHandlers(
          'upstream\tssh://git@gitlab.example.com/group/subgroup/project.git (fetch)\n'
        )
      );

      const result = await materialize(gitlabUrl, 'main', '/home/user/project', runner);

      expect(result.mode).toBe('existing-clone');
      const fetch = findCall(calls, 'fetch');
      expect(fetch).toContain('upstream');
      expect(fetch).toContainEqual(
        expect.stringMatching(/^\+refs\/merge-requests\/42\/head:refs\/self-review\/[^/]+\/head$/)
      );
    });

    it('fetches base and head into refs this session owns, then resolves exactly those', async () => {
      const { runner, calls } = createRunner(
        existingCloneHandlers('origin\tgit@github.com:e0ipso/self-review.git (fetch)\n')
      );

      const result = await materialize(githubUrl, 'develop', '/home/user/project', runner);

      const fetch = findCall(calls, 'fetch');
      expect(fetch).toBeDefined();
      expect(fetch).toContain('origin');
      expect(fetch).toContainEqual(
        expect.stringMatching(/^\+refs\/heads\/develop:refs\/self-review\/[^/]+\/base$/)
      );
      expect(fetch).toContainEqual(
        expect.stringMatching(/^\+refs\/pull\/126\/head:refs\/self-review\/[^/]+\/head$/)
      );
      // The two refs share one session segment, and the SHAs are read from
      // those refs and no other.
      expect(result.ownedRefs).toHaveLength(2);
      const [baseRef, headRef] = result.ownedRefs;
      expect(baseRef).toMatch(SESSION_BASE_REF);
      expect(headRef).toMatch(SESSION_HEAD_REF);
      expect(path.posix.dirname(baseRef)).toBe(path.posix.dirname(headRef));
      const revParsed = findCalls(calls, 'rev-parse')
        .map(call => call[call.length - 1])
        .filter(ref => ref !== '--show-toplevel');
      expect(revParsed).toEqual([baseRef, headRef]);
      // Read-only for the working tree: no checkout, no branch creation.
      expect(findCall(calls, 'checkout')).toBeUndefined();
      expect(findCall(calls, 'branch')).toBeUndefined();
    });

    it('gives each session its own refs', async () => {
      const { runner } = createRunner(
        existingCloneHandlers('origin\tgit@github.com:e0ipso/self-review.git (fetch)\n')
      );

      const first = await materialize(githubUrl, 'main', '/home/user/project', runner);
      const second = await materialize(githubUrl, 'main', '/home/user/project', runner);

      expect(new Set([...first.ownedRefs, ...second.ownedRefs]).size).toBe(4);
    });

    it('cleanup deletes only the refs this session owns and never throws', async () => {
      const handlers = existingCloneHandlers(
        'origin\tgit@github.com:e0ipso/self-review.git (fetch)\n'
      );
      const { runner, calls } = createRunner(handlers);

      const result = await materialize(githubUrl, 'main', '/home/user/project', runner);
      await expect(result.cleanup()).resolves.toBeUndefined();

      // `git update-ref -d` deletes one ref per invocation.
      const deletions = findCalls(calls, 'update-ref');
      expect(deletions).toEqual(
        result.ownedRefs.map(ref => ['git', '-C', '/home/user/project', 'update-ref', '-d', ref])
      );

      // Idempotent: a second call deletes nothing again.
      await result.cleanup();
      expect(findCalls(calls, 'update-ref')).toHaveLength(2);
    });

    it('cleanup swallows a failed ref deletion and reports it on stderr', async () => {
      const handlers = existingCloneHandlers(
        'origin\tgit@github.com:e0ipso/self-review.git (fetch)\n'
      );
      handlers['update-ref'] = fail('fatal: ref lock');
      const { runner } = createRunner(handlers);

      const result = await materialize(githubUrl, 'main', '/home/user/project', runner);
      await expect(result.cleanup()).resolves.toBeUndefined();

      const output = errorSpy.mock.calls.flat().join('\n');
      expect(output).toContain('ref lock');
    });

    it('reports the reused clone on stderr', async () => {
      const { runner } = createRunner(
        existingCloneHandlers('origin\tgit@github.com:e0ipso/self-review.git (fetch)\n')
      );

      await materialize(githubUrl, 'main', '/home/user/project', runner);

      const output = errorSpy.mock.calls.flat().join('\n');
      expect(output).toContain('/home/user/project');
    });
  });

  describe('temp-clone path', () => {
    it('falls back to a temp clone when the remote does not match', async () => {
      const handlers = tempCloneHandlers();
      handlers['rev-parse'] = args => {
        if (args[1] === '--show-toplevel') return ok('/home/user/other\n');
        return sessionRefRevParse(args) ?? fail(`fatal: unknown rev ${args[1]}`);
      };
      handlers.remote = ok('origin\tgit@github.com:someone-else/other-repo.git (fetch)\n');
      const { runner, calls } = createRunner(handlers);

      const result = await materialize(githubUrl, 'main', '/home/user/other', runner);
      await result.cleanup();

      expect(result.mode).toBe('temp-clone');
      expect(findCall(calls, 'clone')).toBeDefined();
    });

    it('creates a blobless clone (no --depth) of the HTTPS repo URL in the temp dir', async () => {
      const { runner, calls } = createRunner(tempCloneHandlers());

      const result = await materialize(githubUrl, 'main', '/not/a/repo', runner);
      const clone = findCall(calls, 'clone');
      await result.cleanup();

      expect(result.mode).toBe('temp-clone');
      expect(clone).toBeDefined();
      expect(clone).toContain('--filter=blob:none');
      expect(clone!.some(arg => arg.startsWith('--depth'))).toBe(false);
      expect(clone).toContain('https://github.com/e0ipso/self-review.git');
      expect(clone).toContain(result.repoPath);
      expect(result.repoPath.startsWith(os.tmpdir())).toBe(true);
      expect(path.basename(result.repoPath).startsWith('self-review-')).toBe(true);
    });

    it('fetches the GitLab MR head and the base branch into session refs and resolves both', async () => {
      const { runner, calls } = createRunner(tempCloneHandlers());

      const result = await materialize(gitlabUrl, 'develop', '/not/a/repo', runner);
      await result.cleanup();

      const fetch = findCall(calls, 'fetch');
      expect(fetch).toContain('origin');
      expect(fetch).toContainEqual(
        expect.stringMatching(/^\+refs\/heads\/develop:refs\/self-review\/[^/]+\/base$/)
      );
      expect(fetch).toContainEqual(
        expect.stringMatching(/^\+refs\/merge-requests\/42\/head:refs\/self-review\/[^/]+\/head$/)
      );
      expect(result.baseSha).toBe(BASE_SHA);
      expect(result.headSha).toBe(HEAD_SHA);
      // The clone goes away whole; there is nothing to delete ref by ref.
      expect(result.ownedRefs).toEqual([]);
      expect(findCall(calls, 'update-ref')).toBeUndefined();
    });

    it('reports the created temp directory on stderr', async () => {
      const { runner } = createRunner(tempCloneHandlers());

      const result = await materialize(githubUrl, 'main', '/not/a/repo', runner);
      await result.cleanup();

      const output = errorSpy.mock.calls.flat().join('\n');
      expect(output).toContain(result.repoPath);
    });

    it('cleanup removes exactly the created directory and nothing else', async () => {
      const sibling = fs.mkdtempSync(path.join(os.tmpdir(), 'self-review-test-sibling-'));
      try {
        const { runner } = createRunner(tempCloneHandlers());

        const result = await materialize(githubUrl, 'main', '/not/a/repo', runner);

        expect(fs.existsSync(result.repoPath)).toBe(true);
        await result.cleanup();
        expect(fs.existsSync(result.repoPath)).toBe(false);
        expect(fs.existsSync(sibling)).toBe(true);
        // A second cleanup call is a safe no-op.
        await expect(result.cleanup()).resolves.toBeUndefined();
      } finally {
        fs.rmSync(sibling, { recursive: true, force: true });
      }
    });
  });

  describe('error propagation', () => {
    it('propagates git stderr verbatim with the auth hint when fetch fails', async () => {
      const gitStderr =
        "fatal: could not read Username for 'https://github.com': terminal prompts disabled";
      const handlers = existingCloneHandlers(
        'origin\tgit@github.com:e0ipso/self-review.git (fetch)\n'
      );
      handlers.fetch = fail(gitStderr);
      const { runner } = createRunner(handlers);

      await expect(materialize(githubUrl, 'main', '/home/user/project', runner)).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining(gitStderr),
        })
      );
      await expect(materialize(githubUrl, 'main', '/home/user/project', runner)).rejects.toThrow(
        /gh auth setup-git/
      );
      await expect(materialize(githubUrl, 'main', '/home/user/project', runner)).rejects.toThrow(
        /glab auth git-credential/
      );
    });

    it('propagates clone failures with the auth hint and removes the temp dir', async () => {
      const gitStderr = 'fatal: repository not found';
      const handlers = tempCloneHandlers();
      handlers.clone = fail(gitStderr);
      const { runner, calls } = createRunner(handlers);

      let thrown: Error | undefined;
      try {
        await materialize(githubUrl, 'main', '/not/a/repo', runner);
      } catch (error) {
        thrown = error as Error;
      }

      expect(thrown).toBeDefined();
      expect(thrown!.message).toContain(gitStderr);
      expect(thrown!.message).toContain('gh auth setup-git');
      expect(thrown!.message).toContain('glab auth git-credential');
      // materialize() names the temp dir before invoking git, so the clone
      // call's last argument is the exact directory it created. Assert that
      // one path is gone rather than sampling the shared os.tmpdir() — a
      // fresh self-review-* directory from another process or worktree must
      // not make this pass or fail.
      const clone = findCall(calls, 'clone');
      expect(clone).toBeDefined();
      const tempDir = clone![clone!.length - 1];
      expect(path.basename(tempDir).startsWith('self-review-')).toBe(true);
      expect(fs.existsSync(tempDir)).toBe(false);
    });
  });

  // The temp directory is owned from the moment it exists: whatever ends the
  // run after that — a git that cannot be spawned, a failed fetch, a
  // cancellation — the directory is gone before the error reaches the caller.
  describe('temp-clone lifetime', () => {
    it('removes the temp dir when the clone command cannot be spawned', async () => {
      const handlers = tempCloneHandlers();
      handlers.clone = () => {
        throw Object.assign(new Error('spawn git ENOENT'), { code: 'ENOENT' });
      };
      const { runner, calls } = createRunner(handlers);

      await expect(materialize(githubUrl, 'main', '/not/a/repo', runner)).rejects.toThrow(
        'spawn git ENOENT'
      );

      const clone = findCall(calls, 'clone')!;
      expect(fs.existsSync(clone[clone.length - 1])).toBe(false);
    });

    it('removes the temp dir when the fetch after the clone rejects', async () => {
      const handlers = tempCloneHandlers();
      handlers.fetch = () => {
        throw new Error('fetch exploded');
      };
      const { runner, calls } = createRunner(handlers);

      await expect(materialize(githubUrl, 'main', '/not/a/repo', runner)).rejects.toThrow(
        'fetch exploded'
      );

      const clone = findCall(calls, 'clone')!;
      expect(fs.existsSync(clone[clone.length - 1])).toBe(false);
    });

    it('passes the signal to every command and removes the temp dir when aborted mid-clone', async () => {
      const controller = new AbortController();
      const handlers = tempCloneHandlers();
      let cloneSignal: AbortSignal | undefined;
      const { runner, calls } = createRunner({
        ...handlers,
        clone: (args, options) => {
          cloneSignal = options?.signal;
          // Behave like the real runner: abort → kill → typed rejection.
          controller.abort();
          throw new CommandCancelledError('aborted', 'git', ['clone', ...args.slice(1)]);
        },
      });

      await expect(
        materialize(githubUrl, 'main', '/not/a/repo', runner, null, {
          signal: controller.signal,
        })
      ).rejects.toMatchObject({ name: 'CommandCancelledError', reason: 'aborted' });

      expect(cloneSignal).toBe(controller.signal);
      const clone = findCall(calls, 'clone')!;
      expect(fs.existsSync(clone[clone.length - 1])).toBe(false);
      expect(findCall(calls, 'fetch')).toBeUndefined();
    });

    it('does nothing at all when the signal is already aborted', async () => {
      const { runner, calls } = createRunner(tempCloneHandlers());

      await expect(
        materialize(githubUrl, 'main', '/not/a/repo', runner, null, {
          signal: AbortSignal.abort(),
        })
      ).rejects.toMatchObject({ name: 'CommandCancelledError', reason: 'aborted' });

      expect(calls).toEqual([]);
    });

    it('forwards the per-command timeout to the runner', async () => {
      const timeouts: Array<number | undefined> = [];
      const handlers = tempCloneHandlers();
      const { runner } = createRunner({
        ...handlers,
        clone: (_args, options) => {
          timeouts.push(options?.timeoutMs);
          return ok();
        },
      });

      const result = await materialize(githubUrl, 'main', '/not/a/repo', runner, null, {
        commandTimeoutMs: 1234,
      });
      await result.cleanup();

      expect(timeouts).toEqual([1234]);
    });
  });
});

// Two sessions over one clone must never see each other's SHAs or delete
// each other's refs. The audit (R16) reproduced the race by interleaving
// one session's fetch between another's fetch and rev-parse; the same
// interleaving runs here through the real materializer against real refs.
describe('session-owned refs over a shared clone (real git)', () => {
  let fixtureRoot: string;
  let remoteDir: string;
  let localDir: string;
  let baseSha: string;
  let pr1Sha: string;
  let pr2Sha: string;

  const forgeUrl = (number: number): ForgeUrl => ({
    forge: 'github',
    host: 'github.com',
    owner: 'octo',
    repo: 'repo',
    number,
  });

  beforeAll(() => {
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'self-review-materializer-'));
    const seed = path.join(fixtureRoot, 'seed');
    remoteDir = path.join(fixtureRoot, 'remote.git');
    localDir = path.join(fixtureRoot, 'local');
    fs.mkdirSync(seed);
    const git = (...args: string[]) => gitSync(args, { cwd: seed }).trim();
    git('-c', 'init.defaultBranch=main', 'init', '-q');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'Test');
    fs.writeFileSync(path.join(seed, 'a.txt'), 'base\n');
    git('add', '.');
    git('commit', '-q', '-m', 'base');
    baseSha = git('rev-parse', 'HEAD');
    fs.writeFileSync(path.join(seed, 'a.txt'), 'pr1\n');
    git('commit', '-q', '-a', '-m', 'pr1');
    pr1Sha = git('rev-parse', 'HEAD');
    git('update-ref', 'refs/pull/1/head', pr1Sha);
    git('reset', '-q', '--hard', baseSha);
    fs.writeFileSync(path.join(seed, 'a.txt'), 'pr2\n');
    git('commit', '-q', '-a', '-m', 'pr2');
    pr2Sha = git('rev-parse', 'HEAD');
    git('update-ref', 'refs/pull/2/head', pr2Sha);
    git('reset', '-q', '--hard', baseSha);
    // The "forge": a bare mirror carrying main and the two PR head refs.
    gitSync(['clone', '-q', '--mirror', seed, remoteDir]);
    // The reviewer's clone of it.
    gitSync(['clone', '-q', remoteDir, localDir]);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    vi.restoreAllMocks();
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  });

  const existing = () => ({ repoPath: localDir, remoteName: 'origin' });

  function refExists(ref: string): boolean {
    const result = spawnSync('git', ['-C', localDir, 'rev-parse', '--verify', '--quiet', ref], {
      encoding: 'utf-8',
    });
    return result.status === 0;
  }

  /**
   * The real runner, with two hooks: `beforeRevParse` is awaited before any
   * rev-parse runs, and `afterFetch` fires once a fetch has completed.
   */
  function interleaved(hooks: {
    beforeRevParse?: Promise<void>;
    afterFetch?: () => void;
  }): ForgeCommandRunner {
    return async (command, args, options) => {
      const sub = args[0] === '-C' ? args[2] : args[0];
      if (sub === 'rev-parse' && hooks.beforeRevParse) await hooks.beforeRevParse;
      const result = await defaultGitRunner(command, args, options);
      if (sub === 'fetch') hooks.afterFetch?.();
      return result;
    };
  }

  async function runInterleaved(
    firstNumber: number,
    secondNumber: number
  ): Promise<[MaterializeResult, MaterializeResult]> {
    let releaseFirst!: () => void;
    const secondFetched = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });
    // The first session fetches, then waits to resolve its SHAs until the
    // second session's fetch has landed — the exact window the race needs.
    return Promise.all([
      materialize(
        forgeUrl(firstNumber),
        'main',
        localDir,
        interleaved({ beforeRevParse: secondFetched }),
        existing()
      ),
      materialize(
        forgeUrl(secondNumber),
        'main',
        localDir,
        interleaved({ afterFetch: releaseFirst }),
        existing()
      ),
    ]);
  }

  it('gives concurrent sessions for different PRs their own SHAs and refs', async () => {
    const [first, second] = await runInterleaved(1, 2);

    expect(first.headSha).toBe(pr1Sha);
    expect(second.headSha).toBe(pr2Sha);
    expect(first.baseSha).toBe(baseSha);
    expect(second.baseSha).toBe(baseSha);
    expect(first.ownedRefs).not.toEqual(second.ownedRefs);
    for (const ref of [...first.ownedRefs, ...second.ownedRefs]) {
      expect(refExists(ref)).toBe(true);
    }

    await first.cleanup();
    for (const ref of first.ownedRefs) expect(refExists(ref)).toBe(false);
    for (const ref of second.ownedRefs) expect(refExists(ref)).toBe(true);

    await second.cleanup();
    for (const ref of second.ownedRefs) expect(refExists(ref)).toBe(false);
    // Nothing of ours is left behind in the reviewer's clone.
    expect(gitSync(['-C', localDir, 'for-each-ref', 'refs/self-review/']).trim()).toBe('');
  });

  it('keeps two concurrent sessions for the same PR independent', async () => {
    const [first, second] = await runInterleaved(1, 1);

    expect(first.headSha).toBe(pr1Sha);
    expect(second.headSha).toBe(pr1Sha);
    expect(first.ownedRefs).not.toEqual(second.ownedRefs);

    await first.cleanup();
    for (const ref of second.ownedRefs) expect(refExists(ref)).toBe(true);
    await second.cleanup();
    expect(gitSync(['-C', localDir, 'for-each-ref', 'refs/self-review/']).trim()).toBe('');
  });

  it('never touches branches or the working tree of the reused clone', async () => {
    const before = gitSync(['-C', localDir, 'status', '--porcelain', '--branch']);
    const result = await materialize(forgeUrl(2), 'main', localDir, defaultGitRunner, existing());
    await result.cleanup();
    expect(gitSync(['-C', localDir, 'status', '--porcelain', '--branch'])).toBe(before);
    expect(gitSync(['-C', localDir, 'branch', '--list']).trim()).toBe('* main');
  });
});

// The default runner is the one that actually spawns processes, so its
// bounds are tested against real children.
describe('defaultGitRunner', () => {
  const MARKER = '31337.25';

  function childAlive(): boolean {
    const pgrep = spawnSync('pgrep', ['-f', `sleep ${MARKER}`], { encoding: 'utf-8' });
    return pgrep.status === 0;
  }

  afterEach(() => {
    spawnSync('pkill', ['-f', `sleep ${MARKER}`]);
  });

  it('resolves a non-zero exit as a result and rejects a binary it cannot spawn', async () => {
    await expect(defaultGitRunner('sh', ['-c', 'echo out; echo err >&2; exit 3'])).resolves.toEqual(
      { stdout: 'out\n', stderr: 'err\n', exitCode: 3 }
    );
    await expect(
      defaultGitRunner('self-review-no-such-binary-' + process.pid, [])
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('kills the child and rejects with a typed error when the signal aborts', async () => {
    const controller = new AbortController();
    const run = defaultGitRunner('sleep', [MARKER], { signal: controller.signal });
    await vi.waitFor(() => expect(childAlive()).toBe(true));

    controller.abort();

    await expect(run).rejects.toMatchObject({
      name: 'CommandCancelledError',
      reason: 'aborted',
      command: 'sleep',
    });
    expect(childAlive()).toBe(false);
  });

  it('kills the child and rejects with a typed error when the timeout elapses', async () => {
    await expect(defaultGitRunner('sleep', [MARKER], { timeoutMs: 100 })).rejects.toMatchObject({
      name: 'CommandCancelledError',
      reason: 'timeout',
    });
    expect(childAlive()).toBe(false);
  });

  it('rejects immediately, spawning nothing, when the signal is already aborted', async () => {
    await expect(
      defaultGitRunner('sleep', [MARKER], { signal: AbortSignal.abort() })
    ).rejects.toMatchObject({ name: 'CommandCancelledError', reason: 'aborted' });
    expect(childAlive()).toBe(false);
  });

  it('leaves git terminal prompting to the environment', async () => {
    const previous = process.env.GIT_TERMINAL_PROMPT;
    delete process.env.GIT_TERMINAL_PROMPT;
    try {
      const result = await defaultGitRunner('sh', ['-c', 'echo "${GIT_TERMINAL_PROMPT-unset}"']);
      expect(result.stdout).toBe('unset\n');
    } finally {
      if (previous !== undefined) process.env.GIT_TERMINAL_PROMPT = previous;
    }
  });
});

// SR-0047: a clone root with leading/trailing whitespace is real (same
// defect class as SR-0036's git.ts fix). A blanket .trim() on the
// `--show-toplevel` output reports a path short of what's on disk, so the
// following `git -C repoPath remote -v` runs against a directory that
// doesn't exist and detectExistingClone falls back to null.
describe('detectExistingClone', () => {
  it('preserves whitespace in the detected repo root', async () => {
    const spacedRoot = '/home/user/my project ';
    const { runner, calls } = createRunner({
      'rev-parse': args => {
        if (args[1] === '--show-toplevel') return ok(`${spacedRoot}\n`);
        return fail(`fatal: unknown rev ${args[1]}`);
      },
      remote: ok('origin\tgit@github.com:e0ipso/self-review.git (fetch)\n'),
    });

    const existing = await detectExistingClone(githubUrl, spacedRoot, runner);

    expect(existing).not.toBeNull();
    expect(existing!.repoPath).toBe(spacedRoot);
    // The follow-up `remote -v` call must target the exact reported root,
    // not a trimmed-short path that doesn't exist on disk.
    const remoteCall = findCall(calls, 'remote');
    expect(remoteCall).toContain(spacedRoot);
  });
});

describe('resolveRemoteDefaultBranch', () => {
  it('reuses a detected clone so SSH transport is preserved', async () => {
    const handlers = existingCloneHandlers(
      'origin\tgit@github.com:e0ipso/self-review.git (fetch)\n'
    );
    handlers['ls-remote'] = ok('ref: refs/heads/main\tHEAD\n' + `${HEAD_SHA}\tHEAD\n`);
    const { runner, calls } = createRunner(handlers);

    const existing = await detectExistingClone(githubUrl, '/home/user/project/sub', runner);
    const branch = await resolveRemoteDefaultBranch(githubUrl, runner, existing);

    expect(branch).toBe('main');
    const call = findCall(calls, 'ls-remote');
    expect(call).toEqual([
      'git',
      '-C',
      '/home/user/project',
      'ls-remote',
      '--symref',
      'origin',
      'HEAD',
    ]);
  });

  it('resolves the remote HEAD symref via git ls-remote', async () => {
    const { runner, calls } = createRunner({
      'ls-remote': ok('ref: refs/heads/main\tHEAD\n' + `${HEAD_SHA}\tHEAD\n`),
    });

    const branch = await resolveRemoteDefaultBranch(githubUrl, runner);

    expect(branch).toBe('main');
    const call = findCall(calls, 'ls-remote');
    expect(call).toContain('--symref');
    expect(call).toContain('https://github.com/e0ipso/self-review.git');
    expect(call).toContain('HEAD');
  });

  it('propagates ls-remote failures with the auth hint', async () => {
    const gitStderr = 'fatal: unable to access repository';
    const { runner } = createRunner({ 'ls-remote': fail(gitStderr) });

    await expect(resolveRemoteDefaultBranch(githubUrl, runner)).rejects.toThrow(
      expect.objectContaining({ message: expect.stringContaining(gitStderr) })
    );
    await expect(resolveRemoteDefaultBranch(githubUrl, runner)).rejects.toThrow(
      /gh auth setup-git/
    );
  });

  it('identifies the repository when a matching remote lookup fails', async () => {
    const { runner } = createRunner({
      'ls-remote': fail('fatal: unable to access repository'),
    });

    await expect(
      resolveRemoteDefaultBranch(githubUrl, runner, {
        repoPath: '/home/user/project',
        remoteName: 'origin',
      })
    ).rejects.toThrow('ls-remote of origin (https://github.com/e0ipso/self-review.git)');
  });

  it('throws when the symref line is missing from the output', async () => {
    const { runner } = createRunner({ 'ls-remote': ok(`${HEAD_SHA}\tHEAD\n`) });

    await expect(resolveRemoteDefaultBranch(githubUrl, runner)).rejects.toThrow(/default branch/i);
  });

  it('forwards the signal and timeout to the lookup', async () => {
    const seen: Array<Parameters<ForgeCommandRunner>[2]> = [];
    const { runner } = createRunner({
      'ls-remote': (_args, options) => {
        seen.push(options);
        return ok('ref: refs/heads/main\tHEAD\n');
      },
    });
    const controller = new AbortController();

    await resolveRemoteDefaultBranch(githubUrl, runner, null, {
      signal: controller.signal,
      commandTimeoutMs: 99,
    });

    expect(seen).toEqual([{ signal: controller.signal, timeoutMs: 99 }]);
  });
});
