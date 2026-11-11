// Git command execution. Helpers reject rather than exit; front ends report failures.

import { defaultGitRunner } from './command-runner';
import { CommandCancelledError, isCommandCancelled } from './forge-provider';
import type { ForgeCommandRunner } from './forge-provider';
import {
  generateSyntheticDiffs,
  type SyntheticDiffOptions,
  type SyntheticDiffResult,
} from './synthetic-diff';
import { parseGitDiffArgs } from './git-diff-args';
import { MAX_GIT_DIFF_OUTPUT_BYTES } from './input-budgets';

/** Optional execution effects; existing helper call forms keep their defaults. */
export interface GitExecutionOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  runner?: ForgeCommandRunner;
}

export class GitCommandError extends Error {
  constructor(
    readonly args: readonly string[],
    readonly exitCode: number,
    readonly stderr: string
  ) {
    super(`git ${args.join(' ')} failed: ${stderr.trim() || `exit ${exitCode}`}`);
    this.name = 'GitCommandError';
  }
}

/** A bounded text git command. Nonzero results reject; cancellation stays typed. */
export async function executeGit(
  args: string[],
  cwd?: string,
  options: GitExecutionOptions = {},
  maxOutputBytes = 1024 * 1024
): Promise<string> {
  if (options.signal?.aborted) throw new CommandCancelledError('aborted', 'git', args);
  const result = await (options.runner ?? defaultGitRunner)('git', args, {
    cwd,
    signal: options.signal,
    timeoutMs: options.timeoutMs ?? 10_000,
    maxOutputBytes,
  });
  if (options.signal?.aborted) throw new CommandCancelledError('aborted', 'git', args);
  if (result.exitCode !== 0) throw new GitCommandError(args, result.exitCode, result.stderr);
  return result.stdout;
}

/**
 * Strip only the single trailing newline git appends to command output.
 * A plain `.trim()` also eats leading/trailing whitespace that is part of
 * the actual path (e.g. a repository root with a trailing space), reporting
 * a path that does not exist on disk.
 */
export function stripTrailingNewline(text: string): string {
  return text.replace(/\r?\n$/, '');
}

/** Rejects when git is missing or `cwd` is not inside a repository. */
export async function getRepoRootAsync(
  cwd?: string,
  options: GitExecutionOptions = {}
): Promise<string> {
  try {
    const stdout = await executeGit(['rev-parse', '--show-toplevel'], cwd, options);
    return stripTrailingNewline(stdout);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error getting repository root: ${error.message}`);
    } else {
      console.error('Error getting repository root: unknown error');
    }
    throw error;
  }
}

/**
 * Config overrides, placed before `diff`, that keep output parseable whatever the user's config
 * says.
 */
export const PARSER_COMPATIBLE_GIT_CONFIG: readonly string[] = [
  '-c',
  'color.ui=never',
  '-c',
  'diff.noprefix=false',
  '-c',
  'diff.mnemonicPrefix=false',
  // Untracked enumeration, context expansion and Apply all resolve paths against the root.
  '-c',
  'diff.relative=false',
];

/** Appended after the user's options so a user `--color=always` or `--no-prefix` loses. */
export const PARSER_COMPATIBLE_DIFF_FLAGS: readonly string[] = [
  '--no-color',
  '--no-ext-diff',
  '--no-textconv',
  '--src-prefix=a/',
  '--dst-prefix=b/',
];

/** Inserts the flags after every user option and before `--`. */
export function withParserCompatibleDiffArgs(args: readonly string[]): string[] {
  const separator = parseGitDiffArgs(args).separatorIndex;
  if (separator === null) {
    return [...args, ...PARSER_COMPATIBLE_DIFF_FLAGS];
  }
  return [...args.slice(0, separator), ...PARSER_COMPATIBLE_DIFF_FLAGS, ...args.slice(separator)];
}

/**
 * The one entry point for every `git diff` (load, expansion, remote), so the
 * parser-compatible normalization applies uniformly. Output past `maxOutputBytes`
 * rejects with an error {@link isOutputLimitError} recognizes.
 */
export async function runGitDiffAsync(
  args: string[],
  cwd?: string,
  maxOutputBytes: number = MAX_GIT_DIFF_OUTPUT_BYTES,
  options: GitExecutionOptions = {}
): Promise<string> {
  try {
    const stdout = await executeGit(
      [...PARSER_COMPATIBLE_GIT_CONFIG, 'diff', ...withParserCompatibleDiffArgs(args)],
      cwd,
      { ...options, timeoutMs: options.timeoutMs ?? 30_000 },
      maxOutputBytes
    );
    return stdout;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error running git diff: ${error.message}`);
    } else {
      console.error('Error running git diff: unknown error');
    }
    throw error;
  }
}

/**
 * Strict enumeration for loaders (respects .gitignore); failures must reach their diagnostics.
 *
 * Pass the repository root. `git ls-files` reports paths relative to the
 * directory it runs in and lists that subtree only, while `git diff` reports
 * root-relative paths for the whole repository from anywhere inside it. Run
 * anywhere else and the names match neither the diff nor the root the files
 * are read from.
 *
 * `-z` keeps the names literal. NUL termination survives newlines in
 * filenames, and it turns off the C-style quoting git otherwise applies to
 * control characters and non-ASCII bytes.
 */
export async function listUntrackedFilesAsync(
  repoRoot?: string,
  options: GitExecutionOptions = {}
): Promise<string[]> {
  const stdout = await executeGit(
    ['ls-files', '--others', '--exclude-standard', '-z'],
    repoRoot,
    options,
    10 * 1024 * 1024
  );
  return stdout.split('\0').filter(name => name.length > 0);
}

/** Compatibility helper: callers historically receive [] and a warning on listing failure. */
export async function getUntrackedFilesAsync(
  repoRoot?: string,
  options: GitExecutionOptions = {}
): Promise<string[]> {
  try {
    return await listUntrackedFilesAsync(repoRoot, options);
  } catch (error) {
    if (isCommandCancelled(error) && error.reason === 'aborted') throw error;
    console.error(
      `Warning: Failed to list untracked files: ${error instanceof Error ? error.message : 'unknown error'}`
    );
    return [];
  }
}

/** True when a child process exceeded `maxBuffer`: a budget hit, not a git failure. */
export function isOutputLimitError(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | undefined)?.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER';
}

/**
 * Generate synthetic unified diffs for untracked files so they can be
 * parsed by the existing diff parser. Untracked symlinks are described by
 * their link text, never followed.
 */
export function generateUntrackedDiffs(
  paths: string[],
  repoRoot: string,
  options: SyntheticDiffOptions = {}
): SyntheticDiffResult {
  return generateSyntheticDiffs(paths, repoRoot, { ...options, followSymlinks: false });
}
