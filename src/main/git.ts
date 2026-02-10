// src/main/git.ts
// Git command execution

import { execSync } from 'child_process';

export function runGitDiff(args: string[]): string {
  try {
    // Check if git is available
    try {
      execSync('git --version', { stdio: 'ignore' });
    } catch {
      console.error('Error: git is not installed or not in PATH');
      process.exit(1);
    }

    // Check if we're in a git repository
    try {
      execSync('git rev-parse --git-dir', { stdio: 'ignore' });
    } catch {
      console.error('Error: not a git repository (or any parent up to mount point)');
      process.exit(1);
    }

    // Run git diff with the provided arguments
    const result = execSync(`git diff ${args.join(' ')}`, {
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large diffs
    });

    return result;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error running git diff: ${error.message}`);
    } else {
      console.error('Error running git diff: unknown error');
    }
    process.exit(1);
  }
}

export function getRepoRoot(): string {
  try {
    const result = execSync('git rev-parse --show-toplevel', {
      encoding: 'utf-8',
    });
    return result.trim();
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error getting repository root: ${error.message}`);
    } else {
      console.error('Error getting repository root: unknown error');
    }
    process.exit(1);
  }
}
