import type { DiffFile, ReviewSourceIdentity } from './types';
import {
  runGitDiffAsync,
  getRepoRootAsync,
  getUntrackedFilesAsync,
  isOutputLimitError,
} from './git';
import { parseDiffWithDiagnostics } from './diff-parser';
import { findUnsupportedGitDiffOptions } from './git-diff-args';
import { loadSyntheticFiles } from './synthetic-diff';
import { formatBytes, resolveSourceBudgets, type SourceBudgets } from './input-budgets';
import { resolveGitSourceIdentity } from './source-identity';

export interface LoadGitDiffOptions {
  /**
   * Include untracked working-tree files as synthetic additions. Defaults
   * to true (local git mode). Remote mode passes false: a base...head diff
   * of a PR/MR must never pick up unrelated local untracked files.
   */
  includeUntracked?: boolean;
  budgets?: Partial<SourceBudgets>;
}

export interface LoadGitDiffResult {
  files: DiffFile[];
  repository: string;
  /** What the diff compared; previews and line counts read this snapshot, not the working tree. */
  identity: ReviewSourceIdentity;
  /** What could not be shown faithfully; front ends show these instead of "no changes". */
  diagnostics: string[];
}

/** The path a diff entry is keyed by throughout the review. */
function entryPath(file: DiffFile): string {
  return file.newPath || file.oldPath;
}

/**
 * Tracked wins on a path collision (after `git rm --cached f`, `f` is both a
 * deletion and untracked); two entries would share React keys and comment state.
 */
export function dedupeUntrackedByPath(tracked: DiffFile[], untracked: DiffFile[]): DiffFile[] {
  const seen = new Set(tracked.map(entryPath));
  return untracked.filter(file => !seen.has(entryPath(file)));
}

export async function loadGitDiffWithUntracked(
  gitDiffArgs: string[],
  cwd?: string,
  options: LoadGitDiffOptions = {}
): Promise<LoadGitDiffResult> {
  const { includeUntracked = true } = options;
  const budgets = resolveSourceBudgets(options.budgets);
  const repository = await getRepoRootAsync(cwd);
  // Before the diff runs, so the SHAs hold even if a ref moves meanwhile.
  const identity = await resolveGitSourceIdentity({
    repository,
    gitDiffArgv: gitDiffArgs,
    invocationCwd: cwd ?? process.cwd(),
  });

  // Such output would parse as an empty review; name the flag and skip git.
  const unsupported = findUnsupportedGitDiffOptions(gitDiffArgs);
  if (unsupported.length > 0) {
    return {
      files: [],
      repository,
      identity,
      diagnostics: unsupported.map(
        flag =>
          `Unsupported git diff option ${flag}: self-review reads patch output only; ` +
          'remove it to review the changes.'
      ),
    };
  }

  let rawDiff: string;
  try {
    rawDiff = await runGitDiffAsync(gitDiffArgs, cwd, budgets.maxGitDiffOutputBytes);
  } catch (error) {
    if (!isOutputLimitError(error)) throw error;
    // A truncated diff must never be parsed as the review.
    return {
      files: [],
      repository,
      identity,
      diagnostics: [
        `git diff produced more than ${formatBytes(budgets.maxGitDiffOutputBytes)} of output, ` +
          'the most self-review reads from one diff, so nothing was loaded. Narrow the ' +
          'diff with a pathspec (for example `-- src/`) or a smaller revision range.',
      ],
    };
  }
  const { files, diagnostics } = parseDiffWithDiagnostics(rawDiff);

  if (!includeUntracked) {
    return { files, repository, identity, diagnostics };
  }

  // Enumerate at the repository root. `git diff` reports root-relative paths
  // for the whole repository, while `git ls-files` reports cwd-relative paths
  // for the cwd subtree only. Read those cwd-relative names against the root
  // and a nested file resolves to its same-named root neighbour, or to
  // nothing at all.
  const untrackedPaths = await getUntrackedFilesAsync(repository);
  if (untrackedPaths.length > budgets.maxEntries) {
    diagnostics.push(
      `${untrackedPaths.length.toLocaleString('en-US')} untracked files exceed the ` +
        `${budgets.maxEntries.toLocaleString('en-US')}-file limit, so none of them were ` +
        'loaded; only tracked changes are shown. Ignore build output and dependency ' +
        'folders in .gitignore, or stage the files you mean to review.'
    );
    return { files, repository, identity, diagnostics };
  }

  let allFiles = files;
  if (untrackedPaths.length > 0) {
    const untracked = loadSyntheticFiles(untrackedPaths, repository, {
      followSymlinks: false,
      budgets: options.budgets,
    });
    diagnostics.push(...untracked.diagnostics);
    const untrackedFiles = dedupeUntrackedByPath(files, untracked.files);
    for (const file of untrackedFiles) {
      file.isUntracked = true;
    }
    allFiles = [...files, ...untrackedFiles];
  }

  return { files: allFiles, repository, identity, diagnostics };
}
