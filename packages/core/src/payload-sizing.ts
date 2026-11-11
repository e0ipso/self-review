// src/main/payload-sizing.ts
// Payload size estimation and threshold checking for large review guards.

import { executeGit, type GitExecutionOptions } from './git';
import { isCommandCancelled } from './forge-provider';
import type { DiffFile, AppConfig, PayloadStats } from './types';

/**
 * Compute payload statistics and check against configured thresholds.
 * A maxFiles or maxTotalLines value of 0 disables that guard.
 */
export function computePayloadStats(
  fileCount: number,
  totalLines: number,
  config: Pick<AppConfig, 'maxFiles' | 'maxTotalLines'>
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

export interface GitDiffStats {
  fileCount: number;
  totalLines: number;
}

export type GitDiffStatsResult =
  | { available: true; stats: GitDiffStats }
  | { available: false; error: unknown };

/**
 * Bounded --numstat lookup. Unavailable statistics are distinct from a genuinely empty diff.
 * Abort and timeout reject with CommandCancelledError instead of becoming an empty result.
 */
export async function getGitDiffStatsResult(
  args: string[],
  repoRoot: string,
  options: GitExecutionOptions = {}
): Promise<GitDiffStatsResult> {
  try {
    const stdout = await executeGit(
      ['diff', '--numstat', ...args],
      repoRoot,
      { ...options, timeoutMs: options.timeoutMs ?? 15_000 },
      10 * 1024 * 1024
    );
    let fileCount = 0;
    let totalLines = 0;
    for (const line of stdout.trim().split('\n')) {
      if (!line) continue;
      const parts = line.split('\t');
      if (parts.length < 3) continue;
      fileCount++;
      // Binary files show '-' for added/removed.
      const added = parts[0] === '-' ? 0 : parseInt(parts[0], 10);
      const removed = parts[1] === '-' ? 0 : parseInt(parts[1], 10);
      totalLines += (isNaN(added) ? 0 : added) + (isNaN(removed) ? 0 : removed);
    }
    return { available: true, stats: { fileCount, totalLines } };
  } catch (error) {
    if (isCommandCancelled(error)) throw error;
    return { available: false, error };
  }
}

/**
 * Compatibility lookup: failures still warn and return zeros so existing guards do not block.
 * Use getGitDiffStatsResult to distinguish failure from an empty diff. Cancellation requested
 * through the additive execution options propagates; the historical default timeout falls back.
 */
export async function getGitDiffStats(
  args: string[],
  repoRoot: string,
  options: GitExecutionOptions = {}
): Promise<GitDiffStats> {
  let error: unknown;
  try {
    const result = await getGitDiffStatsResult(args, repoRoot, options);
    if (result.available) return result.stats;
    error = result.error;
  } catch (caught) {
    if (options.signal || options.timeoutMs !== undefined) throw caught;
    error = caught;
  }
  console.error(
    `[payload-sizing] Failed to get git diff stats: ${error instanceof Error ? error.message : 'unknown error'}`
  );
  return { fileCount: 0, totalLines: 0 };
}
