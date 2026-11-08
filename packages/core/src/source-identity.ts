// Resolves the two snapshots a `git diff` compares, once at load, so later reads (an image
// preview of a staged review) use those bytes and not the working tree. A shape this
// module cannot vouch for is `unknown`, and a read from it fails visibly.

import { execFile } from 'child_process';
import { realpathSync } from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import type { ReviewSourceIdentity, ReviewSourceSide } from './types';
import {
  classifyGitDiffArgs,
  consumesNextArgument,
  describeDiffPathRelativity,
} from './git-diff-args';

const execFileAsync = promisify(execFile);

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
  const separator = argv.indexOf('--');
  const end = separator === -1 ? argv.length : separator;
  const positional = new Set(
    classifyGitDiffArgs([...argv]).positionalIndices.filter(index => index < end)
  );

  let cached = false;
  let reverse = false;
  let useMergeBase = false;
  const revs: string[] = [];
  for (let i = 0; i < end; i++) {
    const arg = argv[i];
    if (positional.has(i)) {
      revs.push(arg);
      continue;
    }
    if (consumesNextArgument(arg)) {
      i++;
      continue;
    }
    if (arg === '--cached' || arg === '--staged') cached = true;
    else if (arg === '-R') reverse = true;
    else if (arg === '--merge-base') useMergeBase = true;
    else if (arg === '--no-index') return unknownSides('--no-index compares paths, not snapshots');
  }

  const sides = describeRevisionSides(revs, cached, useMergeBase);
  return reverse ? { oldSide: sides.newSide, newSide: sides.oldSide } : sides;
}

function describeRevisionSides(
  revs: readonly string[],
  cached: boolean,
  useMergeBase: boolean
): GitDiffSides {
  if (revs.length === 0) {
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

async function gitOutput(repository: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd: repository,
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
    });
    return stdout.replace(/\r?\n$/, '');
  } catch {
    return null;
  }
}

const SHA_PATTERN = /^[0-9a-f]{40,64}$/;

async function resolveCommit(repository: string, rev: string): Promise<string | null> {
  // `--end-of-options` keeps a leading `-` from being an option; `^{commit}` refuses a blob or
  // tree.
  const sha = await gitOutput(repository, [
    'rev-parse',
    '--verify',
    '--quiet',
    '--end-of-options',
    `${rev}^{commit}`,
  ]);
  return sha !== null && SHA_PATTERN.test(sha) ? sha : null;
}

async function resolveSide(repository: string, spec: GitDiffSideSpec): Promise<ReviewSourceSide> {
  switch (spec.kind) {
    case 'working-tree':
    case 'index':
    case 'unknown':
      return spec;
    case 'revision': {
      const sha = await resolveCommit(repository, spec.rev);
      if (sha !== null) return { kind: 'commit', sha };
      // An implicit HEAD resolving to nothing is an unborn branch: the empty tree.
      if (spec.implicit) return { kind: 'none' };
      return { kind: 'unknown', reason: `${spec.rev} does not name a commit` };
    }
    case 'merge-base': {
      const sha = await gitOutput(repository, ['merge-base', spec.left, spec.right]);
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

export interface GitSourceIdentityOptions {
  repository: string;
  gitDiffArgv: readonly string[];
  /** Defaults to the process's working directory. */
  invocationCwd?: string;
  /** `'remote'` for a materialized PR/MR; the git-mode machinery is the same. */
  mode?: 'git' | 'remote';
}

/** Resolves the compared sides to commit SHAs. Never throws; an unresolvable side is `unknown`. */
export async function resolveGitSourceIdentity(
  options: GitSourceIdentityOptions
): Promise<ReviewSourceIdentity> {
  const sides = describeGitDiffSides(options.gitDiffArgv);
  const repository = options.repository;
  const [oldSide, newSide] = await Promise.all([
    resolveSide(repository, sides.oldSide),
    resolveSide(repository, sides.newSide),
  ]);
  const sourceRoot = canonicalSourcePath(repository);
  const invocationCwd = options.invocationCwd ?? process.cwd();
  return {
    mode: options.mode ?? 'git',
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
