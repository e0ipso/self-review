// packages/core/src/startup-mode.ts
// Startup mode detection: what the app should review, from the CLI args and the CWD.

import { existsSync, statSync } from 'fs';
import { execFileSync, execSync } from 'child_process';
import { resolve } from 'path';
import { classifyGitDiffArgs } from './git-diff-args';

/**
 * Check if `cwd` is inside a git repository.
 */
function isInGitRepo(cwd: string): boolean {
  try {
    execSync('git rev-parse --git-dir', { stdio: 'ignore', cwd });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a file is tracked by git (known to the index).
 */
function isGitTracked(filePath: string, cwd: string): boolean {
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', '--', filePath], {
      stdio: 'ignore',
      cwd,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * What a review starts from: the repository the launch directory is in
 * (`git`), or the one positional argument that names an existing directory
 * or file (`directory`, `file`), resolved against the launch directory. In
 * `welcome` there is nothing to review; the desktop shows its directory
 * picker and serve refuses to start.
 */
export type StartupSource =
  | { mode: 'git' }
  | { mode: 'directory'; sourcePath: string }
  | { mode: 'file'; sourcePath: string }
  | { mode: 'welcome' };

/**
 * Decide what the arguments review, from the launch directory `cwd`. The
 * candidate path is the first *positional* argument by the shared
 * classifier, so an option's value (`-S src/x.ts`) is never taken for the
 * file to review, and the path selected is the path the scanner is handed:
 * the two cannot disagree.
 */
export function resolveStartupSource(
  gitDiffArgs: readonly string[],
  cwd: string = process.cwd()
): StartupSource {
  const { positionalIndices } = classifyGitDiffArgs([...gitDiffArgs]);
  const firstPositional =
    positionalIndices.length > 0 ? gitDiffArgs[positionalIndices[0]] : undefined;
  const candidate = firstPositional ? resolve(cwd, firstPositional) : null;

  // An existing file: tracked files go through git diff, others are scanned.
  if (candidate && firstPositional && isExisting(candidate, 'file')) {
    if (isInGitRepo(cwd)) {
      return isGitTracked(firstPositional, cwd)
        ? { mode: 'git' }
        : { mode: 'file', sourcePath: candidate };
    }
    return { mode: 'file', sourcePath: candidate };
  }

  if (isInGitRepo(cwd)) {
    return { mode: 'git' };
  }

  // Not in a git repo: an existing directory is scanned.
  if (candidate && isExisting(candidate, 'directory')) {
    return { mode: 'directory', sourcePath: candidate };
  }

  return { mode: 'welcome' };
}

function isExisting(candidate: string, kind: 'file' | 'directory'): boolean {
  try {
    if (!existsSync(candidate)) return false;
    const stats = statSync(candidate);
    return kind === 'file' ? stats.isFile() : stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Determine the startup mode based on git availability and CLI arguments.
 * Returns the DiffSource type to use. See {@link resolveStartupSource} for
 * the source path that goes with it.
 */
export function determineMode(gitDiffArgs: string[]): 'git' | 'directory' | 'file' | 'welcome' {
  return resolveStartupSource(gitDiffArgs).mode;
}
