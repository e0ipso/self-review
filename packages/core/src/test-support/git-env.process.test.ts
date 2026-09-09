import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'child_process';
import { chmodSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { GIT_REPO_ENV_VARS, gitSync, withoutGitRepoEnv } from './git-env';

// SR-0055. `.husky/pre-commit` runs the unit suites, and git hands every hook
// process its own repository-resolution environment. Those variables outrank
// both the child's working directory and `git -C`, so a suite that spawns git
// for a temp repository was operating on the repository being committed to.
//
// Everything here happens in disposable repositories under the OS temp
// directory: the fixture reproduces the corruption on purpose, and the
// repository it corrupts is one it created a moment earlier.
const REPO_ROOT = resolve(__dirname, '../../../..');

/** Dump of the GIT_* environment a real pre-commit hook was handed. */
type HookEnv = Record<string, string>;

describe('git repository environment inherited by a pre-commit hook', () => {
  let fixture: string;
  let mainRepo: string;
  let worktree: string;
  let otherRepo: string;
  let hookEnv: HookEnv;

  beforeEach(() => {
    // git reports resolved paths, and the temp root is a symlink on macOS.
    fixture = realpathSync(mkdtempSync(join(tmpdir(), 'self-review-test-hook-')));
    mainRepo = join(fixture, 'main');
    worktree = join(fixture, 'wt');
    otherRepo = join(fixture, 'other');

    gitSync(['init', '-q', mainRepo]);
    gitSync(['config', 'user.email', 'test@example.invalid'], { cwd: mainRepo });
    gitSync(['config', 'user.name', 'Fixture'], { cwd: mainRepo });
    writeFileSync(join(mainRepo, 'staged.txt'), 'one\n');
    writeFileSync(join(mainRepo, 'unstaged.txt'), 'one\n');
    gitSync(['add', '-A'], { cwd: mainRepo });
    gitSync(['commit', '-qm', 'seed'], { cwd: mainRepo });

    // A linked worktree, the shape this repository is developed in. It is
    // also the shape that makes git export an absolute GIT_DIR to hooks.
    gitSync(['worktree', 'add', '-q', worktree, '-b', 'fixture'], { cwd: mainRepo });

    const dump = join(fixture, 'hook-env.json');
    const dumper = join(fixture, 'dump-hook-env.cjs');
    writeFileSync(
      dumper,
      [
        'const out = {};',
        "for (const [k, v] of Object.entries(process.env)) if (k.startsWith('GIT_')) out[k] = v;",
        `require('fs').writeFileSync(${JSON.stringify(dump)}, JSON.stringify(out));`,
        '',
      ].join('\n')
    );

    // The hook records what it was handed, then runs the stash round trip
    // lint-staged performs to set aside unstaged work. lint-staged itself is
    // not invoked: it is a devDependency that need not be installed for the
    // core suites to run, and its git-level mechanism is what this covers.
    writeFileSync(
      join(mainRepo, '.git/hooks/pre-commit'),
      [
        '#!/bin/sh',
        'set -e',
        `node "${dumper}"`,
        'git stash push --keep-index --include-untracked --quiet',
        'git stash pop --quiet',
        '',
      ].join('\n')
    );
    chmodSync(join(mainRepo, '.git/hooks/pre-commit'), 0o755);

    writeFileSync(join(worktree, 'staged.txt'), 'two\n');
    writeFileSync(join(worktree, 'unstaged.txt'), 'edited\n');
    gitSync(['add', '--', 'staged.txt'], { cwd: worktree });
    gitSync(['commit', '-qm', 'hooked commit'], { cwd: worktree });

    hookEnv = JSON.parse(readFileSync(dump, 'utf-8')) as HookEnv;

    gitSync(['init', '-q', otherRepo]);
  });

  afterEach(() => {
    rmSync(fixture, { recursive: true, force: true });
  });

  it('completes the hooked commit and restores the stashed unstaged work', () => {
    expect(gitSync(['show', '-s', '--format=%s', 'HEAD'], { cwd: worktree }).trim()).toBe(
      'hooked commit'
    );
    expect(gitSync(['show', 'HEAD:staged.txt'], { cwd: worktree })).toBe('two\n');
    // The stash round trip gave the unstaged edit back and left nothing behind.
    expect(readFileSync(join(worktree, 'unstaged.txt'), 'utf-8')).toBe('edited\n');
    expect(gitSync(['stash', 'list'], { cwd: worktree })).toBe('');
  });

  it('hands the hook an absolute repository location, not a relative one', () => {
    // The hazard is only interesting because the value outranks the cwd of
    // whatever the hook goes on to spawn.
    expect(hookEnv.GIT_DIR).toBe(join(mainRepo, '.git/worktrees/wt'));
    expect(GIT_REPO_ENV_VARS.some(name => name in hookEnv)).toBe(true);
  });

  it('resolves an unrelated repository as the hook repository under that environment', () => {
    const resolved = execFileSync('git', ['rev-parse', '--absolute-git-dir'], {
      cwd: otherRepo,
      encoding: 'utf-8',
      env: hookEnv,
    }).trim();

    expect(resolved).toBe(join(mainRepo, '.git/worktrees/wt'));
  });

  it('resolves the intended repository once the variables are scrubbed', () => {
    const resolved = execFileSync('git', ['rev-parse', '--absolute-git-dir'], {
      cwd: otherRepo,
      encoding: 'utf-8',
      env: withoutGitRepoEnv(hookEnv),
    }).trim();

    expect(resolved).toBe(join(otherRepo, '.git'));
  });

  it('stages into the hook repository index when the environment is inherited', () => {
    writeFileSync(join(otherRepo, 'stray.txt'), 'content\n');

    execFileSync('git', ['add', '--', 'stray.txt'], { cwd: otherRepo, env: hookEnv });

    // The write landed in the committed-to repository: exactly the corruption
    // the scrub exists to prevent.
    expect(gitSync(['status', '--porcelain'], { cwd: worktree })).toContain('stray.txt');
  });

  it('keeps the write inside the intended repository when gitSync runs it', () => {
    writeFileSync(join(otherRepo, 'stray.txt'), 'content\n');
    const restore = { ...process.env };
    // Stand in for the hook's environment, which vitest.setup.ts scrubs from
    // the worker before any suite runs.
    process.env.GIT_DIR = hookEnv.GIT_DIR;
    process.env.GIT_INDEX_FILE = hookEnv.GIT_INDEX_FILE;

    try {
      gitSync(['add', '--', 'stray.txt'], { cwd: otherRepo });
    } finally {
      delete process.env.GIT_DIR;
      delete process.env.GIT_INDEX_FILE;
      Object.assign(process.env, restore);
    }

    expect(gitSync(['status', '--porcelain'], { cwd: otherRepo })).toContain('stray.txt');
    expect(gitSync(['status', '--porcelain'], { cwd: worktree })).not.toContain('stray.txt');
  });

  it('mirrors the first step of the real pre-commit hook', () => {
    // The fixture reproduces lint-staged's stash mechanism because the real
    // hook runs lint-staged before anything else. If that changes, the
    // fixture is covering a sequence the project no longer performs.
    const hook = readFileSync(join(REPO_ROOT, '.husky/pre-commit'), 'utf-8');
    expect(hook).toMatch(/lint-staged/);
  });
});
