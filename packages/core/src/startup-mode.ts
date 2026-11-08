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
 * What a review starts from; `welcome` means nothing to review (desktop shows its picker, serve
 * refuses).
 */
export type StartupSource =
  | { mode: 'git' }
  | { mode: 'directory'; sourcePath: string }
  | { mode: 'file'; sourcePath: string }
  | { mode: 'welcome' };

/**
 * The candidate is the first *positional* by the shared classifier, so `-S src/x.ts` never selects
 * a file.
 */
export function resolveStartupSource(
  gitDiffArgs: readonly string[],
  cwd: string = process.cwd()
): StartupSource {
  const { positionalIndices } = classifyGitDiffArgs([...gitDiffArgs]);
  const firstPositional =
    positionalIndices.length > 0 ? gitDiffArgs[positionalIndices[0]] : undefined;
  const candidate = firstPositional ? resolve(cwd, firstPositional) : null;

  // Tracked files go through git diff, others are scanned.
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

/** The mode alone; see {@link resolveStartupSource} for the source path. */
export function determineMode(gitDiffArgs: string[]): 'git' | 'directory' | 'file' | 'welcome' {
  return resolveStartupSource(gitDiffArgs).mode;
}
