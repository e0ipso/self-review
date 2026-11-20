// Spawning git for the stack helper. Every call is an argument array (never a shell string)
// run in the current directory, which is the repository the reviewer launched the helper in.

import { spawnSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';

/** A refusal or failure the CLI reports on stderr with exit status 1. */
export class StackError extends Error {}

export interface GitCallOptions {
  /** Extra environment, e.g. `GIT_INDEX_FILE` for a throwaway index. */
  env?: NodeJS.ProcessEnv;
  input?: string;
}

export interface GitResult<T> {
  status: number;
  stdout: T;
  stderr: string;
}

// Big enough for `ls-tree -r` or `diff --raw` of a very large repository.
const MAX_BUFFER = 1024 * 1024 * 1024;

function spawnGit(
  args: readonly string[],
  options: GitCallOptions,
  encoding: 'utf8' | 'buffer'
): GitResult<string | Buffer> {
  const result = spawnSync('git', [...args], {
    encoding: encoding === 'utf8' ? 'utf8' : 'buffer',
    env: options.env ? { ...process.env, ...options.env } : process.env,
    input: options.input,
    maxBuffer: MAX_BUFFER,
  });
  if (result.error) throw new StackError(`cannot run git: ${result.error.message}`);
  return {
    status: result.status ?? 1,
    stdout: result.stdout,
    stderr: result.stderr.toString(),
  };
}

/** Run git and return its result whatever the exit status. */
export function tryGit(args: readonly string[], options: GitCallOptions = {}): GitResult<string> {
  return spawnGit(args, options, 'utf8') as GitResult<string>;
}

function failure(args: readonly string[], stderr: string): StackError {
  return new StackError(`git ${args.join(' ')} failed:\n${stderr.trim()}`);
}

/** Run git and return its stdout untouched; a non-zero exit is a `StackError`. */
export function git(args: readonly string[], options: GitCallOptions = {}): string {
  const result = tryGit(args, options);
  if (result.status !== 0) throw failure(args, result.stderr);
  return result.stdout;
}

/** `git` for output compared byte for byte, so no path is altered by decoding. */
export function gitBytes(args: readonly string[], options: GitCallOptions = {}): Buffer {
  const result = spawnGit(args, options, 'buffer') as GitResult<Buffer>;
  if (result.status !== 0) throw failure(args, result.stderr);
  return result.stdout;
}

/** `git` for a single value (a SHA, a path): surrounding whitespace removed. */
export function gitValue(args: readonly string[], options: GitCallOptions = {}): string {
  return git(args, options).trim();
}

/** The non-empty items of `-z` output. */
export function nulSplit(text: string): string[] {
  return text.split('\0').filter(item => item !== '');
}

/** The commit `rev` names, or null when it names none. */
export function commitOrNull(rev: string): string | null {
  const result = tryGit([
    'rev-parse',
    '--verify',
    '--quiet',
    '--end-of-options',
    `${rev}^{commit}`,
  ]);
  return result.status === 0 ? result.stdout.trim() : null;
}

/** The commit `rev` names; refuses when it names none. */
export function commitOf(rev: string): string {
  const sha = commitOrNull(rev);
  if (sha === null) throw new StackError(`${rev} does not name a commit`);
  return sha;
}

export function treeOf(commit: string): string {
  return gitValue(['rev-parse', `${commit}^{tree}`]);
}

/** The shortest unambiguous abbreviation of `sha`. */
export function shortSha(sha: string): string {
  return gitValue(['rev-parse', '--short', sha]);
}

/** Run `work` with a fresh temporary directory, removed afterwards whatever happens. */
export function withTempDir<T>(work: (dir: string) => T): T {
  const dir = mkdtempSync(path.join(tmpdir(), 'self-review-stack-'));
  try {
    return work(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
