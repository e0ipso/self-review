// packages/core/src/git-diff-args.ts
// Normalization of pass-through git diff arguments.

import { existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Insert `--` before the first non-flag positional arg that exists as a
 * filesystem path.  This makes the args unambiguous so downstream code
 * (expand-context) never confuses a path for a revision.
 *
 * Idempotent: if `--` is already present the args are returned unchanged.
 */
export function normalizeGitDiffArgs(args: string[], cwd: string = process.cwd()): string[] {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--') return args; // already explicit — nothing to do
    if (arg.startsWith('-')) continue; // flag
    // Non-flag positional arg: check if it's a filesystem path
    if (existsSync(resolve(cwd, arg))) {
      return [...args.slice(0, i), '--', ...args.slice(i)];
    }
  }
  return args;
}
