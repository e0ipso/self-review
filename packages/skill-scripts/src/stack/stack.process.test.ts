import { spawnSync } from 'child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { STACK_BUNDLE_FILE, STACK_BUNDLE_OUT_DIR } from '../../tsup.config';
import { gitSync, withoutGitRepoEnv } from '../../../core/src/test-support/git-env';

// These tests run the committed bundle, so rebuild it (npm run build:skills) after a source
// change; bundle.test.ts fails when the bundle is stale.
const PACKAGE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BUNDLE = path.join(PACKAGE_DIR, STACK_BUNDLE_OUT_DIR, STACK_BUNDLE_FILE);

const scratch: string[] = [];

afterAll(() => {
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true });
});

function git(repo: string, ...args: string[]): string {
  return gitSync(args, { cwd: repo }).replace(/\n$/, '');
}

function write(repo: string, file: string, content: string): void {
  mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
  writeFileSync(path.join(repo, file), content);
}

function commitAll(repo: string, message: string): void {
  git(repo, 'add', '--all');
  git(repo, 'commit', '-q', '-m', message);
}

/** An empty repository on `main`, removed after the suite. */
function initRepo(): string {
  const repo = mkdtempSync(path.join(tmpdir(), 'skill-scripts-stack-'));
  scratch.push(repo);
  git(repo, 'init', '-q', '-b', 'main');
  git(repo, 'config', 'user.name', 'Test');
  git(repo, 'config', 'user.email', 'test@example.com');
  git(repo, 'config', 'commit.gpgsign', 'false');
  return repo;
}

/**
 * main:    c1 (a, b, src/x.ts, docs/d.md) ── c3 (docs/d.md changed)
 * feature:  └─ c2 (a changed, b deleted, c added, src/x.ts changed)
 * HEAD is main, clean.
 */
function makeRepo(): string {
  const repo = initRepo();
  write(repo, 'a.txt', 'a1\n');
  write(repo, 'b.txt', 'b1\n');
  write(repo, 'src/x.ts', 'export const x = 1;\n');
  write(repo, 'docs/d.md', '# d\n');
  commitAll(repo, 'c1');
  git(repo, 'checkout', '-q', '-b', 'feature');
  write(repo, 'a.txt', 'a2\n');
  rmSync(path.join(repo, 'b.txt'));
  write(repo, 'c.txt', 'c1\n');
  write(repo, 'src/x.ts', 'export const x = 2;\n');
  commitAll(repo, 'c2');
  git(repo, 'checkout', '-q', 'main');
  write(repo, 'docs/d.md', '# d, revised\n');
  commitAll(repo, 'c3');
  return repo;
}

function stack(cwd: string, ...args: string[]) {
  const result = spawnSync(process.execPath, [BUNDLE, ...args], {
    cwd,
    encoding: 'utf-8',
    env: withoutGitRepoEnv(),
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** The `<status>\t<path>` lines of a resolve report. */
function changeLines(stdout: string): string[] {
  return stdout.split('\n').filter(line => /^[A-Z]\t/.test(line));
}

function field(stdout: string, name: string): string | undefined {
  const line = stdout.split('\n').find(candidate => candidate.startsWith(`${name} `));
  return line?.slice(name.length).trim();
}

describe('stack.cjs resolve', () => {
  let repo: string;

  beforeEach(() => {
    repo = makeRepo();
  });

  it('resolves every supported shape to its base, target and changed paths', () => {
    const mergeBase = git(repo, 'merge-base', 'main', 'feature');
    const main = git(repo, 'rev-parse', 'main');
    const featureTree = git(repo, 'rev-parse', 'feature^{tree}');
    const branchChanges = ['M\ta.txt', 'D\tb.txt', 'A\tc.txt', 'M\tsrc/x.ts'];

    for (const shape of [['main...feature'], ['--merge-base', 'main', 'feature']]) {
      const result = stack(repo, 'resolve', ...shape);
      expect(result.stderr).toBe('');
      expect(result.status).toBe(0);
      expect(field(result.stdout, 'base')).toBe(mergeBase);
      expect(field(result.stdout, 'target')).toMatch(new RegExp(`^${featureTree}  \\(.+\\)$`));
      expect(field(result.stdout, 'options')).toBe('(none)');
      expect(field(result.stdout, 'diff')).toBe('4 files changed +3 -3');
      expect(changeLines(result.stdout)).toEqual(branchChanges);
    }

    for (const shape of [['main..feature'], ['main', 'feature']]) {
      const result = stack(repo, 'resolve', ...shape);
      expect(result.status).toBe(0);
      expect(field(result.stdout, 'base')).toBe(main);
      expect(changeLines(result.stdout)).toEqual([
        'M\ta.txt',
        'D\tb.txt',
        'A\tc.txt',
        'M\tdocs/d.md',
        'M\tsrc/x.ts',
      ]);
    }

    // Pathspecs, after `--` or as a positional that is not a revision.
    for (const shape of [
      ['main...feature', '--', 'a.txt', 'src'],
      ['main...feature', 'a.txt', 'src'],
    ]) {
      const result = stack(repo, 'resolve', ...shape);
      expect(result.status).toBe(0);
      expect(field(result.stdout, 'paths')).toBe('a.txt src');
      expect(changeLines(result.stdout)).toEqual(['M\ta.txt', 'M\tsrc/x.ts']);
    }

    // From a subdirectory, pathspecs are relative to it, as git reads them; `..` in a path
    // that exists does not make it a range.
    const nested = stack(path.join(repo, 'src'), 'resolve', 'main...feature', '../a.txt', 'x.ts');
    expect(nested.stderr).toBe('');
    expect(field(nested.stdout, 'paths')).toBe('../a.txt x.ts');
    expect(changeLines(nested.stdout)).toEqual(['M\ta.txt', 'M\tsrc/x.ts']);

    // Display options pass through with their separate values, in their original spelling.
    const options = stack(repo, 'resolve', '-w', '-U5', '-I', 'two words', 'main...feature');
    expect(options.status).toBe(0);
    expect(field(options.stdout, 'options')).toBe("-w -U5 -I 'two words'");

    // A separate value that looks like a selecting option is a value, not that option.
    const lookalike = stack(repo, 'resolve', '-I', '--relative', '-O', '-Sfoo', 'main...feature');
    expect(lookalike.stderr).toBe('');
    expect(lookalike.status).toBe(0);
    expect(field(lookalike.stdout, 'options')).toBe('-I --relative -O -Sfoo');
    expect(changeLines(lookalike.stdout)).toEqual(branchChanges);

    // From the merge base of a revision and HEAD, to the working tree or the index.
    git(repo, 'checkout', '-q', 'feature');
    for (const shape of [
      ['--merge-base', 'main'],
      ['--staged', '--merge-base', 'main'],
    ]) {
      const result = stack(repo, 'resolve', ...shape);
      expect(result.status).toBe(0);
      expect(field(result.stdout, 'base')).toBe(mergeBase);
      expect(changeLines(result.stdout)).toEqual(branchChanges);
    }
  });

  it('resolves the index and working-tree shapes from a copy of the index', () => {
    write(repo, 'a.txt', 'a staged\n');
    git(repo, 'add', 'a.txt');
    write(repo, 'a.txt', 'a unstaged\n');
    write(repo, 'docs/d.md', '# d, unstaged\n');
    // write-tree records the cache tree in the index, so run it before taking its bytes.
    const indexTree = git(repo, 'write-tree');
    const indexBefore = readFileSync(path.join(repo, '.git/index'));
    const head = git(repo, 'rev-parse', 'HEAD');

    const staged = stack(repo, 'resolve', '--staged');
    expect(staged.status).toBe(0);
    expect(field(staged.stdout, 'base')).toBe(head);
    expect(field(staged.stdout, 'target')?.split(' ')[0]).toBe(indexTree);
    expect(changeLines(staged.stdout)).toEqual(['M\ta.txt']);

    const cachedRev = stack(repo, 'resolve', '--cached', 'HEAD~1');
    expect(cachedRev.status).toBe(0);
    expect(field(cachedRev.stdout, 'base')).toBe(git(repo, 'rev-parse', 'HEAD~1'));
    expect(changeLines(cachedRev.stdout)).toEqual(['M\ta.txt', 'M\tdocs/d.md']);

    const worktree = stack(repo, 'resolve', 'HEAD');
    expect(worktree.status).toBe(0);
    expect(field(worktree.stdout, 'base')).toBe(head);
    expect(changeLines(worktree.stdout)).toEqual(['M\ta.txt', 'M\tdocs/d.md']);

    // Plain `git diff`: the index, committed on HEAD, to the working tree.
    const unstaged = stack(repo, 'resolve');
    expect(unstaged.status).toBe(0);
    const base = field(unstaged.stdout, 'base') as string;
    expect(base).not.toBe(head);
    expect(git(repo, 'rev-parse', `${base}^`)).toBe(head);
    expect(git(repo, 'rev-parse', `${base}^{tree}`)).toBe(indexTree);
    expect(changeLines(unstaged.stdout)).toEqual(['M\ta.txt', 'M\tdocs/d.md']);

    expect(readFileSync(path.join(repo, '.git/index')).equals(indexBefore)).toBe(true);
  });

  it('reuses HEAD as the base of an unstaged diff when nothing is staged', () => {
    write(repo, 'a.txt', 'a unstaged\n');
    const result = stack(repo, 'resolve');
    expect(result.status).toBe(0);
    expect(field(result.stdout, 'base')).toBe(git(repo, 'rev-parse', 'HEAD'));
    expect(field(result.stdout, 'options')).toBe('(none)');
    expect(changeLines(result.stdout)).toEqual(['M\ta.txt']);
  });

  it('exits 3 when the diff is empty', () => {
    const result = stack(repo, 'resolve', '--staged');
    expect(result.stdout).toBe('No changes to stack.\n');
    expect(result.status).toBe(3);
  });

  it('refuses diffs it cannot stack', () => {
    const refusals: Array<[string[], RegExp]> = [
      [['--no-index', 'a.txt', 'b.txt'], /--no-index/],
      [['-R', 'main...feature'], /-R/],
      [['-wR', 'main...feature'], /-R/],
      [['main', 'feature', 'HEAD~1'], /at most two revisions/],
      [['--merge-base'], /--merge-base requires a revision/],
      [['--cached', 'main..feature'], /--cached does not accept a revision range/],
      [['--stat', 'main...feature'], /--stat/],
    ];
    for (const [args, message] of refusals) {
      const result = stack(repo, 'resolve', ...args);
      expect(result.stdout, args.join(' ')).toBe('');
      expect(result.stderr, args.join(' ')).toMatch(message);
      expect(result.status, args.join(' ')).toBe(1);
    }
  });

  it('refuses options that select which changes the diff holds, in every spelling', () => {
    const blob = git(repo, 'rev-parse', 'feature:c.txt');
    const selecting: Array<[string[], string]> = [
      [['--diff-filter=M'], '--diff-filter'],
      [['--diff-filter', 'M'], '--diff-filter'],
      [['--diff-filter=d'], '--diff-filter'],
      [['-Sx'], '-S'],
      [['-S', 'x'], '-S'],
      [['-wSx'], '-S'],
      [['-wS', 'x'], '-S'],
      [['-S', '--relative'], '-S'],
      [['-Gx'], '-G'],
      [['-G', 'x'], '-G'],
      [['-pG', 'x'], '-G'],
      [['--pickaxe-all'], '--pickaxe-all'],
      [['--pickaxe-regex'], '--pickaxe-regex'],
      [[`--find-object=${blob}`], '--find-object'],
      [['--find-object', blob], '--find-object'],
      [['--relative'], '--relative'],
      [['--relative=src'], '--relative'],
      [['--skip-to=c.txt'], '--skip-to'],
      [['--skip-to', 'c.txt'], '--skip-to'],
      [['--ignore-submodules'], '--ignore-submodules'],
      [['--ignore-submodules=dirty'], '--ignore-submodules'],
      [['--ita-invisible-in-index'], '--ita-invisible-in-index'],
      [['--ita-visible-in-index'], '--ita-visible-in-index'],
    ];
    for (const [options, name] of selecting) {
      const args = [...options, 'main...feature'];
      const label = args.join(' ');
      const result = stack(repo, 'resolve', ...args);
      expect(result.stdout, label).toBe('');
      expect(result.status, label).toBe(1);
      const lines = result.stderr.trimEnd().split('\n');
      expect(lines, label).toHaveLength(1);
      expect(lines[0], label).toMatch(new RegExp(`^${name}: selects which changes`));
      expect(lines[0], label).toMatch(/name them after --$/);
    }

    // Every selecting option is named, once each.
    const several = stack(repo, 'resolve', '-S', 'x', '--diff-filter=M', '-Sy', 'main...feature');
    expect(
      several.stderr
        .trimEnd()
        .split('\n')
        .map(line => line.split(':')[0])
    ).toEqual(['-S', '--diff-filter']);
    expect(several.status).toBe(1);
  });
});

interface Snapshot {
  status: string;
  head: string;
  index: Buffer;
  branches: string;
}

function snapshot(repo: string): Snapshot {
  return {
    status: git(repo, 'status', '--porcelain'),
    head: git(repo, 'rev-parse', 'HEAD'),
    index: readFileSync(path.join(repo, '.git/index')),
    branches: git(repo, 'for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads/'),
  };
}

function expectUntouched(repo: string, before: Snapshot): void {
  const after = snapshot(repo);
  expect(after.status).toBe(before.status);
  expect(after.head).toBe(before.head);
  expect(after.index.equals(before.index)).toBe(true);
}

function writeSpec(repo: string, spec: unknown): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'skill-scripts-spec-'));
  scratch.push(dir);
  const file = path.join(dir, 'stack.json');
  writeFileSync(file, JSON.stringify(spec, null, 2));
  return file;
}

const THREE_STEPS = [
  { slug: '01-cleanup', subject: 'chore: drop b', description: 'Removes b.', files: ['b.txt'] },
  { slug: '02-code', subject: 'feat: bump x', files: ['src/x.ts'] },
  { slug: '03-text', subject: 'docs: revise a, add c', files: ['a.txt', 'c.txt'] },
];

describe('stack.cjs build', () => {
  let repo: string;

  beforeEach(() => {
    repo = makeRepo();
  });

  it('builds a stack that reproduces the diff and touches nothing else', () => {
    write(repo, 'a.txt', 'dirty worktree\n');
    write(repo, 'docs/d.md', '# staged\n');
    git(repo, 'add', 'docs/d.md');
    const before = snapshot(repo);
    const mergeBase = git(repo, 'merge-base', 'main', 'feature');
    const spec = writeSpec(repo, {
      diff_args: ['-w', 'main...feature'],
      prefix: 'feature-stack',
      steps: THREE_STEPS,
    });

    const result = stack(repo, 'build', spec);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);

    const short = git(repo, 'rev-parse', '--short', mergeBase);
    const branches = THREE_STEPS.map(step => `feature-stack/${step.slug}`);
    const lines = result.stdout.split('\n');
    expect(lines[0]).toBe(`Built 3 steps on ${short} for \`git diff -w main...feature\`:`);
    for (const [index, step] of THREE_STEPS.entries()) {
      const sha = git(repo, 'rev-parse', '--short', branches[index]);
      expect(lines[index + 1]).toMatch(
        new RegExp(
          `^  ${branches[index]}\\s+${sha}  ${step.subject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`
        )
      );
    }
    expect(result.stdout).toContain('The stack reproduces the diff:');
    expect(result.stdout).toContain(
      [
        `  -w ${short}..feature-stack/01-cleanup`,
        '  -w feature-stack/01-cleanup..feature-stack/02-code',
        '  -w feature-stack/02-code..feature-stack/03-text',
      ].join('\n')
    );

    // One commit per step, on the merge base, with the subject alone as its message.
    expect(
      git(repo, 'rev-list', '--reverse', `${mergeBase}..feature-stack/03-text`).split('\n')
    ).toEqual(branches.map(branch => git(repo, 'rev-parse', branch)));
    expect(git(repo, 'log', '-1', '--format=%B', branches[1]).trimEnd()).toBe('feat: bump x');
    expect(git(repo, 'diff', '--name-only', branches[0], branches[1])).toBe('src/x.ts');
    expect(git(repo, 'rev-parse', `${branches[2]}^{tree}`)).toBe(
      git(repo, 'rev-parse', 'feature^{tree}')
    );

    expectUntouched(repo, before);
    const added = git(repo, 'for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads/')
      .split('\n')
      .filter(line => !before.branches.split('\n').includes(line))
      .map(line => line.split(' ')[0]);
    expect(added).toEqual(branches.map(branch => `refs/heads/${branch}`));
  });

  it('stacks unstaged changes on a commit of the index, with trailers when the spec has them', () => {
    write(repo, 'a.txt', 'a staged\n');
    git(repo, 'add', 'a.txt');
    write(repo, 'a.txt', 'a unstaged\n');
    write(repo, 'docs/d.md', '# d, unstaged\n');
    rmSync(path.join(repo, 'src/x.ts'));
    const indexTree = git(repo, 'write-tree');
    const before = snapshot(repo);
    const spec = writeSpec(repo, {
      diff_args: [],
      prefix: 'wip-stack',
      trailers: ['Reviewed-by: Nobody <nobody@example.com>'],
      steps: [
        { slug: '01-a', subject: 'fix: a', files: ['a.txt', 'src/x.ts'] },
        { slug: '02-docs', subject: 'docs: d', files: ['docs/d.md'] },
      ],
    });

    const result = stack(repo, 'build', spec);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);

    const base = git(repo, 'rev-parse', 'wip-stack/01-a^');
    expect(git(repo, 'rev-parse', `${base}^{tree}`)).toBe(indexTree);
    expect(git(repo, 'rev-parse', `${base}^`)).toBe(before.head);
    expect(git(repo, 'show', 'wip-stack/02-docs:docs/d.md')).toBe('# d, unstaged');
    expect(git(repo, 'ls-tree', '--name-only', 'wip-stack/01-a', 'src/')).toBe('');
    expect(git(repo, 'log', '-1', '--format=%B', 'wip-stack/01-a').trimEnd()).toBe(
      'fix: a\n\nReviewed-by: Nobody <nobody@example.com>'
    );
    expectUntouched(repo, before);
  });

  it('refuses a spec that does not partition the diff, listing every problem and creating nothing', () => {
    git(repo, 'branch', 'taken-stack/old');
    const before = snapshot(repo);
    const spec = writeSpec(repo, {
      diff_args: ['main...feature'],
      prefix: 'taken-stack',
      steps: [
        { slug: '01-one', subject: 'one', files: ['a.txt', 'b.txt'] },
        { slug: '01-one', subject: 'again', files: ['a.txt'] },
        { slug: 'bad..slug', subject: 'bad', files: ['docs/d.md'] },
      ],
    });

    const result = stack(repo, 'build', spec);
    expect(result.stdout).toBe('');
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/refusing to build/);
    expect(result.stderr).toMatch(/slug '01-one' is used twice/);
    expect(result.stderr).toMatch(/a\.txt: in both 01-one and 01-one/);
    expect(result.stderr).toMatch(/docs\/d\.md: in bad\.\.slug, but the diff does not touch it/);
    expect(result.stderr).toMatch(/'taken-stack\/bad\.\.slug' is not a valid branch name/);
    expect(result.stderr).toMatch(/c\.txt: changed, but in no step/);
    expect(result.stderr).toMatch(/src\/x\.ts: changed, but in no step/);
    expect(result.stderr).toMatch(/already exist under the prefix:\n\s+taken-stack\/old/);

    const after = snapshot(repo);
    expect(after.branches).toBe(before.branches);
    expectUntouched(repo, before);
  });

  it('builds the same stack from a subdirectory as from the root', () => {
    const steps = [
      { slug: '01-cleanup', subject: 'chore: drop b', files: ['b.txt'] },
      { slug: '02-rest', subject: 'feat: the rest', files: ['src/x.ts', 'a.txt', 'c.txt'] },
    ];
    const fromRoot = stack(
      repo,
      'build',
      writeSpec(repo, { diff_args: ['main...feature'], prefix: 'root-stack', steps })
    );
    expect(fromRoot.stderr).toBe('');
    expect(fromRoot.status).toBe(0);

    const before = snapshot(repo);
    const nested = stack(
      path.join(repo, 'src'),
      'build',
      writeSpec(repo, { diff_args: ['main...feature'], prefix: 'nested-stack', steps })
    );
    expect(nested.stderr).toBe('');
    expect(nested.status).toBe(0);
    expect(nested.stdout.replace(/[0-9a-f]{7,}/g, '<sha>').replace(/nested-/g, 'root-')).toBe(
      fromRoot.stdout.replace(/[0-9a-f]{7,}/g, '<sha>')
    );
    for (const step of steps) {
      expect(git(repo, 'rev-parse', `nested-stack/${step.slug}^{tree}`)).toBe(
        git(repo, 'rev-parse', `root-stack/${step.slug}^{tree}`)
      );
    }
    expect(git(repo, 'rev-parse', 'nested-stack/01-cleanup^')).toBe(
      git(repo, 'rev-parse', 'root-stack/01-cleanup^')
    );
    expectUntouched(repo, before);

    // The other commands read the built stack the same way from anywhere in the repository.
    for (const command of ['table', 'check-imports']) {
      const spec = writeSpec(repo, { prefix: 'nested-stack', steps });
      const atRoot = stack(repo, command, spec);
      const inSrc = stack(path.join(repo, 'src'), command, spec);
      expect(atRoot.stderr, command).toBe('');
      expect(atRoot.status, command).toBe(0);
      expect(inSrc, command).toEqual(atRoot);
    }
  });

  it('refuses a diff whose options select changes, creating nothing', () => {
    const before = snapshot(repo);
    const result = stack(
      repo,
      'build',
      writeSpec(repo, {
        diff_args: ['--diff-filter=M', 'main...feature'],
        prefix: 'filtered-stack',
        steps: [{ slug: '01', subject: 's', files: ['a.txt', 'src/x.ts'] }],
      })
    );
    expect(result.stdout).toBe('');
    expect(result.stderr).toMatch(/^--diff-filter: selects which changes/);
    expect(result.status).toBe(1);
    expect(snapshot(repo).branches).toBe(before.branches);
  });

  it('refuses a malformed spec and a diff with no changes', () => {
    const missing = stack(repo, 'build', writeSpec(repo, { prefix: 'p', steps: [] }));
    expect(missing.status).toBe(1);
    expect(missing.stderr).toMatch(/"diff_args"/);
    expect(missing.stderr).toMatch(/"steps"/);

    const empty = stack(
      repo,
      'build',
      writeSpec(repo, {
        diff_args: ['--staged'],
        prefix: 'p',
        steps: [{ slug: '01', subject: 's', files: ['a.txt'] }],
      })
    );
    expect(empty.stderr).toMatch(/No changes to stack/);
    expect(empty.status).toBe(1);
    expect(git(repo, 'for-each-ref', 'refs/heads/p')).toBe('');
  });
});

/**
 * main:    src/util.ts exports a
 * feature: src/util.ts also exports b, src/helper.ts is new, src/app.ts is new and imports
 *          both, through a relative `.js` specifier, an alias, a package and a `$types` file
 *          that never exists.
 */
function makeImportsRepo(): string {
  const repo = initRepo();
  write(repo, 'src/util.ts', 'export const a = 1;\n');
  commitAll(repo, 'base');
  git(repo, 'checkout', '-q', '-b', 'feature');
  write(repo, 'src/util.ts', 'export const a = 1;\nexport function b() {\n  return a;\n}\n');
  write(repo, 'src/helper.ts', 'const h = 2;\nexport { h as default, h };\n');
  write(
    repo,
    'src/app.ts',
    [
      "import { a, b as bee } from './util.js';",
      "import { h } from '@/helper';",
      "import type { PageData } from './$types';",
      "import { useState } from 'react';",
      'export const app = a + bee() + h;',
      '',
    ].join('\n')
  );
  commitAll(repo, 'feature');
  git(repo, 'checkout', '-q', 'main');
  return repo;
}

function buildStack(repo: string, spec: unknown): string {
  const file = writeSpec(repo, spec);
  const result = stack(repo, 'build', file);
  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
  return file;
}

describe('stack.cjs check-imports', () => {
  it('reports what a step imports before a later step adds it', () => {
    const repo = makeImportsRepo();
    const spec = buildStack(repo, {
      diff_args: ['main...feature'],
      prefix: 'early',
      steps: [
        { slug: '01-app', subject: 'feat: app', files: ['src/app.ts'] },
        { slug: '02-lib', subject: 'feat: lib', files: ['src/util.ts', 'src/helper.ts'] },
      ],
    });

    const result = stack(
      repo,
      'check-imports',
      spec,
      '--alias',
      '@/=src/',
      '--ignore',
      '\\$types$'
    );
    expect(result.stderr).toBe('');
    expect(result.stdout).toBe(
      [
        'early/01-app: src/app.ts imports b from ./util.js, which src/util.ts does not export at this step',
        'early/01-app: src/app.ts imports @/helper, which does not exist at this step',
        '2 problem(s)',
        '',
      ].join('\n')
    );
    expect(result.status).toBe(1);

    // Without the alias or the ignore, the alias reads as a package and $types is missing.
    const plain = stack(repo, 'check-imports', spec);
    expect(plain.stdout).toBe(
      [
        'early/01-app: src/app.ts imports b from ./util.js, which src/util.ts does not export at this step',
        'early/01-app: src/app.ts imports ./$types, which does not exist at this step',
        'early/02-lib: src/app.ts imports ./$types, which does not exist at this step',
        '3 problem(s)',
        '',
      ].join('\n')
    );
    expect(plain.status).toBe(1);
  });

  it('reports nothing for a stack in dependency order, and refuses a malformed alias', () => {
    const repo = makeImportsRepo();
    const spec = buildStack(repo, {
      diff_args: ['main...feature'],
      prefix: 'ordered',
      steps: [
        { slug: '01-lib', subject: 'feat: lib', files: ['src/util.ts', 'src/helper.ts'] },
        { slug: '02-app', subject: 'feat: app', files: ['src/app.ts'] },
      ],
    });

    const result = stack(repo, 'check-imports', spec, '--alias=@/=src/', '--ignore=\\$types$');
    expect(result.stderr).toBe('');
    expect(result.stdout).toBe('0 problem(s)\n');
    expect(result.status).toBe(0);

    const malformed = stack(repo, 'check-imports', spec, '--alias', '@/');
    expect(malformed.stdout).toBe('');
    expect(malformed.stderr).toMatch(/--alias needs PREFIX=DIR/);
    expect(malformed.status).toBe(2);
  });
});

describe('stack.cjs table', () => {
  it('summarizes each step with its review state and a total', () => {
    const repo = makeRepo();
    const spec = buildStack(repo, {
      diff_args: ['main...feature'],
      prefix: 'feature-stack',
      steps: [
        {
          slug: '01-cleanup',
          subject: 'chore: drop b',
          description: 'Drops b | the old file.',
          files: ['b.txt'],
        },
        { slug: '02-code', subject: 'feat: bump x', files: ['src/x.ts'] },
        { slug: '03-text', subject: 'docs: revise a', description: 'Revises a.', files: ['a.txt'] },
        { slug: '04-new', subject: 'docs: add c', files: ['c.txt'] },
      ],
    });
    const dir = path.dirname(spec);
    // Serve reported the review complete: completed, whatever URL came before.
    writeFileSync(path.join(dir, '01-cleanup.review.xml'), '<review/>\n');
    writeFileSync(
      path.join(dir, '01-cleanup.serve.log'),
      [
        '[serve] Review ready at http://127.0.0.1:1/',
        '[serve] Review written to /x/01-cleanup.review.xml',
        '[serve] Review complete; stopping.',
        '',
      ].join('\n')
    );
    // A critique pre-seeded the review file, but the server is still open: its last URL.
    // A "Loaded N files" line is no longer read.
    writeFileSync(path.join(dir, '02-code.review.xml'), '<review/>\n');
    writeFileSync(
      path.join(dir, '02-code.serve.log'),
      [
        'Loaded 99 files',
        'Review ready at http://127.0.0.1:4000/#cap=old',
        'Review ready at http://127.0.0.1:4001/#cap=new',
        '',
      ].join('\n')
    );
    writeFileSync(path.join(dir, '03-text.serve.log'), 'error: something went wrong\n');

    const result = stack(repo, 'table', spec);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(
      [
        '| # | Step | Description | Diff | Review URL |',
        '|---|---|---|---|---|',
        '| 1 | `feature-stack/01-cleanup` | Drops b \\| the old file. | 1 file changed +0 -1 | completed (`01-cleanup.review.xml`) |',
        '| 2 | `feature-stack/02-code` |  | 1 file changed +1 -1 | http://127.0.0.1:4001/#cap=new |',
        '| 3 | `feature-stack/03-text` | Revises a. | 1 file changed +1 -1 | not ready, see log |',
        '| 4 | `feature-stack/04-new` |  | 1 file changed +1 -0 | not started |',
        '| | **Total** | | **4 files changed +3 -3** | |',
        '',
      ].join('\n')
    );
  });
});
