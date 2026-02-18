import type { DiffFile } from '../shared/types';
import { runGitDiffAsync, getRepoRootAsync, getUntrackedFilesAsync, generateUntrackedDiffs } from './git';
import { parseDiff } from './diff-parser';

export async function loadGitDiffWithUntracked(
  gitDiffArgs: string[]
): Promise<{ files: DiffFile[]; repository: string }> {
  const repository = await getRepoRootAsync();
  const rawDiff = await runGitDiffAsync(gitDiffArgs);
  const files = parseDiff(rawDiff);

  const untrackedPaths = await getUntrackedFilesAsync();
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
