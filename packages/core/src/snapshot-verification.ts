// Re-diff uses live git inputs, so verify both compared sides before and after execution.
import type { DiffFile, ReviewSourceIdentity } from './types';
import { rootRelativeReviewedPath } from './source-identity';
import { inspectPhysicalSource, readIndexManifest } from './loaded-git-review';
import {
  identityStamp,
  loadedSnapshot,
  loadedReviewState,
  type LoadedReview,
} from './loaded-snapshot';
import { checkLoadingCancelled } from './local-loading-lifetime';
import { verifyIndexCapture } from './index-capture';

/** Legacy injected identities retain their documented live-read behavior. */
export async function verifyLoadedComparison(
  identity: ReviewSourceIdentity,
  file: DiffFile,
  signal?: AbortSignal,
  loadedReview?: LoadedReview | null
): Promise<boolean> {
  const explicit = loadedReview ? loadedReviewState(loadedReview) : undefined;
  if (explicit && explicit.identity !== identity) return false;
  const snapshot = explicit?.snapshot ?? loadedSnapshot(identity);
  if (!snapshot) return true;
  if (snapshot.identityStamp !== identityStamp(identity)) return false;
  const sides = identity.fileSources?.get(file.newPath || file.oldPath) ?? identity;
  const paths = [
    { filePath: file.oldPath, side: sides.oldSide },
    { filePath: file.newPath, side: sides.newSide },
  ].filter(entry => entry.filePath !== '');
  try {
    const index = paths.some(entry => entry.side.kind === 'index')
      ? await readIndexManifest(
          identity.sourceRoot,
          { ...snapshot.gitOptions, signal },
          paths.map(entry => rootRelativeReviewedPath(identity, entry.filePath))
        )
      : null;
    if (snapshot.indexCapture && !(await verifyIndexCapture(snapshot.indexCapture, signal)))
      return false;
    for (const { filePath, side } of paths) {
      const relative = rootRelativeReviewedPath(identity, filePath);
      if (
        side.kind === 'index' &&
        (index?.get(relative) || undefined) !== snapshot.index.get(filePath)
      )
        return false;
      if (side.kind === 'working-tree' || side.kind === 'directory' || side.kind === 'file') {
        const capture = snapshot.physical.get(filePath);
        if (!capture) return false;
        const current = await inspectPhysicalSource(
          identity.sourceRoot,
          relative,
          capture.readFs,
          signal
        );
        if (current?.stamp !== capture.stamp) return false;
      }
    }
    return snapshot.identityStamp === identityStamp(identity);
  } catch {
    checkLoadingCancelled(signal);
    return false;
  }
}
