// packages/core/src/git-diff-args.ts
// Normalization of pass-through git diff arguments.

import { existsSync } from 'fs';
import { resolve } from 'path';

// Only options whose bare spelling consumes the next argument belong here.
// Optional values (for example --color, --relative and -U) must be attached.
const OPTIONS_WITH_SEPARATE_VALUES = new Set([
  '--output', '--src-prefix', '--dst-prefix', '--line-prefix',
  '--output-indicator-new', '--output-indicator-old', '--output-indicator-context',
  '--inter-hunk-context', '--stat-width', '--stat-name-width', '--stat-graph-width',
  '--stat-count', '--diff-algorithm', '--word-diff-regex', '--ignore-matching-lines',
  '--anchored', '--diff-filter', '--find-object', '--rotate-to', '--skip-to',
  '--ws-error-highlight', '--color-moved-ws',
]);

function consumesNextArgument(arg: string): boolean {
  if (arg.startsWith('--')) return OPTIONS_WITH_SEPARATE_VALUES.has(arg);
  if (!arg.startsWith('-')) return false;
  // Git accepts short-option groups, such as -pS pattern. Once an option
  // takes a value, the rest of that token is its attached value, if present.
  for (let i = 1; i < arg.length; i++) {
    if ('SGOIl'.includes(arg[i])) return i === arg.length - 1;
    if ('UBMC'.includes(arg[i])) return false; // optional, attached values
  }
  return false;
}

/** Identify positional arguments without mistaking option values for paths. */
export function classifyGitDiffArgs(args: string[]): {
  positionalIndices: number[];
  hasSeparator: boolean;
} {
  const positionalIndices: number[] = [];
  let hasSeparator = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!hasSeparator) {
      if (arg === '--') {
        hasSeparator = true;
        continue;
      }
      if (consumesNextArgument(arg)) {
        i++;
        continue;
      }
      if (arg.startsWith('-')) continue;
    }
    positionalIndices.push(i);
  }
  return { positionalIndices, hasSeparator };
}

/**
 * Insert `--` before the first non-flag positional arg that exists as a
 * filesystem path.  This makes the args unambiguous so downstream code
 * (expand-context) never confuses a path for a revision.
 *
 * Idempotent: an explicit `--` separator leaves the args unchanged.
 */
export function normalizeGitDiffArgs(args: string[], cwd: string = process.cwd()): string[] {
  const { positionalIndices, hasSeparator } = classifyGitDiffArgs(args);
  if (hasSeparator) return args;
  for (const i of positionalIndices) {
    const arg = args[i];
    // Only positional args can be filesystem paths.
    if (existsSync(resolve(cwd, arg))) {
      return [...args.slice(0, i), '--', ...args.slice(i)];
    }
  }
  return args;
}
