// Mirrors src/main/cli.ts over core's extractor; the flag table is in packages/core/src/startup.ts.

import { extractApplicationOptions } from '@self-review/core';

export interface ServeArgs {
  /** Arguments passed through to `git diff`, in the order given. */
  gitDiffArgs: string[];
  /**
   * Output path exactly as typed, unresolved. `null` means the caller said
   * nothing and the configured `output-file` decides.
   */
  outputPath: string | null;
  /** Path of a prior review XML to resume from, as typed. `null` when unset. */
  resumeFrom: string | null;
  help: boolean;
  version: boolean;
}

const VALUE_FLAGS = {
  '--output': 'outputPath',
  '-o': 'outputPath',
  '--resume-from': 'resumeFrom',
} as const;

const BOOLEAN_FLAGS = {
  '--help': 'help',
  '-h': 'help',
  '--version': 'version',
  '-v': 'version',
} as const;

// Throws ApplicationOptionError on a value flag with no or an empty value: `--output=` would otherwise
// resolve to the working directory and fail with EISDIR only at submit.
export function parseServeArgs(argv: string[]): ServeArgs {
  const { values, flags, rest } = extractApplicationOptions(argv, {
    valueFlags: VALUE_FLAGS,
    booleanFlags: BOOLEAN_FLAGS,
  });
  return {
    gitDiffArgs: rest,
    outputPath: values.outputPath,
    resumeFrom: values.resumeFrom,
    help: flags.help,
    version: flags.version,
  };
}
