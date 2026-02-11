// src/main/git.ts
// Git command execution

import { execSync, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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

/**
 * Lightweight sync validation - checks if git is available and we're in a repo.
 * Called BEFORE Electron initialization for early exit path.
 */
export function validateGitAvailable(): void {
  try {
    execSync('git --version', { stdio: 'ignore' });
  } catch {
    console.error('Error: git is not installed or not in PATH');
    process.exit(1);
  }

  try {
    execSync('git rev-parse --git-dir', { stdio: 'ignore' });
  } catch {
    console.error('Error: not a git repository (or any parent up to mount point)');
    process.exit(1);
  }
}

/**
 * Async version of getRepoRoot - called AFTER app.whenReady().
 */
export async function getRepoRootAsync(): Promise<string> {
  try {
    const { stdout } = await execAsync('git rev-parse --show-toplevel', {
      timeout: 10000, // 10 second timeout
    });
    return stdout.trim();
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
 * Async version of runGitDiff - called AFTER app.whenReady().
 * Uses timeout to prevent hanging in CI environments.
 */
export async function runGitDiffAsync(args: string[]): Promise<string> {
  try {
    const { stdout } = await execAsync(`git diff ${args.join(' ')}`, {
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer
      timeout: 30000, // 30 second timeout
    });
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
