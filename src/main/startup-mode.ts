// src/main/startup-mode.ts
// Startup mode detection: what the app should review, from the CLI args and the CWD.

import { existsSync, statSync } from 'fs';
import { execSync } from 'child_process';
import { resolve } from 'path';

/**
 * Check if the current working directory is inside a git repository.
 */
function isInGitRepo(): boolean {
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
function isGitTracked(filePath: string): boolean {
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
export function determineMode(gitDiffArgs: string[]): 'git' | 'directory' | 'file' | 'welcome' {
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
