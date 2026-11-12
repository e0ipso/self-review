// First-party git loading brackets mutable reads with bounded, read-only source evidence.
import path from 'node:path';
import { captureIndex, verifyIndexCapture } from './index-capture';
import { executeGit, getRepoRootAsync } from './git';
import { loadGitDiffWithUntracked } from './git-diff-loader';
import type { LoadGitDiffOptions, LoadGitDiffResult } from './git-diff-loader';
import { describeGitDiffSides, rootRelativeReviewedPath } from './source-identity';
import { resolveSourceBudgets } from './input-budgets';
import { findUnsupportedGitDiffOptions } from './git-diff-args';
import { comparisonPaths } from './comparison-paths';
import { assertNoSymlinkAncestorsAsync, nodeReadFsLayer } from './safe-fs-read';
import type { BoundedAsyncReadFsLayer } from './safe-fs-read';
import { checkLoadingCancelled, loadingCheckpoint } from './local-loading-lifetime';
import {
  recordLoadedSnapshot,
  sourceStamp,
  sourceCapture,
  RELOAD_REVIEW,
  type PhysicalCapture,
} from './loaded-snapshot';

/** Exact stage-zero object names, with NUL-delimited literal paths (including tabs/newlines). */
export async function readIndexManifest(
  root: string,
  options: LoadGitDiffOptions = {},
  paths?: readonly string[]
): Promise<Map<string, string>> {
  const budgets = resolveSourceBudgets(options.budgets);
  const manifest = new Map<string, string>();
  // Literal path batches bound argv size; unrelated index entries never spend capture budgets.
  const batches: string[][] = [];
  if (paths === undefined) batches.push([]);
  else {
    let batch: string[] = [];
    let bytes = 0;
    for (const filePath of paths) {
      const literal = `:(literal)${filePath}`;
      const length = Buffer.byteLength(literal) + 1;
      if (batch.length && (batch.length >= 64 || bytes + length > 16_384)) {
        batches.push(batch);
        batch = [];
        bytes = 0;
      }
      batch.push(literal);
      bytes += length;
    }
    if (batch.length) batches.push(batch);
  }
  let remaining = budgets.maxGitDiffOutputBytes;
  for (const batch of batches) {
    await loadingCheckpoint(options.signal);
    if (remaining <= 0) throw new Error('Index capture exceeds the byte budget');
    const text = await executeGit(
      ['ls-files', '--stage', '-z', '--', ...batch],
      root,
      options,
      remaining
    );
    remaining -= Buffer.byteLength(text);
    let start = 0;
    while (start < text.length) {
      await loadingCheckpoint(options.signal);
      const end = text.indexOf('\0', start);
      if (end === -1) throw new Error('Invalid index manifest');
      const record = text.slice(start, end);
      const match = /^([0-7]{6}) ([0-9a-f]{40,64}) ([0-3])\t([\s\S]*)$/.exec(record);
      if (!match) throw new Error('Invalid index manifest');
      if (match[3] === '0') manifest.set(match[4], match[2]);
      // Conflict paths still need physical drift checks, but have no stage-zero blob to read.
      else if (!manifest.has(match[4])) manifest.set(match[4], '');
      start = end + 1;
    }
  }
  return manifest;
}

export async function inspectPhysicalSource(
  root: string,
  relative: string,
  readFs: BoundedAsyncReadFsLayer,
  signal?: AbortSignal
): Promise<PhysicalCapture | undefined> {
  try {
    await assertNoSymlinkAncestorsAsync(root, relative, readFs, signal);
    checkLoadingCancelled(signal);
    const target = path.join(root, relative);
    const stats = await readFs.lstat(target);
    checkLoadingCancelled(signal);
    if (!stats.isFile() || (await readFs.realpath(target)) !== target) return undefined;
    return { target, stamp: sourceStamp(stats), readFs };
  } catch {
    checkLoadingCancelled(signal);
    return undefined;
  }
}

/** Source loading and later physical reads must belong to the same supplied filesystem. */
export interface GitSnapshotDependencies {
  readonly readFs: BoundedAsyncReadFsLayer;
  loadDiff: typeof loadGitDiffWithUntracked;
}

const nodeSnapshotDependencies: GitSnapshotDependencies = {
  readFs: nodeReadFsLayer,
  loadDiff: loadGitDiffWithUntracked,
};

/**
 * Stronger loader for hosts; the original loadGitDiffWithUntracked call form stays live for legacy
 * embedders. Mutable paths are inspected before diff execution, never first captured afterward.
 */
export async function loadGitReviewSnapshot(
  args: string[],
  cwd?: string,
  options: LoadGitDiffOptions & {
    snapshotRunner?: import('./command-runner').BufferedCommandRunner;
  } = {},
  dependencies: GitSnapshotDependencies = nodeSnapshotDependencies
): Promise<LoadGitDiffResult> {
  if (findUnsupportedGitDiffOptions(args).length > 0)
    return dependencies.loadDiff(args, cwd, options);
  const root = await getRepoRootAsync(cwd, options);
  const { readFs } = dependencies;
  const sides = describeGitDiffSides(args);
  const usesIndex = [sides.oldSide, sides.newSide].some(side => side.kind === 'index');
  const usesWorking = [sides.oldSide, sides.newSide].some(side => side.kind === 'working-tree');
  const indexCapture = usesIndex ? await captureIndex(root, readFs, options) : undefined;
  const selected =
    usesIndex || usesWorking
      ? await comparisonPaths(args, cwd ?? root, options)
      : new Set<string>();
  const before =
    usesIndex || usesWorking
      ? await readIndexManifest(root, options, [...selected])
      : new Map<string, string>();
  const physical = new Map<string, PhysicalCapture>();
  if (usesWorking) {
    for (const filePath of before.keys()) {
      await loadingCheckpoint(options.signal);
      const capture = await inspectPhysicalSource(root, filePath, readFs, options.signal);
      if (capture) physical.set(filePath, capture);
    }
  }
  const result = await dependencies.loadDiff(args, cwd, options);
  const after = usesIndex ? await readIndexManifest(root, options, [...selected]) : before;
  if (indexCapture && !(await verifyIndexCapture(indexCapture, options.signal)))
    throw new Error(RELOAD_REVIEW);
  const admitted = new Map<string, PhysicalCapture>();
  const index = new Map<string, string>();
  for (const file of result.files) {
    await loadingCheckpoint(options.signal);
    for (const filePath of new Set([file.oldPath, file.newPath].filter(Boolean))) {
      const relative = rootRelativeReviewedPath(result.identity, filePath);
      if ((usesIndex || usesWorking) && !file.isUntracked && !selected.has(relative))
        throw new Error(RELOAD_REVIEW);
      if (usesIndex && before.get(relative) !== after.get(relative)) throw new Error(RELOAD_REVIEW);
      const oid = before.get(relative);
      if (oid) index.set(filePath, oid);
      if (file.isUntracked) {
        const capture = sourceCapture(file);
        if (capture) admitted.set(filePath, capture);
      } else if (usesWorking) {
        const capture = physical.get(relative);
        const current = await inspectPhysicalSource(root, relative, readFs, options.signal);
        if (capture?.stamp !== current?.stamp) throw new Error(RELOAD_REVIEW);
        if (capture) admitted.set(filePath, capture);
      }
    }
  }
  recordLoadedSnapshot(
    result.identity,
    admitted,
    index,
    options,
    options.snapshotRunner,
    indexCapture
  );
  return result;
}
