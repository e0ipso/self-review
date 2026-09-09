import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { GIT_REPO_ENV_VARS, gitSync, stripGitRepoEnv, withoutGitRepoEnv } from './git-env';

function makeRepo(prefix: string): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  gitSync(['init', '-q', root]);
  gitSync(['-C', root, 'config', 'user.email', 'outer@example.com']);
  gitSync(['-C', root, 'config', 'user.name', 'Outer']);
  writeFileSync(join(root, 'base.txt'), 'base\n');
  gitSync(['-C', root, 'add', '-A']);
  gitSync(['-C', root, 'commit', '-qm', 'outer base']);
  return root;
}

describe('withoutGitRepoEnv', () => {
  it('drops every repository-resolution variable and keeps the rest', () => {
    const env = Object.fromEntries(GIT_REPO_ENV_VARS.map(name => [name, '/somewhere/.git']));

    const scrubbed = withoutGitRepoEnv({ ...env, PATH: '/usr/bin' });

    expect(Object.keys(scrubbed)).toEqual(['PATH']);
  });

  it('leaves the source environment untouched', () => {
    const env = { GIT_DIR: '/somewhere/.git' };

    withoutGitRepoEnv(env);

    expect(env.GIT_DIR).toBe('/somewhere/.git');
  });
});

describe('stripGitRepoEnv', () => {
  it('removes the variables from the environment it is given', () => {
    const env = { GIT_DIR: '/somewhere/.git', PATH: '/usr/bin' };

    stripGitRepoEnv(env);

    expect(env).toEqual({ PATH: '/usr/bin' });
  });

  it('has already run against this worker, so no suite inherits a repository', () => {
    for (const name of GIT_REPO_ENV_VARS) {
      expect(process.env[name]).toBeUndefined();
    }
  });
});

// SR-0055: git hands hook processes a GIT_DIR and GIT_INDEX_FILE that outrank
// both `git -C <dir>` and the child's cwd. Inheriting them made the suites
// commit to the hook's own repository and rewrite its config.
describe('gitSync under an inherited repository environment', () => {
  const cleanup: string[] = [];

  afterEach(() => {
    for (const path of cleanup.splice(0)) {
      rmSync(path, { recursive: true, force: true });
    }
    stripGitRepoEnv();
  });

  it('targets the temp repository and leaves the inherited one untouched', () => {
    const outer = makeRepo('self-review-test-git-env-outer-');
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'self-review-test-git-env-temp-')));
    cleanup.push(outer, root);
    process.env.GIT_DIR = join(outer, '.git');
    process.env.GIT_INDEX_FILE = join(outer, '.git', 'index');

    gitSync(['init', '-q', root]);
    gitSync(['-C', root, 'config', 'user.email', 'test@example.com']);
    gitSync(['-C', root, 'config', 'user.name', 'Test']);
    writeFileSync(join(root, 'tracked.txt'), 'tracked\n');
    gitSync(['-C', root, 'add', '-A']);
    gitSync(['-C', root, 'commit', '-qm', 'init']);

    expect(gitSync(['-C', root, 'log', '--format=%s']).trim()).toBe('init');
    expect(gitSync(['-C', outer, 'log', '--format=%s']).trim()).toBe('outer base');
    expect(gitSync(['-C', outer, 'status', '--porcelain'])).toBe('');
    expect(gitSync(['-C', outer, 'config', '--get', 'user.name']).trim()).toBe('Outer');
  });
});
