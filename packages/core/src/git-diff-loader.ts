import type { DiffFile, ReviewSourceIdentity } from './types';
import {
  runGitDiffAsync,
  getRepoRootAsync,
  listUntrackedFilesAsync,
  type GitExecutionOptions,
  isOutputLimitError,
} from './git';
import { parseDiffWithDiagnosticsAsync } from './diff-parser-async';
import { findUnsupportedGitDiffOptions } from './git-diff-args';
import { loadSyntheticFilesAsync } from './synthetic-diff';
import { formatBytes, resolveSourceBudgets, type SourceBudgets } from './input-budgets';
import { isCommandCancelled } from './forge-provider';
import { checkLoadingCancelled } from './local-loading-lifetime';
import { pinnedGitDiffArgs } from './pinned-comparison';
import { resolveGitSourceIdentity } from './source-identity';

export interface LoadGitDiffOptions extends GitExecutionOptions {
  /**
   * Include untracked working-tree files as synthetic additions. Defaults
   * to true (local git mode). Remote mode passes false: a base...head diff
   * of a PR/MR must never pick up unrelated local untracked files.
   */
  includeUntracked?: boolean;
  budgets?: Partial<SourceBudgets>;
  /** Effective application ignore filter, in the same namespace as tracked diff paths. */
  shouldKeep?: (path: string) => boolean;
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
  checkLoadingCancelled(options.signal);
  const { includeUntracked = true } = options;
  const budgets = resolveSourceBudgets(options.budgets);
  const repository = await getRepoRootAsync(cwd, options);
  // Resolve once, then execute against those same commits if a symbolic ref moves.
  const identity = await resolveGitSourceIdentity({
    repository,
    gitDiffArgv: gitDiffArgs,
    invocationCwd: cwd ?? process.cwd(),
    signal: options.signal,
    runner: options.runner,
    timeoutMs: options.timeoutMs,
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
    rawDiff = await runGitDiffAsync(
      pinnedGitDiffArgs(identity),
      cwd,
      budgets.maxGitDiffOutputBytes,
      options
    );
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
  checkLoadingCancelled(options.signal);
  const { files, diagnostics } = await parseDiffWithDiagnosticsAsync(rawDiff, {
    signal: options.signal,
    budgets,
  });
  checkLoadingCancelled(options.signal);

  if (!includeUntracked) {
    return { files, repository, identity, diagnostics };
  }

  // Enumerate and read against the physical root, then name entries exactly like the
  // tracked patch. Filter before counting entries or spending synthetic read budgets.
  let listed: string[];
  try {
    listed = await listUntrackedFilesAsync(repository, options);
  } catch (error) {
    checkLoadingCancelled(options.signal);
    if (isCommandCancelled(error) && error.reason === 'aborted') throw error;
    diagnostics.push(
      `Untracked files could not be listed; only tracked changes are shown: ${error instanceof Error ? error.message : String(error)}`
    );
    return { files, repository, identity, diagnostics };
  }
  checkLoadingCancelled(options.signal);
  const prefix = identity.pathPrefix === '' ? '' : `${identity.pathPrefix}/`;
  const reviewPath = (rootPath: string) => rootPath.slice(prefix.length);
  const trackedPaths = new Set(files.map(entryPath));
  const untrackedPaths = listed.filter(
    filePath =>
      filePath.startsWith(prefix) &&
      (options.shouldKeep?.(reviewPath(filePath)) ?? true) &&
      !trackedPaths.has(reviewPath(filePath))
  );
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
    const untracked = await loadSyntheticFilesAsync(untrackedPaths, repository, {
      followSymlinks: false,
      budgets: {
        ...budgets,
        maxDiffFiles: Math.max(0, budgets.maxDiffFiles - files.length),
        maxDiffHunks: Math.max(
          0,
          budgets.maxDiffHunks - files.reduce((n, f) => n + f.hunks.length, 0)
        ),
        maxTotalLines: Math.max(
          0,
          budgets.maxTotalLines -
            files.reduce((n, f) => n + f.hunks.reduce((m, h) => m + h.lines.length, 0), 0)
        ),
      },
      signal: options.signal,
    });
    diagnostics.push(...untracked.diagnostics);
    for (const file of untracked.files) {
      if (file.newPath) file.newPath = reviewPath(file.newPath);
      if (file.oldPath) file.oldPath = reviewPath(file.oldPath);
    }
    const untrackedFiles = dedupeUntrackedByPath(files, untracked.files);
    for (const file of untrackedFiles) {
      file.isUntracked = true;
    }
    // A normal working-tree comparison already reads synthetic additions from the
    // right place. Only store overrides when tracked files use another new side.
    if (untrackedFiles.length > 0 && identity.newSide.kind !== 'working-tree') {
      identity.fileSources = new Map(
        untrackedFiles.map(file => [
          entryPath(file),
          {
            oldSide: { kind: 'none' as const },
            newSide: { kind: 'working-tree' as const },
          },
        ])
      );
    }
    allFiles = [...files, ...untrackedFiles];
  }

  checkLoadingCancelled(options.signal);
  return { files: allFiles, repository, identity, diagnostics };
}
