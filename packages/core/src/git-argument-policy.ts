// Pure interpretation of argv. Unknown options pass through unchanged.

import { gitDiffOptionPolicy } from './git-option-policy';

/** True when `arg`'s value is the next argument, which is then neither a flag nor a positional. */
export function consumesNextArgument(arg: string): boolean {
  if (arg.startsWith('--')) return gitDiffOptionPolicy(arg).value === 'required';
  if (!arg.startsWith('-')) return false;
  // Git accepts short-option groups, such as -pS pattern. Once an option
  // takes a value, the rest of that token is its attached value, if present.
  for (let i = 1; i < arg.length; i++) {
    if (gitDiffOptionPolicy(`-${arg[i]}`).value === 'required') return i === arg.length - 1;
    if (gitDiffOptionPolicy(`-${arg[i]}`).value === 'attached') return false;
  }
  return false;
}

/** An effective option, including short options inside a group; values never become options. */
export interface GitDiffOption {
  index: number;
  arg: string;
  name: string;
  value?: string;
}

export interface ParsedGitDiffArgs {
  options: GitDiffOption[];
  positionalIndices: number[];
  /** The actual separator, excluding an option value spelled `--`. */
  separatorIndex: number | null;
}

/** One interpretation of option arity, groups and the pathspec boundary for all consumers. */
export function parseGitDiffArgs(args: readonly string[]): ParsedGitDiffArgs {
  const options: GitDiffOption[] = [];
  const positionalIndices: number[] = [];
  let separatorIndex: number | null = null;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (separatorIndex !== null) {
      positionalIndices.push(i);
    } else if (arg === '--') {
      separatorIndex = i;
    } else if (arg.startsWith('--')) {
      const equals = arg.indexOf('=');
      const option: GitDiffOption = {
        index: i,
        arg,
        name: equals < 0 ? arg : arg.slice(0, equals),
      };
      if (equals >= 0) option.value = arg.slice(equals + 1);
      else if (consumesNextArgument(arg) && i + 1 < args.length) {
        option.value = args[++i];
      }
      options.push(option);
    } else if (arg.startsWith('-')) {
      for (let j = 1; j < arg.length; j++) {
        const name = arg[j];
        const option: GitDiffOption = { index: i, arg, name: `-${name}` };
        options.push(option);
        if (
          gitDiffOptionPolicy(`-${name}`).value === 'required' ||
          gitDiffOptionPolicy(`-${name}`).value === 'attached'
        ) {
          if (j + 1 < arg.length) option.value = arg.slice(j + 1);
          else if (gitDiffOptionPolicy(`-${name}`).value === 'required' && i + 1 < args.length) {
            option.value = args[++i];
          }
          break;
        }
      }
    } else {
      positionalIndices.push(i);
    }
  }
  return { options, positionalIndices, separatorIndex };
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

/**
 * Remove context and file-order options from a short group, stopping at any attached value.
 */
function withoutDroppedShortOptions(arg: string): string | null {
  let kept = '';
  for (let i = 1; i < arg.length; i++) {
    const option = arg[i];
    const rule = gitDiffOptionPolicy(`-${option}`);
    if (rule.rediff === 'drop') {
      if (rule.value) break;
      continue;
    }
    if (rule.value === 'required' || rule.value === 'attached') {
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
  for (const option of parseGitDiffArgs(args).options) {
    if (option.name === '--relative') {
      relative =
        option.value === undefined
          ? { kind: 'cwd' }
          : { kind: 'directory', directory: option.value };
    } else if (option.name === '--no-relative') relative = { kind: 'root' };
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
    const name = arg.split('=', 1)[0];
    const rule = gitDiffOptionPolicy(name);
    if (rule.rediff === 'relative' && (arg === name || rule.value === 'attached')) {
      continue;
    }
    // The value goes wherever its option goes.
    const takesNext = consumesNextArgument(arg) && i + 1 < args.length;
    let option: string | null = arg;
    let keepValue = true;
    if (arg.startsWith('--')) {
      if (gitDiffOptionPolicy(name).rediff === 'drop') option = null;
      keepValue = option !== null;
    } else if (arg.startsWith('-') && arg.length > 1) {
      option = withoutDroppedShortOptions(arg);
      keepValue = option !== null && consumesNextArgument(option);
    }
    if (option !== null) kept.push(option);
    if (takesNext) {
      i++;
      if (keepValue) kept.push(args[i]);
    }
  }
  return { args: kept, relative: describeDiffPathRelativity(args) };
}

/**
 * Options that make git write a file or run a program, as written. Used to refuse project
 * `default-diff-args`; the reviewer's own arguments are unrestricted.
 */
export function findWriteCapableGitDiffOptions(args: readonly string[]): string[] {
  return parseGitDiffArgs(args)
    .options.filter(option => gitDiffOptionPolicy(option.name).writeCapable)
    .map(option => option.arg);
}

/** Options selecting an output format the parser cannot consume, as the user wrote them. */
export function findUnsupportedGitDiffOptions(args: readonly string[]): string[] {
  const offending = parseGitDiffArgs(args).options.filter(option => {
    const output = gitDiffOptionPolicy(option.name).unsupportedOutput;
    return output === 'always' || (output === 'attached' && option.arg.includes('='));
  });
  return [...new Set(offending.map(option => option.index))].map(index => args[index]);
}

/** Identify positional arguments without mistaking option values for paths. */
export function classifyGitDiffArgs(args: string[]): {
  positionalIndices: number[];
  hasSeparator: boolean;
} {
  const parsed = parseGitDiffArgs(args);
  return {
    positionalIndices: parsed.positionalIndices,
    hasSeparator: parsed.separatorIndex !== null,
  };
}
