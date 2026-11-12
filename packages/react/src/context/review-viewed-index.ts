import type { FileReviewState } from '@self-review/types';

export interface ViewedReviewIndex {
  /** First occurrence wins, including an unviewed occurrence before a viewed duplicate. */
  readonly first: ReadonlySet<string>;
  /** Every viewed entry contributes its path, including later duplicates. */
  readonly any: ReadonlySet<string>;
}

export function indexViewedFiles(files: readonly FileReviewState[]): ViewedReviewIndex {
  const seen = new Set<string>();
  const first = new Set<string>();
  const any = new Set<string>();
  for (const file of files) {
    if (file.viewed) {
      any.add(file.path);
      if (!seen.has(file.path)) first.add(file.path);
    }
    seen.add(file.path);
  }
  return { first, any };
}

function samePaths(previous: ReadonlySet<string>, next: ReadonlySet<string>) {
  return previous.size === next.size && [...next].every(path => previous.has(path));
}

type ReviewFilesOwner = { getSnapshot: () => { files: FileReviewState[] } };
const indexes = new WeakMap<
  ReviewFilesOwner,
  {
    files: FileReviewState[];
    viewed: ViewedReviewIndex;
  }
>();

/** Read-only cache for each owner, including structural legacy stores without extra getters.
 * Only viewed membership changes replace these snapshots. Comment counts and bodies do not.
 */
export function getViewedReviewIndex(owner: ReviewFilesOwner): ViewedReviewIndex {
  const files = owner.getSnapshot().files;
  const previous = indexes.get(owner);
  if (previous?.files === files) return previous.viewed;
  const next = indexViewedFiles(files);
  const first =
    previous && samePaths(previous.viewed.first, next.first) ? previous.viewed.first : next.first;
  const any = previous && samePaths(previous.viewed.any, next.any) ? previous.viewed.any : next.any;
  const viewed =
    previous?.viewed.first === first && previous.viewed.any === any
      ? previous.viewed
      : { first, any };
  indexes.set(owner, { files, viewed });
  return viewed;
}
