// `resolve`: turn `git diff` arguments into what a stack is built from. Core decides how the
// arguments parse and which two snapshots they compare; this module adds what a stack needs
// on top: a commit to start from, a tree to end at, and the options that only change how a
// diff is shown, passed through to every step.

import { copyFileSync, existsSync } from 'fs';
import * as path from 'path';
import {
  findUnsupportedGitDiffOptions,
  parseGitDiffArgs,
  type ParsedGitDiffArgs,
} from '../../../core/src/git-argument-policy';
import { formatGitDiffArgs } from '../../../core/src/git-argument-text';
import { describeGitDiffSides, type GitDiffSideSpec } from '../../../core/src/source-identity';
import {
  StackError,
  commitOf,
  commitOrNull,
  git,
  gitBytes,
  gitValue,
  treeOf,
  tryGit,
  withTempDir,
} from './git';
import { diffstat, shortstat } from './stats';

export interface ResolvedDiff {
  /** The commit the stack starts from. */
  base: string;
  /** The tree the stack must end at (within `paths`). */
  target: string;
  /** Pathspecs limiting the diff, relative to the current directory as git reads them. */
  paths: string[];
  /** Display options, as written, for every step's diff arguments. */
  passThrough: string[];
  /** One line naming what is compared. */
  summary: string;
}

export interface Change {
  status: string;
  path: string;
}

/** Options that choose the snapshots compared; they shape the stack, not each step's diff. */
const STACK_OPTIONS = new Set(['--staged', '--cached', '--merge-base']);

// Every diff the helper runs reports paths from the repository root, whatever the config.
const ROOT_PATHS = ['-c', 'diff.relative=false'];

interface ClassifiedArgs {
  /** The arguments without pathspecs: what decides the two sides. */
  sidesArgv: string[];
  revisions: string[];
  paths: string[];
  passThrough: string[];
}

/** A range, unless a path by that name exists (`../docs`), or a name for a commit. */
function isRevision(arg: string): boolean {
  if (arg.includes('..') && !existsSync(arg)) return true;
  return commitOrNull(arg) !== null;
}

/**
 * Split the arguments into revisions, pathspecs and pass-through options. A positional
 * before `--` is a revision when it is a range or names a commit, and a path otherwise, as
 * git itself reads it. An option's separate value stays with its option.
 */
function classify(argv: readonly string[], parsed: ParsedGitDiffArgs): ClassifiedArgs {
  const end = parsed.separatorIndex ?? argv.length;
  const optionNames = new Map<number, string[]>();
  for (const option of parsed.options) {
    optionNames.set(option.index, [...(optionNames.get(option.index) ?? []), option.name]);
  }
  const positionals = new Set(parsed.positionalIndices);
  const revisions: string[] = [];
  const paths: string[] = [];
  const pathIndices = new Set<number>();
  const passThrough: string[] = [];
  let keeping = false;
  for (let i = 0; i < end; i++) {
    const names = optionNames.get(i);
    if (positionals.has(i)) {
      keeping = false;
      if (isRevision(argv[i])) revisions.push(argv[i]);
      else {
        paths.push(argv[i]);
        pathIndices.add(i);
      }
    } else if (names !== undefined) {
      keeping = !names.some(name => STACK_OPTIONS.has(name));
      if (keeping) passThrough.push(argv[i]);
    } else if (keeping) {
      passThrough.push(argv[i]); // the separate value of the option before it
    }
  }
  paths.push(...argv.slice(end + 1));
  const sidesArgv = argv.slice(0, end).filter((_, index) => !pathIndices.has(index));
  return { sidesArgv, revisions, paths, passThrough };
}

/** Refuse what cannot become a stack, before running anything that writes objects. */
function refuseUnstackable(argv: readonly string[], parsed: ParsedGitDiffArgs): void {
  const names = new Set(parsed.options.map(option => option.name));
  if (names.has('--no-index')) {
    throw new StackError(
      '--no-index compares files outside the repository; there is no history to stack on'
    );
  }
  if (names.has('-R')) {
    throw new StackError('-R reverses the diff; name the same diff in its forward direction');
  }
  const unsupported = findUnsupportedGitDiffOptions(argv);
  if (unsupported.length > 0) {
    throw new StackError(
      `${unsupported.join(' ')}: self-review cannot load this output format; leave it out`
    );
  }
}

/**
 * The tree of the index, or of the working tree's tracked files, built from a copy of the
 * index so the real one is never written.
 */
function snapshot(worktree: boolean): string {
  const realIndex = path.resolve(gitValue(['rev-parse', '--git-path', 'index']));
  return withTempDir(dir => {
    const copy = path.join(dir, 'index');
    if (existsSync(realIndex)) copyFileSync(realIndex, copy);
    const env = { GIT_INDEX_FILE: copy };
    if (worktree) {
      git(['-C', gitValue(['rev-parse', '--show-toplevel']), 'add', '--update'], { env });
    }
    const result = tryGit(['write-tree'], { env });
    if (result.status !== 0) {
      throw new StackError(`cannot snapshot the index:\n${result.stderr.trim()}`);
    }
    return result.stdout.trim();
  });
}

/** Unstaged changes start from the index, which is not a commit; the stack needs one. */
function indexCommit(): string {
  const head = commitOf('HEAD');
  const tree = snapshot(false);
  if (tree === treeOf(head)) return head;
  return gitValue(['commit-tree', tree, '-p', head], {
    input: 'The index this stack builds on\n',
  });
}

function mergeBase(left: string, right: string): string {
  const result = tryGit(['merge-base', commitOf(left), commitOf(right)]);
  if (result.status !== 0) throw new StackError(`${left} and ${right} have no merge base`);
  return result.stdout.trim();
}

function unstackableSide(side: GitDiffSideSpec): StackError {
  const reason = side.kind === 'unknown' ? side.reason : `the ${side.kind} cannot be that side`;
  return new StackError(`cannot stack this diff: ${reason}`);
}

function resolveBase(side: GitDiffSideSpec): string {
  switch (side.kind) {
    case 'revision':
      return commitOf(side.rev);
    case 'merge-base':
      return mergeBase(side.left, side.right);
    case 'index':
      return indexCommit();
    default:
      throw unstackableSide(side);
  }
}

function resolveTarget(side: GitDiffSideSpec): string {
  switch (side.kind) {
    case 'revision':
      return treeOf(commitOf(side.rev));
    case 'index':
      return snapshot(false);
    case 'working-tree':
      return snapshot(true);
    default:
      throw unstackableSide(side);
  }
}

function describeSide(side: GitDiffSideSpec): string {
  switch (side.kind) {
    case 'revision':
      return side.rev;
    case 'merge-base':
      return `the merge base of ${side.left} and ${side.right}`;
    case 'index':
      return 'the index';
    case 'working-tree':
      return 'the working tree';
    case 'unknown':
      return side.reason;
  }
}

/** The stack's base commit, target tree, pathspecs and pass-through options. */
export function resolveDiff(argv: readonly string[]): ResolvedDiff {
  const parsed = parseGitDiffArgs(argv);
  refuseUnstackable(argv, parsed);
  const { sidesArgv, revisions, paths, passThrough } = classify(argv, parsed);
  if (revisions.length > 2) {
    throw new StackError(`at most two revisions bound a diff, got ${revisions.join(' ')}`);
  }
  const { oldSide, newSide } = describeGitDiffSides(sidesArgv);
  const base = resolveBase(oldSide);
  const target = resolveTarget(newSide);
  return {
    base,
    target,
    paths,
    passThrough,
    summary: `${describeSide(newSide)} against ${describeSide(oldSide)}`,
  };
}

/** The paths that differ, with their `--name-status` letter, renames split. */
export function changedPaths(base: string, target: string, paths: readonly string[]): Change[] {
  const tokens = git([
    ...ROOT_PATHS,
    'diff',
    '--name-status',
    '--no-renames',
    '-z',
    base,
    target,
    '--',
    ...paths,
  ]).split('\0');
  const changes: Change[] = [];
  for (let i = 0; i + 1 < tokens.length; i += 2) {
    changes.push({ status: tokens[i], path: tokens[i + 1] });
  }
  return changes;
}

/** `git diff --raw` bytes: equal for two diffs exactly when they change the same blobs. */
export function rawDiff(base: string, target: string, paths: readonly string[] = []): Buffer {
  return gitBytes([
    ...ROOT_PATHS,
    'diff',
    '--raw',
    '--no-renames',
    '--no-abbrev',
    '-z',
    base,
    target,
    '--',
    ...paths,
  ]);
}

export const NO_CHANGES = 'No changes to stack.';

/** `resolve <git-diff-args...>`: 0 with a report, 3 when nothing changed. */
export function cmdResolve(argv: readonly string[]): number {
  const { base, target, paths, passThrough, summary } = resolveDiff(argv);
  const changes = changedPaths(base, target, paths);
  if (changes.length === 0) {
    process.stdout.write(`${NO_CHANGES}\n`);
    return 3;
  }
  const lines = [`base     ${base}`, `target   ${target}  (${summary})`];
  if (paths.length > 0) lines.push(`paths    ${formatGitDiffArgs(paths)}`);
  lines.push(`options  ${passThrough.length > 0 ? formatGitDiffArgs(passThrough) : '(none)'}`);
  lines.push(`diff     ${diffstat(shortstat(base, target, paths))}`);
  for (const change of changes) lines.push(`${change.status}\t${change.path}`);
  process.stdout.write(`${lines.join('\n')}\n`);
  return 0;
}
