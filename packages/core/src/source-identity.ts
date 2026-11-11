// Resolves the two snapshots a `git diff` compares, once at load, so later reads (an image
// preview of a staged review) use those bytes and not the working tree. A shape this
// module cannot vouch for is `unknown`, and a read from it fails visibly.

import { realpathSync } from 'fs';
import * as path from 'path';
import type { ReviewSourceIdentity, ReviewSourceSide } from './types';
import { parseGitDiffArgs, describeDiffPathRelativity } from './git-diff-args';

import { executeGit, type GitExecutionOptions } from './git';
import { isCommandCancelled } from './forge-provider';

/** One side as the arguments describe it, before resolution; `implicit` is the HEAD git assumes. */
export type GitDiffSideSpec =
  | { kind: 'working-tree' }
  | { kind: 'index' }
  | { kind: 'revision'; rev: string; implicit: boolean }
  | { kind: 'merge-base'; left: string; right: string }
  | { kind: 'unknown'; reason: string };

export interface GitDiffSides {
  oldSide: GitDiffSideSpec;
  newSide: GitDiffSideSpec;
}

const WORKING_TREE: GitDiffSideSpec = { kind: 'working-tree' };
const INDEX: GitDiffSideSpec = { kind: 'index' };
const HEAD: GitDiffSideSpec = { kind: 'revision', rev: 'HEAD', implicit: true };

function revision(rev: string): GitDiffSideSpec {
  return rev === '' ? HEAD : { kind: 'revision', rev, implicit: false };
}

function mergeBase(left: string, right: string): GitDiffSideSpec {
  return { kind: 'merge-base', left: left || 'HEAD', right: right || 'HEAD' };
}

function unknownSides(reason: string): GitDiffSides {
  return { oldSide: { kind: 'unknown', reason }, newSide: { kind: 'unknown', reason } };
}

/**
 * The two snapshots a `git diff` argv compares. Pure: runs no git and checks no revision.
 * Uses the classifier's arity rules, so `-S --cached` is not a flag. `--no-index`, three
 * or more revisions and `--cached` with a range are `unknown`.
 */
export function describeGitDiffSides(argv: readonly string[]): GitDiffSides {
  const parsed = parseGitDiffArgs(argv);
  const names = new Set(parsed.options.map(option => option.name));
  if (names.has('--no-index')) return unknownSides('--no-index compares paths, not snapshots');
  const revs = parsed.positionalIndices
    .filter(index => parsed.separatorIndex === null || index < parsed.separatorIndex)
    .map(index => argv[index]);
  const cached = names.has('--cached') || names.has('--staged');
  const reverse = names.has('-R');
  const useMergeBase = names.has('--merge-base');

  const sides = describeRevisionSides(revs, cached, useMergeBase);
  return reverse ? { oldSide: sides.newSide, newSide: sides.oldSide } : sides;
}

function describeRevisionSides(
  revs: readonly string[],
  cached: boolean,
  useMergeBase: boolean
): GitDiffSides {
  if (revs.length === 0) {
    if (useMergeBase) return unknownSides('--merge-base requires a revision');
    return cached ? { oldSide: HEAD, newSide: INDEX } : { oldSide: INDEX, newSide: WORKING_TREE };
  }

  if (revs.length === 1) {
    const rev = revs[0];
    const symmetric = rev.indexOf('...');
    if (symmetric !== -1) {
      if (cached) return unknownSides('--cached does not accept a revision range');
      const left = rev.slice(0, symmetric);
      const right = rev.slice(symmetric + 3);
      return { oldSide: mergeBase(left, right), newSide: revision(right) };
    }
    const range = rev.indexOf('..');
    if (range !== -1) {
      if (cached) return unknownSides('--cached does not accept a revision range');
      return { oldSide: revision(rev.slice(0, range)), newSide: revision(rev.slice(range + 2)) };
    }
    const oldSide = useMergeBase ? mergeBase(rev, 'HEAD') : revision(rev);
    return { oldSide, newSide: cached ? INDEX : WORKING_TREE };
  }

  if (revs.length === 2) {
    if (cached) return unknownSides('--cached does not accept two revisions');
    const [left, right] = revs;
    return {
      oldSide: useMergeBase ? mergeBase(left, right) : revision(left),
      newSide: revision(right),
    };
  }

  return unknownSides(`a combined diff of ${revs.length} revisions has no single old side`);
}

async function gitOutput(
  repository: string,
  args: string[],
  options: GitExecutionOptions
): Promise<string | null> {
  try {
    return (await executeGit(args, repository, options)).replace(/\r?\n$/, '');
  } catch (error) {
    if (isCommandCancelled(error)) throw error;
    return null;
  }
}

const SHA_PATTERN = /^[0-9a-f]{40,64}$/;

async function resolveCommit(
  repository: string,
  rev: string,
  options: GitExecutionOptions
): Promise<string | null> {
  // `--end-of-options` keeps a leading `-` from being an option; `^{commit}` refuses a blob or
  // tree.
  const sha = await gitOutput(
    repository,
    ['rev-parse', '--verify', '--quiet', '--end-of-options', `${rev}^{commit}`],
    options
  );
  return sha !== null && SHA_PATTERN.test(sha) ? sha : null;
}

async function resolveSide(
  repository: string,
  spec: GitDiffSideSpec,
  options: GitExecutionOptions
): Promise<ReviewSourceSide> {
  switch (spec.kind) {
    case 'working-tree':
    case 'index':
    case 'unknown':
      return spec;
    case 'revision': {
      const sha = await resolveCommit(repository, spec.rev, options);
      if (sha !== null) return { kind: 'commit', sha };
      // An implicit HEAD resolving to nothing is an unborn branch: the empty tree.
      if (spec.implicit) return { kind: 'none' };
      return { kind: 'unknown', reason: `${spec.rev} does not name a commit` };
    }
    case 'merge-base': {
      const sha = await gitOutput(repository, ['merge-base', spec.left, spec.right], options);
      if (sha !== null && SHA_PATTERN.test(sha)) return { kind: 'commit', sha };
      return {
        kind: 'unknown',
        reason: `no merge base between ${spec.left} and ${spec.right}`,
      };
    }
  }
}

export function canonicalSourcePath(target: string): string {
  try {
    return realpathSync(target);
  } catch {
    return path.resolve(target);
  }
}

/**
 * `ReviewSourceIdentity.pathPrefix`: empty for root-relative output, the
 * `--relative=<dir>` directory without trailing slashes, or for bare `--relative`
 * the launch directory under the root (empty when outside the work tree, as in git).
 */
export function resolveReviewedPathPrefix(
  gitDiffArgv: readonly string[],
  sourceRoot: string,
  invocationCwd: string
): string {
  const relative = describeDiffPathRelativity(gitDiffArgv);
  switch (relative.kind) {
    case 'root':
      return '';
    case 'directory':
      return relative.directory.replace(/\/+$/, '');
    case 'cwd': {
      const fromRoot = path.relative(
        canonicalSourcePath(sourceRoot),
        canonicalSourcePath(invocationCwd)
      );
      if (fromRoot === '' || fromRoot.startsWith('..') || path.isAbsolute(fromRoot)) return '';
      return fromRoot.split(path.sep).join('/');
    }
  }
}

/** The one mapping every reader, Apply and re-diff uses, so they all name the same file. */
export function rootRelativeReviewedPath(
  identity: Pick<ReviewSourceIdentity, 'pathPrefix'>,
  filePath: string
): string {
  return identity.pathPrefix === '' ? filePath : `${identity.pathPrefix}/${filePath}`;
}

export interface GitSourceIdentityOptions extends GitExecutionOptions {
  repository: string;
  gitDiffArgv: readonly string[];
  /** Defaults to the process's working directory. */
  invocationCwd?: string;
  /** `'remote'` for a materialized PR/MR; the git-mode machinery is the same. */
  mode?: 'git' | 'remote';
}

/** Resolves commits once. Unresolvable revisions become `unknown`; cancellation rejects. */
export async function resolveGitSourceIdentity(
  options: GitSourceIdentityOptions
): Promise<ReviewSourceIdentity> {
  const sides = describeGitDiffSides(options.gitDiffArgv);
  const repository = options.repository;
  const [oldSide, newSide] = await Promise.all([
    resolveSide(repository, sides.oldSide, options),
    resolveSide(repository, sides.newSide, options),
  ]);
  const emptyTreeSha =
    oldSide.kind === 'none' || newSide.kind === 'none'
      ? await gitOutput(repository, ['hash-object', '-t', 'tree', '--stdin'], options)
      : null;
  const sourceRoot = canonicalSourcePath(repository);
  const invocationCwd = options.invocationCwd ?? process.cwd();
  return {
    mode: options.mode ?? 'git',
    ...(emptyTreeSha !== null && SHA_PATTERN.test(emptyTreeSha) ? { emptyTreeSha } : {}),
    sourceRoot,
    invocationCwd,
    gitDiffArgv: [...options.gitDiffArgv],
    pathPrefix: resolveReviewedPathPrefix(options.gitDiffArgv, sourceRoot, invocationCwd),
    oldSide,
    newSide,
  };
}

export interface LocalSourceIdentityOptions {
  type: 'directory' | 'file';
  sourcePath: string;
  /** Defaults to the process's working directory. */
  invocationCwd?: string;
}

/**
 * Everything is an addition, so the old side is `none`. A single-file review follows a
 * symlink the user named, recording its target once; its root is the parent of the path as given.
 */
export function resolveLocalSourceIdentity(
  options: LocalSourceIdentityOptions
): ReviewSourceIdentity {
  const invocationCwd = options.invocationCwd ?? process.cwd();
  if (options.type === 'directory') {
    return {
      mode: 'directory',
      sourceRoot: canonicalSourcePath(options.sourcePath),
      invocationCwd,
      gitDiffArgv: [],
      pathPrefix: '',
      oldSide: { kind: 'none' },
      newSide: { kind: 'directory' },
    };
  }
  return {
    mode: 'file',
    sourceRoot: canonicalSourcePath(path.dirname(options.sourcePath)),
    invocationCwd,
    gitDiffArgv: [],
    pathPrefix: '',
    oldSide: { kind: 'none' },
    newSide: { kind: 'file', path: canonicalSourcePath(options.sourcePath) },
  };
}
