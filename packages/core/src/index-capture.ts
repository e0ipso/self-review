// Index replacement evidence detects restage/restore cycles even when the final OIDs match.
import path from 'node:path';
import { executeGit, stripTrailingNewline, type GitExecutionOptions } from './git';
import { assertNoSymlinkAncestorsAsync } from './safe-fs-read';
import type { BoundedAsyncReadFsLayer } from './safe-fs-read';
import { errnoOf } from './safe-fs-policy';
import { checkLoadingCancelled } from './local-loading-lifetime';
import { sourceStamp, RELOAD_REVIEW, type IndexCapture } from './loaded-snapshot';

async function indexStamp(
  target: string,
  readFs: BoundedAsyncReadFsLayer,
  signal?: AbortSignal
): Promise<string | null> {
  try {
    if (!path.isAbsolute(target)) throw new Error(RELOAD_REVIEW);
    const root = path.parse(target).root;
    await assertNoSymlinkAncestorsAsync(root, path.relative(root, target), readFs, signal);
    const stats = await readFs.lstat(target);
    checkLoadingCancelled(signal);
    if (!stats.isFile() || (await readFs.realpath(target)) !== target)
      throw new Error(RELOAD_REVIEW);
    return sourceStamp(stats);
  } catch (error) {
    checkLoadingCancelled(signal);
    // Unborn repositories can legitimately have no index until their first staged file.
    if (errnoOf(error) === 'ENOENT') return null;
    throw error;
  }
}

export async function captureIndex(
  root: string,
  readFs: BoundedAsyncReadFsLayer,
  options: GitExecutionOptions
): Promise<IndexCapture> {
  const target = stripTrailingNewline(
    await executeGit(['rev-parse', '--path-format=absolute', '--git-path', 'index'], root, options)
  );
  return { target, readFs, stamp: await indexStamp(target, readFs, options.signal) };
}

export async function verifyIndexCapture(
  capture: IndexCapture,
  signal?: AbortSignal
): Promise<boolean> {
  return (await indexStamp(capture.target, capture.readFs, signal)) === capture.stamp;
}
