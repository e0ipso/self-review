// packages/core/src/cli-options.ts
// The one way both command lines take their own flags out of a `git diff`
// argument list.
//
// Desktop (src/main/cli.ts) and serve (packages/serve/src/args.ts) each
// accept a few application flags and pass everything else to git. Reading
// those flags out of a git argument list has rules both have to agree on:
// `--` ends the application's options, so what follows is git's whatever it
// looks like; a git option that takes the next argument keeps it, so `-S
// --output` is a search for the text `--output`; and a value-taking flag is
// accepted as `--flag value` or `--flag=value`, never with an empty value,
// since `--output=` resolves to a directory that passes a writability check
// and fails at the save. Each parser used to carry its own version of these
// rules and they had drifted (audit R15).

import { consumesNextArgument } from './git-diff-args';

export interface ApplicationOptionsSpec<V extends string, B extends string> {
  /**
   * Flags that take a value, by spelling, mapped to the field they fill.
   * A long flag is accepted as `--flag value` and `--flag=value`; a short
   * one (`-o`) as `-o value`.
   */
  valueFlags: Record<string, V>;
  /** Flags that take no value, by spelling, mapped to the field they set. */
  booleanFlags?: Record<string, B>;
}

export interface ExtractedApplicationOptions<V extends string, B extends string> {
  /** The last value given for each value flag, or null when it was not given. */
  values: Record<V, string | null>;
  /** True for each boolean flag that appeared. */
  flags: Record<B, boolean>;
  /** Everything else, in order: the `git diff` arguments, `--` and all that follows included. */
  rest: string[];
}

/** A value flag given without a value, or with an empty one. */
export class ApplicationOptionError extends Error {
  readonly flag: string;

  constructor(flag: string) {
    super(`${flag} requires a file path argument`);
    this.name = 'ApplicationOptionError';
    this.flag = flag;
  }
}

/**
 * Take the application's own flags out of `argv`, leaving the `git diff`
 * arguments in order. Throws {@link ApplicationOptionError} for a value
 * flag with no value or an empty one.
 */
export function extractApplicationOptions<V extends string, B extends string = never>(
  argv: readonly string[],
  spec: ApplicationOptionsSpec<V, B>
): ExtractedApplicationOptions<V, B> {
  const values = Object.fromEntries(
    Object.values(spec.valueFlags).map(field => [field, null])
  ) as Record<V, string | null>;
  const flags = Object.fromEntries(
    Object.values(spec.booleanFlags ?? {}).map(field => [field, false])
  ) as Record<B, boolean>;
  const rest: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') {
      rest.push(...argv.slice(i));
      break;
    }

    const booleanField = spec.booleanFlags?.[arg];
    if (booleanField !== undefined) {
      flags[booleanField] = true;
      continue;
    }

    const valueField = spec.valueFlags[arg];
    if (valueField !== undefined) {
      if (i + 1 >= argv.length) throw new ApplicationOptionError(arg);
      values[valueField] = requireValue(arg, argv[i + 1]);
      i++;
      continue;
    }

    const equals = arg.indexOf('=');
    if (arg.startsWith('--') && equals > 0) {
      const equalsField = spec.valueFlags[arg.slice(0, equals)];
      if (equalsField !== undefined) {
        values[equalsField] = requireValue(arg.slice(0, equals), arg.slice(equals + 1));
        continue;
      }
    }

    rest.push(arg);
    // A git option's separate value is that option's, whatever it is spelled like.
    if (consumesNextArgument(arg) && i + 1 < argv.length) {
      rest.push(argv[++i]);
    }
  }

  return { values, flags, rest };
}

function requireValue(flag: string, value: string): string {
  if (value === '') throw new ApplicationOptionError(flag);
  return value;
}
