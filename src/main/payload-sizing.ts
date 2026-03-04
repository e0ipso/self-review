// src/main/payload-sizing.ts
// Payload size estimation and threshold checking for large review guards.

import { exec } from 'child_process';
import { promisify } from 'util';
import type { DiffFile, AppConfig, PayloadStats } from '../shared/types';

const execAsync = promisify(exec);

/**
 * Compute payload statistics and check against configured thresholds.
 * A maxFiles or maxTotalLines value of 0 disables that guard.
 */
export function computePayloadStats(
  fileCount: number,
  totalLines: number,
  config: AppConfig
): PayloadStats {
  const maxFiles = config.maxFiles;
  const maxTotalLines = config.maxTotalLines;
  const exceedsFiles = maxFiles > 0 && fileCount > maxFiles;
  const exceedsLines = maxTotalLines > 0 && totalLines > maxTotalLines;
  return {
    fileCount,
    totalLines,
    exceedsFiles,
    exceedsLines,
    exceedsAny: exceedsFiles || exceedsLines,
  };
}

/**
 * Count total diff lines across all files and hunks.
 */
export function countTotalLines(files: DiffFile[]): number {
  let total = 0;
  for (const file of files) {
    for (const hunk of file.hunks) {
      total += hunk.lines.length;
    }
  }
  return total;
}

/**
 * Get git diff stats cheaply using --numstat (avoids full diff parsing).
 * Each output line is "added\tremoved\tfilename".
 * Returns file count and total changed lines (added + removed).
 */
export async function getGitDiffStats(
  args: string[],
  repoRoot: string
): Promise<{ fileCount: number; totalLines: number }> {
  try {
    const { stdout } = await execAsync(`git diff --numstat ${args.join(' ')}`, {
      maxBuffer: 10 * 1024 * 1024,
      timeout: 15000,
      cwd: repoRoot,
    });

    let fileCount = 0;
    let totalLines = 0;

    for (const line of stdout.trim().split('\n')) {
      if (!line) continue;
      const parts = line.split('\t');
      if (parts.length < 3) continue;

      fileCount++;
      // Binary files show '-' for added/removed
      const added = parts[0] === '-' ? 0 : parseInt(parts[0], 10);
      const removed = parts[1] === '-' ? 0 : parseInt(parts[1], 10);
      totalLines += (isNaN(added) ? 0 : added) + (isNaN(removed) ? 0 : removed);
    }

    return { fileCount, totalLines };
  } catch (error) {
    if (error instanceof Error) {
      console.error(`[payload-sizing] Failed to get git diff stats: ${error.message}`);
    } else {
      console.error('[payload-sizing] Failed to get git diff stats: unknown error');
    }
    // Return zeros so the guard does not block on failure
    return { fileCount: 0, totalLines: 0 };
  }
}
