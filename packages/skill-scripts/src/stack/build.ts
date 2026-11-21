// `build`: create one local branch per spec step whose commits, taken together, reproduce
// the diff. Every commit is built on a throwaway index; the branches are created only after
// the stack is shown to reproduce the diff, in one all-or-nothing ref transaction. The
// working tree, the real index, HEAD and every existing ref are never written.

import * as path from 'path';
import { formatGitDiffArgs } from '../../../core/src/git-argument-text';
import { StackError, git, gitValue, nulSplit, shortSha, tryGit, withTempDir } from './git';
import { NO_CHANGES, changedPaths, rawDiff, resolveDiff } from './resolve';
import { branchName, loadSpec, type StackSpec, type StackStep } from './spec';

interface BuiltStep {
  branch: string;
  commit: string;
  subject: string;
}

interface TreeEntry {
  mode: string;
  oid: string;
}

/** Every changed path in exactly one step, no path outside the diff, no slug twice. */
export function partitionProblems(spec: StackSpec, changes: ReadonlyMap<string, string>): string[] {
  const problems: string[] = [];
  const slugs = new Set<string>();
  const owner = new Map<string, string>();
  for (const step of spec.steps) {
    if (slugs.has(step.slug)) problems.push(`slug '${step.slug}' is used twice`);
    slugs.add(step.slug);
    for (const file of step.files) {
      const previous = owner.get(file);
      if (previous !== undefined) problems.push(`${file}: in both ${previous} and ${step.slug}`);
      else if (!changes.has(file)) {
        problems.push(`${file}: in ${step.slug}, but the diff does not touch it`);
      }
      if (previous === undefined) owner.set(file, step.slug);
    }
  }
  for (const file of [...changes.keys()].sort()) {
    if (!owner.has(file)) problems.push(`${file}: changed, but in no step`);
  }
  return problems;
}

/** Branch names git accepts, and no step branch nested under another. */
function branchNameProblems(spec: StackSpec): string[] {
  const problems: string[] = [];
  const names = spec.steps.map(step => branchName(spec, step));
  for (const name of new Set(names)) {
    if (tryGit(['check-ref-format', '--branch', name]).status !== 0) {
      problems.push(`'${name}' is not a valid branch name`);
    }
    const parent = names.find(other => name.startsWith(`${other}/`));
    if (parent !== undefined)
      problems.push(`'${name}' cannot be a branch while '${parent}' is one`);
  }
  return problems;
}

/** Existing branches under the prefix, or ones a step branch would have to sit beneath. */
function takenBranchProblems(spec: StackSpec): string[] {
  // A ref name cannot contain a newline, so one ref per line is unambiguous.
  const existing = git(['for-each-ref', '--format=%(refname)', 'refs/heads/'])
    .split('\n')
    .filter(ref => ref !== '')
    .map(ref => ref.slice('refs/heads/'.length));
  const under = existing.filter(name => name === spec.prefix || name.startsWith(`${spec.prefix}/`));
  const problems: string[] = [];
  if (under.length > 0) {
    problems.push(`branches already exist under the prefix:\n    ${under.join('\n    ')}`);
  }
  const names = spec.steps.map(step => branchName(spec, step));
  for (const name of existing) {
    if (!under.includes(name) && names.some(branch => branch.startsWith(`${name}/`))) {
      problems.push(`branch '${name}' exists, so no branch can be created under it`);
    }
  }
  return problems;
}

/** Mode and object of every file in `tree`, by path from the root, wherever the helper runs. */
function treeEntries(tree: string): Map<string, TreeEntry> {
  const entries = new Map<string, TreeEntry>();
  for (const line of nulSplit(git(['ls-tree', '-r', '--full-tree', '-z', tree]))) {
    const tab = line.indexOf('\t');
    const [mode, , oid] = line.slice(0, tab).split(' ');
    entries.set(line.slice(tab + 1), { mode, oid });
  }
  return entries;
}

function commitMessage(spec: StackSpec, step: StackStep): string {
  const trailers = spec.trailers.length > 0 ? `\n${spec.trailers.join('\n')}\n` : '';
  return `${step.subject}\n${trailers}`;
}

/** `update-index --index-info` lines staging each path's final state; mode 0 removes one. */
function indexInfo(
  step: StackStep,
  changes: ReadonlyMap<string, string>,
  entries: ReadonlyMap<string, TreeEntry>,
  zero: string
): string {
  return step.files
    .map(file => {
      if (changes.get(file) === 'D') return `0 ${zero}\t${file}\0`;
      const entry = entries.get(file);
      if (entry === undefined) throw new StackError(`${file}: not in the target tree`);
      return `${entry.mode} ${entry.oid}\t${file}\0`;
    })
    .join('');
}

/** One commit per step, chained on `base`, built on a throwaway index. Creates no ref. */
function buildCommits(
  spec: StackSpec,
  base: string,
  target: string,
  changes: ReadonlyMap<string, string>
): BuiltStep[] {
  const entries = treeEntries(target);
  const zero = '0'.repeat(base.length);
  return withTempDir(dir => {
    const env = { GIT_INDEX_FILE: path.join(dir, 'index') };
    git(['read-tree', base], { env });
    let parent = base;
    return spec.steps.map(step => {
      git(['update-index', '-z', '--index-info'], {
        env,
        input: indexInfo(step, changes, entries, zero),
      });
      const tree = gitValue(['write-tree'], { env });
      parent = gitValue(['commit-tree', tree, '-p', parent], {
        input: commitMessage(spec, step),
      });
      return { branch: branchName(spec, step), commit: parent, subject: step.subject };
    });
  });
}

/**
 * Create every branch or none: `create` fails when a ref already exists. The reflog message
 * records where the branches came from.
 */
function createBranches(steps: readonly BuiltStep[]): void {
  git(['update-ref', '-m', 'self-review-stack build', '--stdin'], {
    input: steps.map(step => `create refs/heads/${step.branch} ${step.commit}\n`).join(''),
  });
}

function report(
  spec: StackSpec,
  base: string,
  passThrough: readonly string[],
  summary: string,
  steps: readonly BuiltStep[]
): string {
  const baseShort = shortSha(base);
  const width = Math.max(...steps.map(step => step.branch.length));
  const lines = [
    `Built ${steps.length} steps on ${baseShort} for \`${formatGitDiffArgs(['git', 'diff', ...spec.diffArgs])}\`:`,
    ...steps.map(
      step => `  ${step.branch.padEnd(width)}  ${shortSha(step.commit)}  ${step.subject}`
    ),
    `The stack reproduces the diff: ${summary}.`,
    "Diff args for each step's guide and server:",
  ];
  let previous = baseShort;
  for (const step of steps) {
    lines.push(`  ${formatGitDiffArgs([...passThrough, `${previous}..${step.branch}`])}`);
    previous = step.branch;
  }
  return `${lines.join('\n')}\n`;
}

/** `build <spec.json>`: 0 once every branch exists; a refusal creates nothing. */
export function cmdBuild(specFile: string): number {
  const spec = loadSpec(specFile, { requireDiffArgs: true });
  const { base, target, paths, passThrough, summary } = resolveDiff(spec.diffArgs);
  const changes = new Map(changedPaths(base, target, paths).map(c => [c.path, c.status]));
  if (changes.size === 0) throw new StackError(NO_CHANGES);

  const problems = [
    ...partitionProblems(spec, changes),
    ...branchNameProblems(spec),
    ...takenBranchProblems(spec),
  ];
  if (problems.length > 0) throw new StackError(`refusing to build:\n  ${problems.join('\n  ')}`);

  const steps = buildCommits(spec, base, target, changes);
  const top = steps[steps.length - 1].commit;
  if (!rawDiff(base, top).equals(rawDiff(base, target, paths))) {
    throw new StackError('the stack does not reproduce the diff; no branches were created');
  }
  createBranches(steps);
  process.stdout.write(report(spec, base, passThrough, summary, steps));
  return 0;
}
