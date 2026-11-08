// Shared by the desktop and serve command lines (audit R15). `--` ends application
// options; a git option's separate value stays git's (`-S --output` searches for
// "--output"); an empty value is refused because `--output=` resolves to a directory.

import { consumesNextArgument } from './git-diff-args';

export interface ApplicationOptionsSpec<V extends string, B extends string> {
  /** Spelling to field. Long flags take `--flag value` or `--flag=value`; short ones `-o value`. */
  valueFlags: Record<string, V>;
  booleanFlags?: Record<string, B>;
}

export interface ExtractedApplicationOptions<V extends string, B extends string> {
  values: Record<V, string | null>;
  flags: Record<B, boolean>;
  /** The `git diff` arguments in order, `--` and all that follows included. */
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
 * Takes the application's own flags out of `argv`; throws {@link ApplicationOptionError} for a
 * missing or empty value.
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
