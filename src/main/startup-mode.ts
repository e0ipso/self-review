// src/main/startup-mode.ts
// Deciding what kind of thing is being reviewed, from the CLI arguments and
// the state of the working directory.
//
// Lifted verbatim out of `main.ts` so serve mode resolves its session exactly
// as the Electron main process does rather than with a second copy of this
// logic. Nothing here imports `electron`.

import { execSync } from 'child_process';
import { existsSync, statSync } from 'fs';
import { resolve } from 'path';

/** What the startup arguments and working directory add up to. */
export type StartupMode = 'git' | 'directory' | 'file' | 'welcome';

/**
 * Check if the current working directory is inside a git repository.
 */
export function isInGitRepo(): boolean {
  try {
    execSync('git rev-parse --git-dir', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a file is tracked by git (known to the index).
 */
export function isGitTracked(filePath: string): boolean {
  try {
    execSync(`git ls-files --error-unmatch ${JSON.stringify(filePath)}`, {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Determine the startup mode based on git availability and CLI arguments.
 * Returns the DiffSource type to use.
 */
export function determineMode(gitDiffArgs: string[]): StartupMode {
  // Find the first positional arg, skipping flags and the '--' separator
  // (normalizeGitDiffArgs may have inserted '--' before path args)
  const firstPositional = gitDiffArgs.find(a => a !== '--' && !a.startsWith('-'));

  // Check if first positional arg is an existing file
  if (firstPositional) {
    const candidate = resolve(process.cwd(), firstPositional);
    try {
      if (existsSync(candidate) && statSync(candidate).isFile()) {
        if (isInGitRepo()) {
          // In git repo: tracked files go through git diff, untracked use file mode
          return isGitTracked(firstPositional) ? 'git' : 'file';
        }
        return 'file';
      }
    } catch {
      // Failed to stat — fall through
    }
  }

  if (isInGitRepo()) {
    return 'git';
  }

  // Not in a git repo — check if first positional arg is an existing directory
  if (firstPositional) {
    const candidate = resolve(process.cwd(), firstPositional);
    try {
      if (existsSync(candidate) && statSync(candidate).isDirectory()) {
        return 'directory';
      }
    } catch {
      // Failed to stat — fall through to welcome
    }
  }

  return 'welcome';
}
