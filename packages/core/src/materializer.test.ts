// materializer.test.ts
// Tests for the clone-aware diff materializer. All git interaction goes
// through an injected command runner — no real git is ever spawned here.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { ForgeCommandResult, ForgeCommandRunner, ForgeUrl } from './forge-provider';
import {
  detectExistingClone,
  materialize,
  resolveRemoteDefaultBranch,
} from './materializer';

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

function ok(stdout = ''): ForgeCommandResult {
  return { stdout, stderr: '', exitCode: 0 };
}

function fail(stderr: string, exitCode = 128): ForgeCommandResult {
  return { stdout: '', stderr, exitCode };
}

type Handler = ForgeCommandResult | ((args: string[]) => ForgeCommandResult);

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
  const runner: ForgeCommandRunner = async (command, args) => {
    calls.push([command, ...args]);
    let stripped = args;
    if (stripped[0] === '-C') {
      stripped = stripped.slice(2);
    }
    const handler = handlers[stripped[0]];
    if (handler === undefined) {
      throw new Error(`unexpected git invocation: ${args.join(' ')}`);
    }
    return typeof handler === 'function' ? handler(stripped) : handler;
  };
  return { runner, calls };
}

/** Handlers for a happy-path existing clone at /home/user/project. */
function existingCloneHandlers(remotesOutput: string): Record<string, Handler> {
  return {
    'rev-parse': (args) => {
      if (args[1] === '--show-toplevel') return ok('/home/user/project\n');
      if (args[1] === 'refs/self-review/base') return ok(`${BASE_SHA}\n`);
      if (args[1] === 'refs/self-review/head') return ok(`${HEAD_SHA}\n`);
      return fail(`fatal: unknown rev ${args[1]}`);
    },
    remote: ok(remotesOutput),
    fetch: ok(),
  };
}

/** Handlers for the temp-clone path (cwd is not a repo). */
function tempCloneHandlers(baseBranch = 'main'): Record<string, Handler> {
  return {
    'rev-parse': (args) => {
      if (args[1] === '--show-toplevel') {
        return fail('fatal: not a git repository');
      }
      if (args[1] === 'refs/self-review/head') return ok(`${HEAD_SHA}\n`);
      if (args[1] === `origin/${baseBranch}`) return ok(`${BASE_SHA}\n`);
      return fail(`fatal: unknown rev ${args[1]}`);
    },
    clone: ok(),
    fetch: ok(),
  };
}

function findCall(calls: string[][], subcommand: string): string[] | undefined {
  return calls.find((call) => call.includes(subcommand));
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
      expect(fetch).toContain('+refs/merge-requests/42/head:refs/self-review/head');
    });

    it('fetches base and head into namespaced refs on the matched remote', async () => {
      const { runner, calls } = createRunner(
        existingCloneHandlers('origin\tgit@github.com:e0ipso/self-review.git (fetch)\n')
      );

      await materialize(githubUrl, 'develop', '/home/user/project', runner);

      const fetch = findCall(calls, 'fetch');
      expect(fetch).toBeDefined();
      expect(fetch).toContain('origin');
      expect(fetch).toContain('+refs/heads/develop:refs/self-review/base');
      expect(fetch).toContain('+refs/pull/126/head:refs/self-review/head');
      // Read-only for the working tree: no checkout, no branch creation.
      expect(findCall(calls, 'checkout')).toBeUndefined();
      expect(findCall(calls, 'branch')).toBeUndefined();
    });

    it('returns a no-op cleanup that never throws', async () => {
      const { runner } = createRunner(
        existingCloneHandlers('origin\tgit@github.com:e0ipso/self-review.git (fetch)\n')
      );

      const result = await materialize(githubUrl, 'main', '/home/user/project', runner);

      expect(() => result.cleanup()).not.toThrow();
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
      handlers['rev-parse'] = (args) => {
        if (args[1] === '--show-toplevel') return ok('/home/user/other\n');
        if (args[1] === 'refs/self-review/head') return ok(`${HEAD_SHA}\n`);
        if (args[1] === 'origin/main') return ok(`${BASE_SHA}\n`);
        return fail(`fatal: unknown rev ${args[1]}`);
      };
      handlers.remote = ok('origin\tgit@github.com:someone-else/other-repo.git (fetch)\n');
      const { runner, calls } = createRunner(handlers);

      const result = await materialize(githubUrl, 'main', '/home/user/other', runner);
      result.cleanup();

      expect(result.mode).toBe('temp-clone');
      expect(findCall(calls, 'clone')).toBeDefined();
    });

    it('creates a blobless clone (no --depth) of the HTTPS repo URL in the temp dir', async () => {
      const { runner, calls } = createRunner(tempCloneHandlers());

      const result = await materialize(githubUrl, 'main', '/not/a/repo', runner);
      const clone = findCall(calls, 'clone');
      result.cleanup();

      expect(result.mode).toBe('temp-clone');
      expect(clone).toBeDefined();
      expect(clone).toContain('--filter=blob:none');
      expect(clone!.some((arg) => arg.startsWith('--depth'))).toBe(false);
      expect(clone).toContain('https://github.com/e0ipso/self-review.git');
      expect(clone).toContain(result.repoPath);
      expect(result.repoPath.startsWith(os.tmpdir())).toBe(true);
      expect(path.basename(result.repoPath).startsWith('self-review-')).toBe(true);
    });

    it('fetches the well-known GitLab MR head ref and resolves both SHAs', async () => {
      const { runner, calls } = createRunner(tempCloneHandlers('develop'));

      const result = await materialize(gitlabUrl, 'develop', '/not/a/repo', runner);
      result.cleanup();

      const fetch = findCall(calls, 'fetch');
      expect(fetch).toContain('origin');
      expect(fetch).toContain('+refs/merge-requests/42/head:refs/self-review/head');
      expect(result.baseSha).toBe(BASE_SHA);
      expect(result.headSha).toBe(HEAD_SHA);
    });

    it('reports the created temp directory on stderr', async () => {
      const { runner } = createRunner(tempCloneHandlers());

      const result = await materialize(githubUrl, 'main', '/not/a/repo', runner);
      result.cleanup();

      const output = errorSpy.mock.calls.flat().join('\n');
      expect(output).toContain(result.repoPath);
    });

    it('cleanup removes exactly the created directory and nothing else', async () => {
      const sibling = fs.mkdtempSync(path.join(os.tmpdir(), 'self-review-test-sibling-'));
      try {
        const { runner } = createRunner(tempCloneHandlers());

        const result = await materialize(githubUrl, 'main', '/not/a/repo', runner);

        expect(fs.existsSync(result.repoPath)).toBe(true);
        result.cleanup();
        expect(fs.existsSync(result.repoPath)).toBe(false);
        expect(fs.existsSync(sibling)).toBe(true);
        // A second cleanup call is a safe no-op.
        expect(() => result.cleanup()).not.toThrow();
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
      await expect(
        materialize(githubUrl, 'main', '/home/user/project', runner)
      ).rejects.toThrow(/gh auth setup-git/);
      await expect(
        materialize(githubUrl, 'main', '/home/user/project', runner)
      ).rejects.toThrow(/glab auth git-credential/);
    });

    it('propagates clone failures with the auth hint and removes the temp dir', async () => {
      const gitStderr = 'fatal: repository not found';
      const handlers = tempCloneHandlers();
      handlers.clone = fail(gitStderr);
      const { runner } = createRunner(handlers);

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
      // The partially created temp directory is not left behind.
      const leftovers = fs
        .readdirSync(os.tmpdir())
        .filter((name) => name.startsWith('self-review-') && !name.startsWith('self-review-test-'));
      for (const name of leftovers) {
        const stat = fs.statSync(path.join(os.tmpdir(), name));
        // Any survivor must predate this test run by more than a few seconds.
        expect(Date.now() - stat.mtimeMs).toBeGreaterThan(5_000);
      }
    });
  });
});

describe('resolveRemoteDefaultBranch', () => {
  it('reuses a detected clone so SSH transport is preserved', async () => {
    const handlers = existingCloneHandlers(
      'origin\tgit@github.com:e0ipso/self-review.git (fetch)\n'
    );
    handlers['ls-remote'] = ok(
      'ref: refs/heads/main\tHEAD\n' + `${HEAD_SHA}\tHEAD\n`
    );
    const { runner, calls } = createRunner(handlers);

    const existing = await detectExistingClone(
      githubUrl,
      '/home/user/project/sub',
      runner
    );
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
    ).rejects.toThrow(
      'ls-remote of origin (https://github.com/e0ipso/self-review.git)'
    );
  });

  it('throws when the symref line is missing from the output', async () => {
    const { runner } = createRunner({ 'ls-remote': ok(`${HEAD_SHA}\tHEAD\n`) });

    await expect(resolveRemoteDefaultBranch(githubUrl, runner)).rejects.toThrow(
      /default branch/i
    );
  });
});
