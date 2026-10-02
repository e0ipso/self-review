// src/main/cli.ts
// CLI argument parsing for self-review

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
function getAppArgs(): string[] {
  let args: string[];
  if ((process as NodeJS.Process & { defaultApp?: boolean }).defaultApp) {
    // Dev mode: skip past the main script (first non-flag argument)
    const rawArgs = process.argv.slice(1);
    const mainScriptIdx = rawArgs.findIndex(a => !a.startsWith('-'));
    args = mainScriptIdx >= 0 ? rawArgs.slice(mainScriptIdx + 1) : [];
  } else {
    args = process.argv.slice(1);
  }

  // Filter out macOS Finder process serial number arguments (-psn_XXXX)
  const appArgs = args.filter(arg => !arg.startsWith('-psn_'));

  // Leading Chromium switches belong to Electron, not to this CLI. Removing
  // them before anything else reads args[0] is what keeps a subcommand
  // dispatchable behind, say, `--ozone-platform=headless`.
  return dropLeadingChromiumSwitches(appArgs);
}

// The desktop's own flags. Which flags each front end takes, and why they
// differ, is tabled in packages/core/src/startup.ts.
const VALUE_FLAGS = { '--resume-from': 'resumeFrom' } as const;
const EARLY_EXIT_FLAGS = {
  '--help': 'help',
  '-h': 'help',
  '--version': 'version',
  '-v': 'version',
} as const;

export function parseCliArgs(): CliArgs {
  const args = getAppArgs();

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
      console.error('Error: fetch-comments requires a pull/merge request URL argument');
      process.exit(1);
    }

    return {
      resumeFrom: null,
      gitDiffArgs: [],
      subcommand: 'fetch-comments',
      remoteUrl,
      allThreads,
    };
  }

  // The shared extractor takes --resume-from out (either spelling), stops at
  // `--`, and leaves a git option's value alone however it is spelled.
  let resumeFrom: string | null;
  let gitDiffArgs: string[];
  try {
    const extracted = extractApplicationOptions(args, { valueFlags: VALUE_FLAGS });
    resumeFrom = extracted.values.resumeFrom;
    gitDiffArgs = extracted.rest;
  } catch (error) {
    if (!(error instanceof ApplicationOptionError)) throw error;
    console.error(`Error: ${error.message}`);
    process.exit(1);
    // Unreachable outside a test that stubs process.exit.
    return {
      resumeFrom: null,
      gitDiffArgs: [],
      subcommand: null,
      remoteUrl: null,
      allThreads: false,
    };
  }

  // Remote GUI mode: only the FIRST positional argument may be a forge URL,
  // by the shared classifier, so an option's value (`-S <url>`) is never
  // one, and never after the `--` separator (everything after `--` is a
  // pathspec by git convention). Non-URL positionals keep pass-through.
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
      console.error(
        'Error: fetch-comments must be the first argument: ' +
          'self-review fetch-comments <url> [--all-threads]'
      );
      console.error('       To diff a path named fetch-comments, put it after --.');
      process.exit(1);
    }
  }

  return { resumeFrom, gitDiffArgs, subcommand: null, remoteUrl, allThreads: false };
}

function printHelp(): void {
  const help = `
self-review - Local git diff review UI

Usage: self-review [options] [<git-diff-args>...]
       self-review <pr-or-mr-url>
       self-review fetch-comments <pr-or-mr-url> [--all-threads]

Options:
  --resume-from <file>    Load a previous review XML file
  --help, -h              Show this help message
  --version, -v           Show version number

Subcommands:
  fetch-comments <url>    Headless: fetch PR/MR discussion threads and write
                          them as a review XML file (no window).
    --all-threads         Include threads the forge marks resolved
                          (GitLab; default is unresolved only).

Examples:
  self-review                                   # unstaged changes (git diff default)
  self-review --staged                          # staged changes
  self-review main..feature-branch
  self-review HEAD~3
  self-review -- src/auth.ts
  self-review --resume-from review.xml          # resume a previous review
  self-review https://github.com/o/r/pull/42    # review a remote PR
  self-review fetch-comments https://github.com/o/r/pull/42

All arguments except --resume-from and --help are passed to git diff; --
ends the app's own options, so everything after it reaches git as written.
Leading Electron/Chromium switches (--ozone-platform=headless and friends)
are consumed by the app and never reach git diff.
If no arguments are provided, shows unstaged working tree changes, or the
default-diff-args from configuration.

Output is written to ./review.xml by default (configurable via
output-file in .self-review.yaml or ~/.config/self-review/config.yaml).
`;
  console.error(help.trim());
}

function printVersion(): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const packageJson = require('../../package.json');
  console.error(`self-review v${packageJson.version}`);
}

export interface EarlyExitInfo {
  shouldExit: boolean;
  exitCode: number;
}

/**
 * Check if the app should exit early (--help, --version).
 * This is called BEFORE Electron initialization to allow CLI-only operation.
 */
export function checkEarlyExit(): EarlyExitInfo {
  const args = getAppArgs();

  // Read with the same rules as the parser: a `--help` after `--` is a
  // pathspec, and a `-h` that is an option's value is that option's.
  let flags: { help: boolean; version: boolean };
  try {
    flags = extractApplicationOptions(args, {
      valueFlags: VALUE_FLAGS,
      booleanFlags: EARLY_EXIT_FLAGS,
    }).flags;
  } catch {
    // A missing value is parseCliArgs's error to report.
    return { shouldExit: false, exitCode: 0 };
  }

  if (flags.help) {
    printHelp();
    return { shouldExit: true, exitCode: 0 };
  }

  if (flags.version) {
    printVersion();
    return { shouldExit: true, exitCode: 0 };
  }

  return { shouldExit: false, exitCode: 0 };
}
