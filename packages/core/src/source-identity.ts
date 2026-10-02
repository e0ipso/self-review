// packages/core/src/source-identity.ts
// What a review is a review *of*, resolved once when the diff is loaded.
//
// `git diff` compares two snapshots, and which two is decided by its
// arguments: nothing compares the index with the working tree, `--cached`
// the HEAD commit with the index, `A...B` the merge base with B, and so on.
// Everything that later reads reviewed content needs those two snapshots by
// name — an image preview must show the staged bytes of a staged review,
// not whatever is in the working tree now — so they are resolved here, to
// commit SHAs where they are commits, and recorded on the session as a
// `ReviewSourceIdentity`. A shape this module cannot vouch for is marked
// `unknown`, and a read from it fails visibly rather than falling back to
// the working tree.

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

/**
 * One side of a `git diff`, as its arguments describe it and before any
 * revision is resolved. `revision` with `implicit: true` is the HEAD git
 * assumes when an argument leaves it out.
 */
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
 * The two snapshots a `git diff` argv compares. Pure: no git is run, and no
 * revision is checked to exist. Options are read with the same arity rules
 * the argument classifier uses, so an option value spelled like a flag
 * (`-S --cached`) or a pathspec after `--` is never mistaken for one.
 *
 * Shapes git documents are mapped; anything else is `unknown`: `--no-index`
 * compares paths outside the repository, three or more revisions are a
 * combined diff, and `--cached` with a range is not something git accepts.
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

/** Run git in `repository` and return its trimmed stdout, or null on any failure. */
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

/** The commit `rev` names in `repository`, or null when it names none. */
async function resolveCommit(repository: string, rev: string): Promise<string | null> {
  // `--end-of-options` keeps a revision that happens to start with `-` from
  // being read as an option; the classifier never hands one over, but the
  // guard costs nothing. `^{commit}` refuses a blob or tree: a side that is
  // not a commit is not a snapshot this program can read a path out of.
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
      // An implicit HEAD that resolves to nothing is an unborn branch: git
      // compares against the empty tree, which has no content at any path.
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

/** The physical path of `target`, or the path as resolved when it does not exist. */
export function canonicalSourcePath(target: string): string {
  try {
    return realpathSync(target);
  } catch {
    return path.resolve(target);
  }
}

/**
 * What the paths of `git diff argv` are relative to, as a directory under
 * `sourceRoot` (see `ReviewSourceIdentity.pathPrefix`): empty for
 * root-relative output; the `--relative=<dir>` directory as written, minus
 * trailing slashes; or, for a bare `--relative`, the launch directory's
 * place under the root. Git strips the prefix and one following `/` from
 * each path, so `<prefix>/<path>` is the root-relative name again.
 *
 * A bare `--relative` from outside the work tree leaves git with no prefix
 * and its paths root-relative, which is what an empty result says too.
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

/**
 * A reviewed path restated from the source root: `filePath` itself for a
 * root-relative review, `<pathPrefix>/<filePath>` otherwise. The one
 * mapping every reader, Apply and re-diff of a reviewed path goes through,
 * so they all name the same file.
 */
export function rootRelativeReviewedPath(
  identity: Pick<ReviewSourceIdentity, 'pathPrefix'>,
  filePath: string
): string {
  return identity.pathPrefix === '' ? filePath : `${identity.pathPrefix}/${filePath}`;
}

export interface GitSourceIdentityOptions {
  /** The repository root the diff was loaded from. */
  repository: string;
  /** The `git diff` arguments, after normalization. */
  gitDiffArgv: readonly string[];
  /** Defaults to the process's working directory. */
  invocationCwd?: string;
  /** `'remote'` for a materialized PR/MR; the git-mode machinery is the same. */
  mode?: 'git' | 'remote';
}

/**
 * The identity of a git-mode review: the sides its arguments compare,
 * resolved to commit SHAs against the repository as it is now. Never
 * throws; a side that cannot be resolved is `unknown` and a repository git
 * cannot read leaves both sides so.
 */
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
  /** The directory or file the scanner was given. */
  sourcePath: string;
  /** Defaults to the process's working directory. */
  invocationCwd?: string;
}

/**
 * The identity of a directory or single-file review. Everything in such a
 * review is an addition, so the old side is `none`. A single-file review
 * follows a symlink the user named on purpose, as the scanner does, and the
 * identity records where that led once so every later read opens the same
 * file; its root is the parent of the path as given, which is what the
 * scanned path is relative to.
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
