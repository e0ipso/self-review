import type { DiffFile } from './types';
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

export interface LoadGitDiffOptions {
  /**
   * Include untracked working-tree files as synthetic additions. Defaults
   * to true (local git mode). Remote mode passes false: a base...head diff
   * of a PR/MR must never pick up unrelated local untracked files.
   */
  includeUntracked?: boolean;
  /** Tighter budgets than the defaults; see `SourceBudgets`. */
  budgets?: Partial<SourceBudgets>;
}

export interface LoadGitDiffResult {
  files: DiffFile[];
  repository: string;
  /**
   * Everything the review cannot show faithfully: an output format the
   * parser does not consume (in which case `files` is empty and git was not
   * run), or input the parser could not represent (combined merge-conflict
   * sections, hunks whose counts do not add up). Never empty-and-silent: a
   * front end shows these instead of "no changes".
   */
  diagnostics: string[];
}

/** The path a diff entry is keyed by throughout the review. */
function entryPath(file: DiffFile): string {
  return file.newPath || file.oldPath;
}

/**
 * Drop synthetic untracked entries whose path the tracked diff already
 * reports. After `git rm --cached f`, a HEAD comparison carries a tracked
 * deletion of `f` while `f` is still on disk as an untracked file; two
 * entries under one path would share React keys, comment state and the
 * lazy-hunk lookup. The tracked entry is the one git itself reported, so it
 * wins.
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

  // An output format the parser cannot read would parse as an empty review.
  // Name the flag instead, and do not run git at all.
  const unsupported = findUnsupportedGitDiffOptions(gitDiffArgs);
  if (unsupported.length > 0) {
    return {
      files: [],
      repository,
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
    // A capped capture is a truncated diff; never parse it as the review.
    return {
      files: [],
      repository,
      diagnostics: [
        `git diff produced more than ${formatBytes(budgets.maxGitDiffOutputBytes)} of output, ` +
          'the most self-review reads from one diff, so nothing was loaded. Narrow the ' +
          'diff with a pathspec (for example `-- src/`) or a smaller revision range.',
      ],
    };
  }
  const { files, diagnostics } = parseDiffWithDiagnostics(rawDiff);

  if (!includeUntracked) {
    return { files, repository, diagnostics };
  }

  // Enumerate at the repository root. `git diff` reports root-relative paths
  // for the whole repository, while `git ls-files` reports cwd-relative paths
  // for the cwd subtree only. Read those cwd-relative names against the root
  // and a nested file resolves to its same-named root neighbour, or to
  // nothing at all.
  const untrackedPaths = await getUntrackedFilesAsync(repository);
  if (untrackedPaths.length > budgets.maxEntries) {
    // Too many to synthesize; review the tracked diff and say what is missing.
    diagnostics.push(
      `${untrackedPaths.length.toLocaleString('en-US')} untracked files exceed the ` +
        `${budgets.maxEntries.toLocaleString('en-US')}-file limit, so none of them were ` +
        'loaded; only tracked changes are shown. Ignore build output and dependency ' +
        'folders in .gitignore, or stage the files you mean to review.'
    );
    return { files, repository, diagnostics };
  }

  let allFiles = files;
  if (untrackedPaths.length > 0) {
    // Untracked symlinks are described by their link text, never followed.
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

  return { files: allFiles, repository, diagnostics };
}
