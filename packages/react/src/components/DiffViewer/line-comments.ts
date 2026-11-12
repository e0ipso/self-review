import type { ReviewComment } from '@self-review/types';

/** Empty rows reuse the index's stable arrays instead of allocating an empty array per line. */
export function mergeLineComments(
  first: ReviewComment[],
  second: ReviewComment[]
): ReviewComment[] {
  return first.length === 0 ? second : second.length === 0 ? first : [...first, ...second];
}
