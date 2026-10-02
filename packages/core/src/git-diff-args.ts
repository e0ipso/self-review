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

// Short options that take a value: required (attached, or else the next
// argument) and optional (attached only; `-U 5` is `-U` and then `5`).
const SHORT_OPTIONS_WITH_REQUIRED_VALUES = 'SGOIl';
const SHORT_OPTIONS_WITH_OPTIONAL_VALUES = 'UBMC';

/**
 * True when `arg` is an option whose value is the *next* argument, so that
 * argument is neither a flag nor a positional.
 */
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
  /** The repository root: no `--relative` in effect. */
  | { kind: 'root' }
  /** Bare `--relative`: the directory git runs in. */
  | { kind: 'cwd' }
  /** `--relative=<dir>`: `directory`, which git reads from the repository root. */
  | { kind: 'directory'; directory: string };

export interface SingleFileRediff {
  /** The options and revisions to re-run, in order; no `--` and no pathspec. */
  args: string[];
  /** What the original output paths were relative to; its option is not in `args`. */
  relative: DiffPathRelativity;
}

// Long options that decide only how much context surrounds a change.
const CONTEXT_OPTIONS = new Set(['--unified', '--function-context', '--no-function-context']);
// Long options that only order the files of a multi-file diff. `--rotate-to`
// and `--skip-to` make git fail when their file is not in the diff.
const FILE_ORDER_OPTIONS = new Set(['--rotate-to', '--skip-to']);

function isDroppedLongOption(arg: string): boolean {
  const name = arg.includes('=') ? arg.slice(0, arg.indexOf('=')) : arg;
  return CONTEXT_OPTIONS.has(name) || FILE_ORDER_OPTIONS.has(name);
}

/**
 * A short-option group without its context (`-U`, `-W`) and file-order
 * (`-O`) options, or null when nothing of it remains. `-U` and `-O` end
 * the group: what follows them in the token is their value.
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
 * What the paths in the output of `git diff argv` are relative to, read
 * with the same arity rules as {@link consumesNextArgument}: the last of
 * `--relative`, `--relative=<dir>` and `--no-relative` before `--` decides,
 * and an option value spelled like one of them is never read as one.
 *
 * Only the arguments count. Every `git diff` this program runs forces
 * `diff.relative=false` (see `PARSER_COMPATIBLE_GIT_CONFIG`), so a user's
 * own `diff.relative` setting never reaches the output.
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
 * The arguments for re-running a review's `git diff` over a single file
 * with a different amount of context, read with the same arity rules as
 * {@link consumesNextArgument}:
 *
 * - context options are removed — `-U`, `-U<n>`, `--unified`,
 *   `--unified=<n>`, `-W`, `--function-context` — and a bare `-U` or
 *   `--unified` never takes the argument after it, so `-U HEAD` keeps
 *   `HEAD` as the revision it is;
 * - file-order options (`-O`, `--rotate-to`, `--skip-to`) are removed: one
 *   file has no order, and the last two fail when their file is absent;
 * - `--relative[=<dir>]` and `--no-relative` are removed and resolved into
 *   `relative`, so the caller can restate them against the directory it
 *   runs git in;
 * - `--` and every pathspec after it are dropped; the caller supplies the
 *   file's own paths.
 *
 * Everything else, revisions and option values included, is kept in order.
 */
export function singleFileRediffArgs(args: readonly string[]): SingleFileRediff {
  const kept: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--') break;
    if (arg === '--relative' || arg.startsWith('--relative=') || arg === '--no-relative') {
      continue;
    }
    // When an option takes the next argument, it is the last one in its
    // token; the value goes wherever that option goes.
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

// Options a committed configuration must not be able to hand to git: the
// one that writes (`--output` names a file git truncates and fills, even for
// an empty diff, following a symlink there) and the two that run external
// programs (`--ext-diff`, `--textconv` enable drivers git configuration may
// define). Git accepts no abbreviations of its diff options, so exact
// spellings are the whole set. Negations (`--no-ext-diff`) disable and are
// allowed. `-o` is not a `git diff` option.
const WRITE_CAPABLE_OPTIONS = new Set(['--output', '--ext-diff', '--textconv']);

/**
 * The options in `args` that make git write a file or run an external
 * program, in argument order, each spelled as written. Option values and
 * pathspecs after `--` are never reported. Used to refuse `default-diff-args`
 * a repository committed; a reviewer's own arguments are not restricted.
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

// Output formats `parseDiff` cannot consume. Exact spellings, plus the
// prefixes of the forms that carry an attached value (`--stat=120`).
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

/**
 * The user-supplied options that select an output format the parser cannot
 * consume (`--stat`, `--name-only`, `--word-diff`, ...), in argument order,
 * each spelled as the user wrote it. Option values and pathspecs after `--`
 * are never reported. An empty result means the arguments produce patch
 * output.
 */
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
