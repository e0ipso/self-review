// src/main/ignore-filter.ts
// Gitignore-compatible file path filtering using the `ignore` package.

import ignore from 'ignore';

/**
 * Create a filter function from gitignore-compatible patterns.
 *
 * @param patterns - Array of gitignore-compatible glob patterns
 * @returns A predicate that returns `true` if the path should be kept (not ignored)
 */
export function createIgnoreFilter(
  patterns: string[]
): (path: string) => boolean {
  if (patterns.length === 0) return () => true;
  const ig = ignore().add(patterns);
  return (filePath: string) => !ig.ignores(filePath);
}
