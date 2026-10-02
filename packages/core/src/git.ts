// Git command execution. Helpers reject rather than exit; front ends report failures.

import { execFile } from 'child_process';
import { promisify } from 'util';
import {
  generateSyntheticDiffs,
  type SyntheticDiffOptions,
  type SyntheticDiffResult,
} from './synthetic-diff';
import { MAX_GIT_DIFF_OUTPUT_BYTES } from './input-budgets';

const execFileAsync = promisify(execFile);

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
export async function getRepoRootAsync(cwd?: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--show-toplevel'], {
      timeout: 10000, // 10 second timeout
      cwd,
    });
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
  const separator = args.indexOf('--');
  if (separator === -1) {
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
  maxOutputBytes: number = MAX_GIT_DIFF_OUTPUT_BYTES
): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      [...PARSER_COMPATIBLE_GIT_CONFIG, 'diff', ...withParserCompatibleDiffArgs(args)],
      {
        maxBuffer: maxOutputBytes,
        timeout: 30000, // 30 second timeout
        cwd,
      }
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
 * Get list of untracked files (respects .gitignore).
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
export async function getUntrackedFilesAsync(repoRoot?: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['ls-files', '--others', '--exclude-standard', '-z'],
      {
        maxBuffer: 10 * 1024 * 1024,
        timeout: 10000,
        cwd: repoRoot,
      }
    );
    return stdout.split('\0').filter(name => name.length > 0);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Warning: Failed to list untracked files: ${error.message}`);
    } else {
      console.error('Warning: Failed to list untracked files: unknown error');
    }
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
