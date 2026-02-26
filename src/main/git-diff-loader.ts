import type { DiffFile } from '../shared/types';
import { runGitDiffAsync, getRepoRootAsync, getUntrackedFilesAsync, generateUntrackedDiffs } from './git';
import { parseDiff } from './diff-parser';

export async function loadGitDiffWithUntracked(
  gitDiffArgs: string[],
  cwd?: string
): Promise<{ files: DiffFile[]; repository: string }> {
  const repository = await getRepoRootAsync(cwd);
  const rawDiff = await runGitDiffAsync(gitDiffArgs, cwd);
  const files = parseDiff(rawDiff);

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
