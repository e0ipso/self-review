import type { DiffFile } from '../shared/types';
import { runGitDiffAsync, getRepoRootAsync, getUntrackedFilesAsync, generateUntrackedDiffs } from './git';
import { parseDiff } from './diff-parser';

export interface LoadGitDiffOptions {
  /**
   * Include untracked working-tree files as synthetic additions. Defaults
   * to true (local git mode). Remote mode passes false: a base...head diff
   * of a PR/MR must never pick up unrelated local untracked files.
   */
  includeUntracked?: boolean;
}

export async function loadGitDiffWithUntracked(
  gitDiffArgs: string[],
  cwd?: string,
  options: LoadGitDiffOptions = {}
): Promise<{ files: DiffFile[]; repository: string }> {
  const { includeUntracked = true } = options;
  const repository = await getRepoRootAsync(cwd);
  const rawDiff = await runGitDiffAsync(gitDiffArgs, cwd);
  const files = parseDiff(rawDiff);

  if (!includeUntracked) {
    return { files, repository };
  }

  const untrackedPaths = await getUntrackedFilesAsync(cwd);
  let allFiles = files;
  if (untrackedPaths.length > 0) {
    const untrackedDiffStr = generateUntrackedDiffs(untrackedPaths, repository);
    if (untrackedDiffStr.length > 0) {
      const untrackedFiles = parseDiff(untrackedDiffStr);
      for (const file of untrackedFiles) {
        file.isUntracked = true;
      }
      allFiles = [...files, ...untrackedFiles];
    }
  }

  return { files: allFiles, repository };
}
