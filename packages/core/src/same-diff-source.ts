import type { DiffSource } from './types';

/** Compare only canonical source fields, without normalizing their exact string values.
 * This is DTO equality, not permission to publish a welcome/loading source or provenance.
 */
export function sameDiffSource(loaded: DiffSource, submitted: DiffSource): boolean {
  if (loaded.type !== submitted.type) return false;
  switch (loaded.type) {
    case 'git':
      return (
        submitted.type === 'git' &&
        loaded.repository === submitted.repository &&
        loaded.gitDiffArgs === submitted.gitDiffArgs
      );
    case 'directory':
    case 'file':
      return (
        (submitted.type === 'directory' || submitted.type === 'file') &&
        loaded.sourcePath === submitted.sourcePath
      );
    case 'welcome':
    case 'loading':
      return true;
  }
}
