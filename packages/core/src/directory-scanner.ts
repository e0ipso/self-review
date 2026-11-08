// Scans a directory (or one file) into DiffFile[], every file a new addition.
// The walk is bounded (input-budgets.ts): ignored directories are never opened, and
// hitting `maxEntries` yields no files rather than a shorter review that looks complete.
// Only regular files are reviewed; links are never followed out of the tree.

import { opendir, stat } from 'fs/promises';
import { basename, dirname, join } from 'path';
import { DiffFile } from './types';
import { loadSyntheticFiles } from './synthetic-diff';
import { createIgnoreFilter } from './ignore-filter';
import { resolveSourceBudgets, type SourceBudgets } from './input-budgets';

export interface SourceScanOptions {
  budgets?: Partial<SourceBudgets>;
}

export interface SourceScanResult {
  files: DiffFile[];
  /** For `DiffLoadPayload.diagnostics`; empty for a clean scan. */
  diagnostics: string[];
  /** `files` is empty when this is true. */
  entryLimitExceeded: boolean;
}

/**
 * Recursively scans `directoryPath`; a directory matching `ignorePatterns` is pruned without being
 * opened.
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
 * The reviewer named this path explicitly, so a symlink is read through; the per-file budget still
 * applies.
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
  files: string[];
  limitExceeded: boolean;
}

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
          // The trailing slash lets `node_modules/`-style patterns match.
          if (shouldKeep(`${relativePath}/`)) pending.push(relativePath);
        } else if (entry.isFile()) {
          if (shouldKeep(relativePath)) files.push(relativePath);
        }
      }
    } finally {
      // Breaking out of the iterator already closes the handle; a second close throws
      // ERR_DIR_CLOSED.
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
