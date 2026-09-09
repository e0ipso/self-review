import { execFileSync } from 'child_process';

/**
 * Test-only helpers. Nothing here is exported from `src/index.ts`, so none of
 * it ships in the published bundle.
 *
 * Git exports its repository-resolution environment into every hook process,
 * and those variables outrank both the child's working directory and
 * `git -C <dir>`. A suite that spawns git from inside a `pre-commit` hook, a
 * rebase or a `bisect run` therefore operates on the surrounding repository
 * instead of on its own temp directory: it commits to the checked-out branch,
 * rewrites the shared config and corrupts the index. Scrubbing the variables
 * is what makes the suites hermetic wherever they run (SR-0055).
 */
export const GIT_REPO_ENV_VARS = [
  'GIT_DIR',
  'GIT_COMMON_DIR',
  'GIT_INDEX_FILE',
  'GIT_WORK_TREE',
  'GIT_PREFIX',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_NAMESPACE',
  'GIT_CEILING_DIRECTORIES',
] as const;

/** A copy of `env` with every repository-resolution variable removed. */
export function withoutGitRepoEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const scrubbed = { ...env };
  for (const name of GIT_REPO_ENV_VARS) {
    delete scrubbed[name];
  }
  return scrubbed;
}

/**
 * Remove the repository-resolution variables from `env` in place. The core
 * vitest setup file calls this once per worker so that git spawned by the
 * code under test — which passes no `env` of its own — is scrubbed too.
 */
export function stripGitRepoEnv(env: NodeJS.ProcessEnv = process.env): void {
  for (const name of GIT_REPO_ENV_VARS) {
    delete env[name];
  }
}

/**
 * Run git for a test, against `options.cwd` or the paths in `args` and never
 * against an inherited repository. Use this instead of calling `execFileSync`
 * with git directly.
 */
export function gitSync(args: readonly string[], options: { cwd?: string } = {}): string {
  return execFileSync('git', [...args], {
    cwd: options.cwd,
    encoding: 'utf-8',
    env: withoutGitRepoEnv(),
  });
}
