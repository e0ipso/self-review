// Command-line arguments for serve mode.
//
// The shape mirrors the desktop application's own parser (src/main/cli.ts):
// everything the program does not claim for itself is passed through to
// `git diff` verbatim.
//
// The output path is here, and only here. It is fixed for the lifetime of the
// process: there is no route and no adapter method that changes it, because a
// browser has no equivalent of the desktop's native save dialog.

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

const VALUE_FLAGS: Record<string, 'outputPath' | 'resumeFrom'> = {
  '--output': 'outputPath',
  '-o': 'outputPath',
  '--resume-from': 'resumeFrom',
};

/**
 * Parse serve-mode arguments. Throws on a value-taking flag with no value:
 * silently passing `--output` to `git diff` would fail much further away
 * from the mistake, with a message about a revision.
 */
/**
 * A value-taking flag given an empty value is a mistake, not a request for the
 * default. `--output=` used to reach `resolve(cwd, '')`, which is the working
 * directory: a directory passes the writability check, so the review looked
 * saveable and the write failed with EISDIR at submit — after the state had
 * left the session, which loses the review outright.
 */
function requireValue(flag: string, value: string): string {
  if (value === '') {
    throw new Error(`${flag} requires a file path argument`);
  }
  return value;
}

export function parseServeArgs(argv: string[]): ServeArgs {
  const args: ServeArgs = {
    gitDiffArgs: [],
    outputPath: null,
    resumeFrom: null,
    help: false,
    version: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }
    if (arg === '--version' || arg === '-v') {
      args.version = true;
      continue;
    }

    // `--flag=value` — accepted alongside the separated form so a value
    // written with `=` can never be mistaken for a git revision.
    const equals = arg.indexOf('=');
    if (equals > 0) {
      const field = VALUE_FLAGS[arg.slice(0, equals)];
      if (field) {
        args[field] = requireValue(arg.slice(0, equals), arg.slice(equals + 1));
        continue;
      }
    }

    const field = VALUE_FLAGS[arg];
    if (field) {
      if (i + 1 >= argv.length) {
        throw new Error(`${arg} requires a file path argument`);
      }
      args[field] = requireValue(arg, argv[i + 1]);
      i++;
      continue;
    }

    args.gitDiffArgs.push(arg);
  }

  return args;
}
