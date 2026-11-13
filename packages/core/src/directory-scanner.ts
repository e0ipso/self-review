// Scans a directory (or one file) into DiffFile[], every file a new addition.
// The walk is bounded (input-budgets.ts): ignored directories are never opened, and
// hitting `maxEntries` yields no files rather than a shorter review that looks complete.
// Only regular files are reviewed; links are never followed out of the tree.

import { stderrReporter, type DiagnosticReporter } from './diagnostics';
import { basename, dirname, join } from 'path';
import { SafeFsError, sameFile } from './safe-fs';
import { assertNoSymlinkAncestorsAsync } from './safe-fs-read';
import type { ScanFsLayer } from './scan-fs';
import { nodeScanFsLayer } from './node-scan-fs';
import { DiffFile } from './types';
import { loadSyntheticFilesAsync } from './synthetic-diff';
import { checkLoadingCancelled, loadingCheckpoint } from './local-loading-lifetime';
import { createIgnoreFilter } from './ignore-filter';
import { resolveSourceBudgets, type SourceBudgets } from './input-budgets';

export interface SourceScanOptions {
  /** Read-only scan and descriptor capability; never falls back to the host filesystem. */
  scanFs?: ScanFsLayer;
  /** Defaults to stderr. Payload diagnostics are retained independently of presentation. */
  reportDiagnostic?: DiagnosticReporter;
  budgets?: Partial<SourceBudgets>;
  /** Rejects with CommandCancelledError, including ordinary Error abort reasons. */
  signal?: AbortSignal;
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
  checkLoadingCancelled(options.signal);
  const layer = options.scanFs ?? nodeScanFsLayer;
  const budgets = resolveSourceBudgets(options.budgets);

  let root: string;
  try {
    const dirStat = await layer.stat(directoryPath);
    checkLoadingCancelled(options.signal);
    if (!dirStat.isDirectory()) {
      return failed(
        options.reportDiagnostic,
        `Cannot review "${directoryPath}": it is not a directory.`
      );
    }
    root = await layer.realpath(directoryPath);
    checkLoadingCancelled(options.signal);
  } catch (error) {
    checkLoadingCancelled(options.signal);
    return failed(
      options.reportDiagnostic,
      `Cannot read directory "${directoryPath}": ${messageOf(error)}`
    );
  }

  const shouldKeep = createIgnoreFilter(ignorePatterns);
  let walk: WalkResult;
  try {
    walk = await walkDirectory(root, shouldKeep, budgets.maxEntries, layer, options.signal);
  } catch (error) {
    checkLoadingCancelled(options.signal);
    return failed(
      options.reportDiagnostic,
      `Cannot read directory "${directoryPath}": ${messageOf(error)}`
    );
  }

  checkLoadingCancelled(options.signal);
  if (walk.limitExceeded) {
    (options.reportDiagnostic ?? stderrReporter)(
      `[scan] Stopped scanning ${directoryPath} after ${budgets.maxEntries} entries`
    );
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

  const { files, diagnostics } = await loadSyntheticFilesAsync(walk.files, root, {
    readFs: layer,
    budgets: options.budgets,
    signal: options.signal,
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
  checkLoadingCancelled(options.signal);
  const layer = options.scanFs ?? nodeScanFsLayer;
  try {
    const fileStat = await layer.stat(filePath);
    checkLoadingCancelled(options.signal);
    if (!fileStat.isFile()) {
      return failed(
        options.reportDiagnostic,
        `Cannot review "${filePath}": it is not a regular file.`
      );
    }
  } catch (error) {
    checkLoadingCancelled(options.signal);
    return failed(options.reportDiagnostic, `Cannot read file "${filePath}": ${messageOf(error)}`);
  }

  const { files, diagnostics } = await loadSyntheticFilesAsync(
    [basename(filePath)],
    dirname(filePath),
    {
      followSymlinks: true,
      readFs: layer,
      budgets: options.budgets,
      signal: options.signal,
    }
  );
  return { files, diagnostics, entryLimitExceeded: false };
}

interface WalkResult {
  files: string[];
  limitExceeded: boolean;
}

async function walkDirectory(
  root: string,
  shouldKeep: (path: string) => boolean,
  maxEntries: number,
  layer: ScanFsLayer,
  signal?: AbortSignal
): Promise<WalkResult> {
  const files: string[] = [];
  // Relative directory paths still to open; '' is the root itself.
  const pending: string[] = [''];
  let examined = 0;

  while (pending.length > 0) {
    await loadingCheckpoint(signal);
    const relativeDir = pending.pop()!;
    const target = join(root, relativeDir);
    const before = await inspectDirectory(root, relativeDir, layer, signal);
    checkLoadingCancelled(signal);
    const dir = await layer.opendir(target);
    try {
      checkLoadingCancelled(signal);
      // opendir yields: a queued directory or one of its ancestors may have changed.
      const after = await inspectDirectory(root, relativeDir, layer, signal);
      if (!sameFile(before, after)) {
        throw new SafeFsError('identity-changed', target, `${target} changed while opening`);
      }
      for await (const entry of dir) {
        await loadingCheckpoint(signal);
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

function failed(
  reportDiagnostic: DiagnosticReporter = stderrReporter,
  message: string
): SourceScanResult {
  reportDiagnostic(`[scan] ${message}`);
  return { files: [], diagnostics: [message], entryLimitExceeded: false };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function inspectDirectory(
  root: string,
  rel: string,
  layer: ScanFsLayer,
  signal?: AbortSignal
) {
  const target = join(root, rel);
  // Include the directory itself in the ancestor walk.
  await assertNoSymlinkAncestorsAsync(root, join(rel, '.self-review-entry'), layer, signal);
  checkLoadingCancelled(signal);
  const stats = await layer.lstat(target);
  checkLoadingCancelled(signal);
  if (!stats.isDirectory() || (await layer.realpath(target)) !== target) {
    throw new SafeFsError('unsafe-link', target, `${target} is no longer a contained directory`);
  }
  checkLoadingCancelled(signal);
  return stats;
}
