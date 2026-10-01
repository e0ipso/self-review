// packages/core/src/directory-scanner.ts
// Scans a directory (or one file) and produces DiffFile[] treating every
// file as a new addition.
//
// The walk is bounded before it does work (see input-budgets.ts). Ignore
// patterns are applied to directories as they are met, so an ignored
// `node_modules/` is never opened, let alone listed. Directories are read
// one entry at a time, and the walk stops the moment it has examined
// `maxEntries` entries; a stopped walk is reported as such, with no files,
// rather than as a shorter review that looks complete. Symlinks, FIFOs,
// sockets and devices are skipped: only regular files are reviewed, and a
// link is never followed out of the tree.

import { opendir, stat } from 'fs/promises';
import { basename, dirname, join } from 'path';
import { DiffFile } from './types';
import { loadSyntheticFiles } from './synthetic-diff';
import { createIgnoreFilter } from './ignore-filter';
import { resolveSourceBudgets, type SourceBudgets } from './input-budgets';

export interface SourceScanOptions {
  /** Tighter budgets than the defaults; see `SourceBudgets`. */
  budgets?: Partial<SourceBudgets>;
}

export interface SourceScanResult {
  /** The scanned files; empty when the scan failed or hit the entry budget. */
  files: DiffFile[];
  /**
   * Everything the scan could not show faithfully, for
   * `DiffLoadPayload.diagnostics`: an unreadable source, the entry budget,
   * files listed without content. Empty for a clean scan.
   */
  diagnostics: string[];
  /**
   * True when enumeration stopped at `maxEntries`. `files` is then empty:
   * a partial listing would read as the whole directory.
   */
  entryLimitExceeded: boolean;
}

/**
 * Recursively scan a directory and return every regular file in it as a new
 * addition (changeType: 'added').
 *
 * @param directoryPath - Absolute path to the directory to scan
 * @param ignorePatterns - Optional gitignore-compatible patterns; a matching
 *   directory is pruned without being opened
 */
export async function scanDirectory(
  directoryPath: string,
  ignorePatterns: string[] = [],
  options: SourceScanOptions = {}
): Promise<SourceScanResult> {
  const budgets = resolveSourceBudgets(options.budgets);

  try {
    const dirStat = await stat(directoryPath);
    if (!dirStat.isDirectory()) {
      return failed(`Cannot review "${directoryPath}": it is not a directory.`);
    }
  } catch (error) {
    return failed(`Cannot read directory "${directoryPath}": ${messageOf(error)}`);
  }

  const shouldKeep = createIgnoreFilter(ignorePatterns);
  let walk: WalkResult;
  try {
    walk = await walkDirectory(directoryPath, shouldKeep, budgets.maxEntries);
  } catch (error) {
    return failed(`Cannot read directory "${directoryPath}": ${messageOf(error)}`);
  }

  if (walk.limitExceeded) {
    console.error(`[scan] Stopped scanning ${directoryPath} after ${budgets.maxEntries} entries`);
    return {
      files: [],
      diagnostics: [
        `"${directoryPath}" has more than ${budgets.maxEntries.toLocaleString('en-US')} ` +
          'entries outside ignored directories, so it was not loaded. Review a ' +
          'subdirectory, or add ignore patterns (the `ignore` config key) for build ' +
          'output and dependency folders.',
      ],
      entryLimitExceeded: true,
    };
  }

  // Sort for deterministic output
  walk.files.sort();
  if (walk.files.length === 0) {
    return { files: [], diagnostics: [], entryLimitExceeded: false };
  }

  const { files, diagnostics } = loadSyntheticFiles(walk.files, directoryPath, {
    budgets: options.budgets,
  });
  return { files, diagnostics, entryLimitExceeded: false };
}

/**
 * Scan a single file and return it as a new addition. The path was named
 * explicitly by the reviewer, so a symlink here is read through, but the
 * per-file read budget still applies.
 *
 * @param filePath - Absolute path to the file to scan
 */
export async function scanFile(
  filePath: string,
  options: SourceScanOptions = {}
): Promise<SourceScanResult> {
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      return failed(`Cannot review "${filePath}": it is not a regular file.`);
    }
  } catch (error) {
    return failed(`Cannot read file "${filePath}": ${messageOf(error)}`);
  }

  const { files, diagnostics } = loadSyntheticFiles([basename(filePath)], dirname(filePath), {
    followSymlinks: true,
    budgets: options.budgets,
  });
  return { files, diagnostics, entryLimitExceeded: false };
}

interface WalkResult {
  /** Relative, `/`-separated paths of the regular files found. */
  files: string[];
  limitExceeded: boolean;
}

/**
 * Depth-first walk that opens only directories the ignore filter keeps and
 * counts every entry it reads against `maxEntries`.
 */
async function walkDirectory(
  root: string,
  shouldKeep: (path: string) => boolean,
  maxEntries: number
): Promise<WalkResult> {
  const files: string[] = [];
  // Relative directory paths still to open; '' is the root itself.
  const pending: string[] = [''];
  let examined = 0;

  while (pending.length > 0) {
    const relativeDir = pending.pop()!;
    const dir = await opendir(relativeDir === '' ? root : join(root, relativeDir));
    try {
      for await (const entry of dir) {
        examined++;
        if (examined > maxEntries) return { files, limitExceeded: true };

        const relativePath = relativeDir === '' ? entry.name : `${relativeDir}/${entry.name}`;
        if (entry.isDirectory()) {
          // gitignore semantics: a trailing slash marks the path as a
          // directory, so `node_modules/` and `build/` patterns match it.
          if (shouldKeep(`${relativePath}/`)) pending.push(relativePath);
        } else if (entry.isFile()) {
          if (shouldKeep(relativePath)) files.push(relativePath);
        }
        // Symlinks, FIFOs, sockets and devices are not reviewed.
      }
    } finally {
      // Breaking out of the iterator closes the handle; closing an
      // exhausted one throws ERR_DIR_CLOSED, which is not a failure here.
      await dir.close().catch(() => {});
    }
  }

  return { files, limitExceeded: false };
}

function failed(message: string): SourceScanResult {
  console.error(`[scan] ${message}`);
  return { files: [], diagnostics: [message], entryLimitExceeded: false };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
