// packages/core/src/staged-untracked.ts
// Initial-config adjustment for staged-mode reviews.

import type { AppConfig } from './types';

/**
 * In staged-mode reviews (--staged / --cached), untracked files are not
 * part of the index and should be hidden by default. If the user has
 * explicitly opted in via `show-untracked: true` in their YAML config,
 * respect that choice.
 *
 * Untracked files are still preloaded by the backend so that the toolbar
 * toggle can reveal them instantly without re-running git.
 */
export function applyStagedUntrackedDefault(
  config: AppConfig,
  gitDiffArgs: string[]
): AppConfig {
  const stagedMode =
    gitDiffArgs.includes('--staged') || gitDiffArgs.includes('--cached');
  if (!stagedMode) return config;

  const userExplicitOptIn =
    config.showUntrackedExplicit && config.showUntracked;
  if (userExplicitOptIn) return config;

  return { ...config, showUntracked: false };
}
