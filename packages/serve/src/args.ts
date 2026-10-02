// Mirrors the desktop's parser (src/main/cli.ts) over the same core
// extractor: anything the program does not claim is passed to `git diff`
// verbatim, `--` ends the program's own options, and a git option's value
// is never read as one of them. The output path is fixed for the life of
// the process — a browser has no equivalent of the native save dialog.
// Which flags each front end takes, and why they differ, is tabled in
// packages/core/src/startup.ts.

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

/**
 * Parse serve-mode arguments. Throws on a value-taking flag with no value or
 * an empty one (`ApplicationOptionError`): silently passing `--output` to
 * `git diff` would fail much further away from the mistake, with a message
 * about a revision, and `--output=` would resolve to the working directory,
 * pass the writability check and fail with EISDIR at submit.
 */
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
