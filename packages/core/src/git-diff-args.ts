// packages/core/src/git-diff-args.ts
// Normalization of pass-through git diff arguments.

import { existsSync } from 'fs';
import { resolve } from 'path';

// Only options whose bare spelling consumes the next argument belong here.
// Optional values (for example --color, --relative and -U) must be attached.
const OPTIONS_WITH_SEPARATE_VALUES = new Set([
  '--output',
  '--src-prefix',
  '--dst-prefix',
  '--line-prefix',
  '--output-indicator-new',
  '--output-indicator-old',
  '--output-indicator-context',
  '--inter-hunk-context',
  '--stat-width',
  '--stat-name-width',
  '--stat-graph-width',
  '--stat-count',
  '--diff-algorithm',
  '--word-diff-regex',
  '--ignore-matching-lines',
  '--anchored',
  '--diff-filter',
  '--find-object',
  '--rotate-to',
  '--skip-to',
  '--ws-error-highlight',
  '--color-moved-ws',
]);

// Required values may be attached or the next argument; optional ones are attached only (`-U 5` is
// `-U`, then `5`).
const SHORT_OPTIONS_WITH_REQUIRED_VALUES = 'SGOIl';
const SHORT_OPTIONS_WITH_OPTIONAL_VALUES = 'UBMC';

/** True when `arg`'s value is the next argument, which is then neither a flag nor a positional. */
export function consumesNextArgument(arg: string): boolean {
  if (arg.startsWith('--')) return OPTIONS_WITH_SEPARATE_VALUES.has(arg);
  if (!arg.startsWith('-')) return false;
  // Git accepts short-option groups, such as -pS pattern. Once an option
  // takes a value, the rest of that token is its attached value, if present.
  for (let i = 1; i < arg.length; i++) {
    if (SHORT_OPTIONS_WITH_REQUIRED_VALUES.includes(arg[i])) return i === arg.length - 1;
    if (SHORT_OPTIONS_WITH_OPTIONAL_VALUES.includes(arg[i])) return false;
  }
  return false;
}

/** What the paths in `git diff` output are relative to. */
export type DiffPathRelativity =
  | { kind: 'root' }
  | { kind: 'cwd' }
  // `directory` is read by git from the repository root.
  | { kind: 'directory'; directory: string };

export interface SingleFileRediff {
  args: string[];
  /** Resolved from the original arguments; its option is not in `args`. */
  relative: DiffPathRelativity;
}

// Long options that decide only how much context surrounds a change.
const CONTEXT_OPTIONS = new Set(['--unified', '--function-context', '--no-function-context']);
// `--rotate-to` and `--skip-to` make git fail when their file is not in the diff.
const FILE_ORDER_OPTIONS = new Set(['--rotate-to', '--skip-to']);

function isDroppedLongOption(arg: string): boolean {
  const name = arg.includes('=') ? arg.slice(0, arg.indexOf('=')) : arg;
  return CONTEXT_OPTIONS.has(name) || FILE_ORDER_OPTIONS.has(name);
}

/**
 * A short-option group minus `-U`, `-W` and `-O` (which end the group: the rest is their value), or
 * null if empty.
 */
function withoutDroppedShortOptions(arg: string): string | null {
  let kept = '';
  for (let i = 1; i < arg.length; i++) {
    const option = arg[i];
    if (option === 'U' || option === 'O') break;
    if (option === 'W') continue;
    if (
      SHORT_OPTIONS_WITH_REQUIRED_VALUES.includes(option) ||
      SHORT_OPTIONS_WITH_OPTIONAL_VALUES.includes(option)
    ) {
      kept += arg.slice(i);
      break;
    }
    kept += option;
  }
  return kept === '' ? null : `-${kept}`;
}

/**
 * The last of `--relative`, `--relative=<dir>` and `--no-relative` before `--` decides.
 * Only arguments count: every git diff forces `diff.relative=false`
 * (`PARSER_COMPATIBLE_GIT_CONFIG`).
 */
export function describeDiffPathRelativity(args: readonly string[]): DiffPathRelativity {
  let relative: DiffPathRelativity = { kind: 'root' };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--') break;
    if (arg === '--relative') relative = { kind: 'cwd' };
    else if (arg.startsWith('--relative='))
      relative = { kind: 'directory', directory: arg.slice('--relative='.length) };
    else if (arg === '--no-relative') relative = { kind: 'root' };
    else if (consumesNextArgument(arg)) i++;
  }
  return relative;
}

/**
 * Arguments for re-running a review's `git diff` over one file with other context.
 * Removed: context options (a bare `-U` never takes the next argument, so `-U HEAD`
 * keeps `HEAD`), file-order options, `--relative` forms (resolved into `relative`),
 * and `--` with its pathspecs. Everything else is kept in order.
 */
export function singleFileRediffArgs(args: readonly string[]): SingleFileRediff {
  const kept: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--') break;
    if (arg === '--relative' || arg.startsWith('--relative=') || arg === '--no-relative') {
      continue;
    }
    // The value goes wherever its option goes.
    const takesNext = consumesNextArgument(arg) && i + 1 < args.length;
    let option: string | null = arg;
    let keepValue = true;
    if (arg.startsWith('--')) {
      if (isDroppedLongOption(arg)) option = null;
      keepValue = option !== null;
    } else if (arg.startsWith('-') && arg.length > 1) {
      option = withoutDroppedShortOptions(arg);
      keepValue = !arg.endsWith('O');
    }
    if (option !== null) kept.push(option);
    if (takesNext) {
      i++;
      if (keepValue) kept.push(args[i]);
    }
  }
  return { args: kept, relative: describeDiffPathRelativity(args) };
}

// Options a committed config must not hand to git: `--output` truncates and fills a file
// (following symlinks, even for an empty diff); the others run external drivers.
// Git accepts no abbreviations, and negations (`--no-ext-diff`) are allowed.
const WRITE_CAPABLE_OPTIONS = new Set(['--output', '--ext-diff', '--textconv']);

/**
 * Options that make git write a file or run a program, as written. Used to refuse project
 * `default-diff-args`; the reviewer's own arguments are unrestricted.
 */
export function findWriteCapableGitDiffOptions(args: readonly string[]): string[] {
  const offending: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--') break;
    const name = arg.includes('=') ? arg.slice(0, arg.indexOf('=')) : arg;
    if (WRITE_CAPABLE_OPTIONS.has(name)) offending.push(arg);
    if (consumesNextArgument(arg)) i++;
  }
  return offending;
}

// Output formats `parseDiff` cannot consume: exact spellings plus attached-value prefixes
// (`--stat=120`).
const UNSUPPORTED_OUTPUT_OPTIONS = new Set([
  '--stat',
  '--numstat',
  '--shortstat',
  '--dirstat',
  '--dirstat-by-file',
  '--cumulative',
  '--summary',
  '--name-only',
  '--name-status',
  '--raw',
  '--patch-with-stat',
  '--patch-with-raw',
  '--compact-summary',
  '--word-diff',
  '--word-diff-regex',
  '--color-words',
  '--color-moved',
  '--color-moved-ws',
  '--no-patch',
  '-s',
  '--exit-code',
  '--quiet',
  '--output',
  '--line-prefix',
  '--output-indicator-new',
  '--output-indicator-old',
  '--output-indicator-context',
  '--check',
]);

const UNSUPPORTED_OUTPUT_OPTION_PREFIXES = [
  '--stat=',
  '--stat-width=',
  '--stat-name-width=',
  '--stat-graph-width=',
  '--stat-count=',
  '--dirstat=',
  '--dirstat-by-file=',
  '--word-diff=',
  '--word-diff-regex=',
  '--color-words=',
  '--color-moved=',
  '--color-moved-ws=',
  '--output=',
  '--line-prefix=',
  '--output-indicator-new=',
  '--output-indicator-old=',
  '--output-indicator-context=',
];

function isUnsupportedOutputOption(arg: string): boolean {
  return (
    UNSUPPORTED_OUTPUT_OPTIONS.has(arg) ||
    UNSUPPORTED_OUTPUT_OPTION_PREFIXES.some(prefix => arg.startsWith(prefix))
  );
}

/** Options selecting an output format the parser cannot consume, as the user wrote them. */
export function findUnsupportedGitDiffOptions(args: readonly string[]): string[] {
  const offending: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--') break;
    if (isUnsupportedOutputOption(arg)) {
      offending.push(arg);
    }
    if (consumesNextArgument(arg)) i++;
  }
  return offending;
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
  return args.map(arg => (needsQuoting(arg) ? `'${arg.replace(/'/g, "'\\''")}'` : arg)).join(' ');
}
