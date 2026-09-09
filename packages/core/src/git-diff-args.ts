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

/**
 * Split a configured argument string into argv the way a shell would, so a
 * quoted path or search string survives as one argument.
 *
 * Two callers rely on this: `default-diff-args` from YAML, which people write
 * with shell quoting, and the `git-diff-args` string carried on a git diff
 * source, which `formatGitDiffArgs` writes in the same syntax. Unquoted input
 * splits on whitespace exactly as a plain split did, so older config and older
 * review documents keep parsing identically.
 *
 * Malformed input never throws. An unterminated quote closes at end of input:
 * a broken config line degrades to a best-effort argument list instead of
 * taking startup down with it.
 */
export function tokenizeGitDiffArgs(value: string): string[] {
  const args: string[] = [];
  let current = '';
  let started = false;
  let quote: "'" | '"' | null = null;

  for (let i = 0; i < value.length; i++) {
    const char = value[i];

    if (quote === "'") {
      if (char === "'") quote = null;
      else current += char;
      continue;
    }

    if (quote === '"') {
      // Inside double quotes only the quote and the backslash are escapable;
      // every other backslash is a literal character, as in POSIX shells.
      if (char === '\\' && (value[i + 1] === '"' || value[i + 1] === '\\')) {
        current += value[++i];
      } else if (char === '"') {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      started = true;
      continue;
    }
    if (char === '\\' && i + 1 < value.length) {
      current += value[++i];
      started = true;
      continue;
    }
    if (/\s/.test(char)) {
      if (started) {
        args.push(current);
        current = '';
        started = false;
      }
      continue;
    }
    current += char;
    started = true;
  }

  if (started) args.push(current);
  return args;
}

/** True when rendering this argument bare would lose its boundary. */
function needsQuoting(arg: string): boolean {
  return arg.length === 0 || /[\s'"\\]/.test(arg);
}

/**
 * Render argv as the single string a git diff source carries, such that
 * `tokenizeGitDiffArgs` recovers the exact argument list.
 *
 * Arguments that survive a bare round trip are written bare, so ordinary
 * invocations produce byte-identical output to a plain join and the
 * `git-diff-args` XML attribute does not change shape for them.
 */
export function formatGitDiffArgs(args: string[]): string {
  return args
    .map(arg =>
      needsQuoting(arg) ? `'${arg.replace(/'/g, "'\\''")}'` : arg
    )
    .join(' ');
}
