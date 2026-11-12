import { parseForgeUrl } from '../../packages/core/src/forge-provider';
import { classifyGitDiffArgs } from '../../packages/core/src/git-diff-args';
import {
  ApplicationOptionError,
  extractApplicationOptions,
} from '../../packages/core/src/cli-options';

export interface CliArgs {
  resumeFrom: string | null;
  gitDiffArgs: string[];
  /**
   * Explicit subcommand routing, decided at the top of parsing. `null` means
   * the classic GUI modes (local git / directory / file / welcome, or remote
   * GUI mode when `remoteUrl` is set). Unknown subcommand-like tokens keep
   * the pass-through-to-git behavior.
   */
  subcommand: 'fetch-comments' | null;
  /**
   * Forge PR/MR URL. Set when the first positional argument is either the
   * URL operand of `fetch-comments` or a bare URL that parses via
   * `parseForgeUrl` (remote GUI mode). Never forwarded to git diff.
   */
  remoteUrl: string | null;
  /**
   * `--all-threads` (fetch-comments only): include threads the forge marks
   * resolved. Defaults to false — GitLab fetches unresolved threads only.
   */
  allThreads: boolean;
}

/**
 * Electron and Chromium switches self-review tolerates in front of its own
 * arguments. A headless launcher (CI, a container, a desktop entry) puts them
 * there, Chromium reads them straight from process.argv, and git diff has no
 * use for any of them. Only the `--name` and `--name=value` spellings are
 * recognized: a switch is never allowed to swallow the argument after it, so
 * `--no-sandbox main..feature` keeps its revision.
 */
const CHROMIUM_SWITCH_NAMES = new Set([
  'disable-dev-shm-usage',
  'disable-features',
  'disable-gpu',
  'disable-gpu-compositing',
  'disable-gpu-sandbox',
  'disable-setuid-sandbox',
  'disable-software-rasterizer',
  'enable-features',
  'enable-logging',
  'force-device-scale-factor',
  'headless',
  'in-process-gpu',
  'no-sandbox',
  'no-zygote',
  'ozone-platform',
  'ozone-platform-hint',
  'remote-debugging-port',
  'single-process',
  'use-angle',
  'use-gl',
  'user-data-dir',
]);

function isChromiumSwitch(arg: string): boolean {
  if (!arg.startsWith('--')) return false;
  const name = arg.slice(2).split('=', 1)[0];
  return CHROMIUM_SWITCH_NAMES.has(name);
}

/**
 * Drop the run of recognized Chromium switches in front of the application's
 * own arguments, so what remains starts at the argument the user meant first.
 * Scanning stops at the first token that is not one of them, which keeps every
 * later argument, including anything after `--`, exactly where it was.
 */
function dropLeadingChromiumSwitches(args: string[]): string[] {
  let start = 0;
  while (start < args.length && isChromiumSwitch(args[start])) start++;
  return args.slice(start);
}

/**
 * Extract application arguments from process.argv.
 * In Electron dev mode (process.defaultApp = true), process.argv contains:
 *   [electron, ...chromiumFlags, mainScript, ...appArgs]
 * In packaged mode:
 *   [appBinary, ...appArgs]
 *
 * macOS Finder passes `-psn_XXXX` process serial number arguments when
 * launching an app by double-clicking. These are filtered out so they
 * don't interfere with CLI parsing.
 */
export function extractDesktopArgs(argv: readonly string[], defaultApp: boolean): string[] {
  let args: string[];
  if (defaultApp) {
    // Dev mode: skip past the main script (first non-flag argument)
    const rawArgs = argv.slice(1);
    const mainScriptIdx = rawArgs.findIndex(a => !a.startsWith('-'));
    args = mainScriptIdx >= 0 ? rawArgs.slice(mainScriptIdx + 1) : [];
  } else {
    args = argv.slice(1);
  }

  // Filter out macOS Finder process serial number arguments (-psn_XXXX)
  const appArgs = args.filter(arg => !arg.startsWith('-psn_'));

  // Leading Chromium switches belong to Electron, not to this CLI. Removing
  // them before anything else reads args[0] is what keeps a subcommand
  // dispatchable behind, say, `--ozone-platform=headless`.
  return dropLeadingChromiumSwitches(appArgs);
}

// The flag table for both front ends is in packages/core/src/startup.ts.
const VALUE_FLAGS = { '--resume-from': 'resumeFrom' } as const;
const EARLY_EXIT_FLAGS = {
  '--help': 'help',
  '-h': 'help',
  '--version': 'version',
  '-v': 'version',
} as const;

export interface CliParseResult {
  args: CliArgs;
  diagnostics: string[];
  exitCode: number | null;
}

export function parseAppArgs(args: string[]): CliParseResult {
  const diagnostics: string[] = [];
  let exitCode: number | null = null;
  const result = (value: CliArgs): CliParseResult => ({ args: value, diagnostics, exitCode });

  // Subcommand mode: `self-review fetch-comments <URL> [--all-threads]`.
  // Recognized only as the very first argument, before any window creation.
  if (args[0] === 'fetch-comments') {
    let remoteUrl: string | null = null;
    let allThreads = false;

    for (const arg of args.slice(1)) {
      if (arg === '--all-threads') {
        allThreads = true;
        continue;
      }
      if (remoteUrl === null && !arg.startsWith('-')) {
        remoteUrl = arg;
      }
    }

    if (remoteUrl === null) {
      diagnostics.push('Error: fetch-comments requires a pull/merge request URL argument');
      exitCode = 1;
    }

    return result({
      resumeFrom: null,
      gitDiffArgs: [],
      subcommand: 'fetch-comments',
      remoteUrl,
      allThreads,
    });
  }

  let resumeFrom: string | null;
  let gitDiffArgs: string[];
  try {
    const extracted = extractApplicationOptions(args, { valueFlags: VALUE_FLAGS });
    resumeFrom = extracted.values.resumeFrom;
    gitDiffArgs = extracted.rest;
  } catch (error) {
    if (!(error instanceof ApplicationOptionError)) throw error;
    diagnostics.push(`Error: ${error.message}`);
    exitCode = 1;
    return result({
      resumeFrom: null,
      gitDiffArgs: [],
      subcommand: null,
      remoteUrl: null,
      allThreads: false,
    });
  }

  // Remote GUI mode: only the FIRST positional argument may be a forge URL, never an option's value
  // (`-S <url>`) and never after `--`. Non-URL positionals keep pass-through.
  let remoteUrl: string | null = null;
  const { positionalIndices } = classifyGitDiffArgs(gitDiffArgs);
  const separator = gitDiffArgs.indexOf('--');
  const first = positionalIndices.find(i => separator === -1 || i < separator);
  if (first !== undefined) {
    const arg = gitDiffArgs[first];
    if (parseForgeUrl(arg) !== null) {
      remoteUrl = arg;
      gitDiffArgs = [...gitDiffArgs.slice(0, first), ...gitDiffArgs.slice(first + 1)];
    } else if (arg === 'fetch-comments') {
      // The subcommand reached here in a position dispatch cannot honor.
      // Forwarding it and its URL to git diff would run the wrong command
      // on arguments that are not git's, so say so instead.
      diagnostics.push(
        'Error: fetch-comments must be the first argument: ' +
          'self-review fetch-comments <url> [--all-threads]'
      );
      diagnostics.push('       To diff a path named fetch-comments, put it after --.');
      exitCode = 1;
    }
  }

  return result({ resumeFrom, gitDiffArgs, subcommand: null, remoteUrl, allThreads: false });
}

export function parseEarlyExit(args: string[]): 'help' | 'version' | null {
  try {
    const { flags } = extractApplicationOptions(args, {
      valueFlags: VALUE_FLAGS,
      booleanFlags: EARLY_EXIT_FLAGS,
    });
    return flags.help ? 'help' : flags.version ? 'version' : null;
  } catch {
    return null;
  }
}
