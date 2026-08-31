// src/main/cli.ts
// CLI argument parsing for self-review

import { existsSync } from 'fs';
import { resolve } from 'path';
import { parseForgeUrl } from '../../packages/core/src/forge-provider';

/** Loopback address a serve-mode listener binds to. */
export interface ServeAddress {
  host: string;
  port: number;
}

/** Serve mode binds loopback only — see {@link parseServeTarget}. */
export const DEFAULT_SERVE_HOST = '127.0.0.1';
/** Fixed default port, so the forwarded port is predictable. */
export const DEFAULT_SERVE_PORT = 7738;

export interface CliArgs {
  resumeFrom: string | null;
  gitDiffArgs: string[];
  /**
   * Explicit subcommand routing, decided at the top of parsing. `null` means
   * the classic GUI modes (local git / directory / file / welcome, or remote
   * GUI mode when `remoteUrl` is set). Unknown subcommand-like tokens keep
   * the pass-through-to-git behavior.
   */
  subcommand: 'fetch-comments' | 'serve' | null;
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
  /** Where `serve` binds. Null unless the `serve` subcommand was used. */
  serve: ServeAddress | null;
  /**
   * `--output=<path>` / `--output <path>`. Overrides the `output-file`
   * configuration key.
   */
  outputPath: string | null;
}

/** Hosts serve mode will bind. Anything else is refused — see below. */
function isLoopbackHost(host: string): boolean {
  const normalized = host.toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized === '::1' ||
    normalized === '[::1]' ||
    /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(normalized)
  );
}

/**
 * Parse the value of `serve --address`.
 *
 * Accepted: `` (defaults), `PORT`, `:PORT`, `HOST:PORT`, `[IPv6]:PORT`.
 *
 * Loopback-only is intentional: serve mode has no authentication.
 */
export function parseServeTarget(
  value: string
): { address: ServeAddress } | { error: string } {
  const raw = value.trim();
  if (raw === '') {
    return { address: { host: DEFAULT_SERVE_HOST, port: DEFAULT_SERVE_PORT } };
  }

  let host = DEFAULT_SERVE_HOST;
  let portPart = raw;

  const bracketed = raw.match(/^\[([^\]]+)\]:(.+)$/);
  if (bracketed) {
    host = bracketed[1];
    portPart = bracketed[2];
  } else if (raw.includes(':')) {
    const lastColon = raw.lastIndexOf(':');
    const hostPart = raw.slice(0, lastColon);
    portPart = raw.slice(lastColon + 1);
    if (hostPart !== '') {
      host = hostPart;
    }
  }

  if (!isLoopbackHost(host)) {
    return {
      error: `--address only binds a loopback host (got "${host}"). Serve mode has no authentication; reach it over a forwarded port instead.`,
    };
  }

  if (!/^\d+$/.test(portPart)) {
    return { error: `--address port must be a number (got "${portPart}")` };
  }
  const port = Number(portPart);
  if (port > 65535) {
    return { error: `--address port must be between 0 and 65535 (got ${port})` };
  }

  return { address: { host: host.replace(/^\[|\]$/g, ''), port } };
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

  // Filter out arguments that are not the application's own:
  //  - macOS Finder process serial numbers (-psn_XXXX), passed when an app is
  //    launched by double-clicking.
  //  - Chromium's --ozone-platform switch, which serve mode re-launches itself
  //    with (see relaunchHeadless in main.ts) and which must never reach git.
  return args.filter(
    arg => !arg.startsWith('-psn_') && !arg.startsWith('--ozone-platform')
  );
}

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
      console.error(
        'Error: fetch-comments requires a pull/merge request URL argument'
      );
      process.exit(1);
    }

    return {
      resumeFrom: null,
      gitDiffArgs: [],
      subcommand: 'fetch-comments',
      remoteUrl,
      allThreads,
      serve: null,
      outputPath: null,
    };
  }

  // Subcommand mode: `self-review serve [--address=HOST:PORT] [--output <file>]
  // [<git-diff-args>...]`. Recognized only as the very first argument, matching
  // fetch-comments.
  if (args[0] === 'serve') {
    let address: ServeAddress = {
      host: DEFAULT_SERVE_HOST,
      port: DEFAULT_SERVE_PORT,
    };
    let outputPath: string | null = null;
    let resumeFrom: string | null = null;
    const gitDiffArgs: string[] = [];
    const rest = args.slice(1);

    for (let i = 0; i < rest.length; i++) {
      const arg = rest[i];

      if (arg === '--address' || arg.startsWith('--address=')) {
        let value: string;
        if (arg === '--address') {
          if (i + 1 >= rest.length) {
            console.error('Error: --address requires a HOST:PORT argument');
            process.exit(1);
            continue;
          }
          value = rest[i + 1];
          i++;
        } else {
          value = arg.slice('--address='.length);
        }
        const parsed = parseServeTarget(value);
        if ('error' in parsed) {
          console.error(`Error: ${parsed.error}`);
          process.exit(1);
          continue;
        }
        address = parsed.address;
        continue;
      }

      if (arg === '--output' || arg.startsWith('--output=')) {
        if (arg === '--output') {
          if (i + 1 >= rest.length) {
            console.error('Error: --output requires a file path argument');
            process.exit(1);
            continue;
          }
          outputPath = rest[i + 1];
          i++;
        } else {
          outputPath = arg.slice('--output='.length);
        }
        continue;
      }

      if (arg === '--resume-from') {
        if (i + 1 >= rest.length) {
          console.error('Error: --resume-from requires a file path argument');
          process.exit(1);
          continue;
        }
        resumeFrom = rest[i + 1];
        i++;
        continue;
      }

      gitDiffArgs.push(arg);
    }

    return {
      resumeFrom,
      gitDiffArgs,
      subcommand: 'serve',
      remoteUrl: null,
      allThreads: false,
      serve: address,
      outputPath,
    };
  }

  let resumeFrom: string | null = null;
  let remoteUrl: string | null = null;
  let outputPath: string | null = null;
  const gitDiffArgs: string[] = [];
  let firstPositionalSeen = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--resume-from') {
      if (i + 1 >= args.length) {
        console.error('Error: --resume-from requires a file path argument');
        process.exit(1);
      }
      resumeFrom = args[i + 1];
      i++; // Skip the next arg
      continue;
    }

    // `--output=<path>` and `--output <path>` both set the review file path.
    if (arg === '--output' || arg.startsWith('--output=')) {
      if (arg === '--output') {
        if (i + 1 >= args.length) {
          console.error('Error: --output requires a file path argument');
          process.exit(1);
          continue;
        }
        outputPath = args[i + 1];
        i++; // Skip the next arg
      } else {
        outputPath = arg.slice('--output='.length);
      }
      continue;
    }

    // Remote GUI mode: only the FIRST positional argument may be a forge
    // URL, and never after the `--` separator (everything after `--` is a
    // pathspec by git convention). Non-URL positionals keep pass-through.
    if (arg === '--') {
      firstPositionalSeen = true; // no URL detection past the separator
    } else if (!arg.startsWith('-') && !firstPositionalSeen) {
      firstPositionalSeen = true;
      if (parseForgeUrl(arg) !== null) {
        remoteUrl = arg;
        continue; // never forwarded to git diff
      }
    }

    // All other args are passed through to git diff
    gitDiffArgs.push(arg);
  }

  return {
    resumeFrom,
    gitDiffArgs,
    subcommand: null,
    remoteUrl,
    allThreads: false,
    serve: null,
    outputPath,
  };
}

function printHelp(): void {
  const help = `
self-review - Local git diff review UI

Usage: self-review [options] [<git-diff-args>...]
       self-review <pr-or-mr-url>
       self-review fetch-comments <pr-or-mr-url> [--all-threads]
       self-review serve [--address=HOST:PORT] [--output <file>] [<git-diff-args>...]

Options:
  --resume-from <file>    Load a previous review XML file
  --output <file>         Path the review XML is written to. Overrides the
                          output-file configuration key. In serve mode it is
                          fixed at launch and the UI offers no control for it.
  --help, -h              Show this help message
  --version, -v           Show version number

Subcommands:
  fetch-comments <url>    Headless: fetch PR/MR discussion threads and write
                          them as a review XML file (no window).
    --all-threads         Include threads the forge marks resolved
                          (GitLab; default is unresolved only).

  serve                   Serve the review UI over HTTP instead of opening a
                          window, for reviewing from a browser elsewhere.
                          Finishing the review stops the server.
    --address=HOST:PORT   Where to bind. Defaults to 127.0.0.1:7738. Loopback
                          only: serve mode has no authentication. Accepts
                          PORT, :PORT, HOST:PORT and [IPv6]:PORT.
    --output <file>       Fixed for the session; the UI offers no control.

Examples:
  self-review                                   # unstaged changes (git diff default)
  self-review --staged                          # staged changes
  self-review main..feature-branch
  self-review HEAD~3
  self-review -- src/auth.ts
  self-review --resume-from review.xml          # resume a previous review
  self-review https://github.com/o/r/pull/42    # review a remote PR
  self-review fetch-comments https://github.com/o/r/pull/42
  self-review serve --output=my-review.xml       # review from a browser
  self-review serve --address=:8080 main..feature # on an explicit port

All arguments except --resume-from, --output and --help are passed
to git diff.
If no arguments are provided, shows unstaged working tree changes.

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
/**
 * Insert `--` before the first non-flag positional arg that exists as a
 * filesystem path.  This makes the args unambiguous so downstream code
 * (expand-context) never confuses a path for a revision.
 *
 * Idempotent: if `--` is already present the args are returned unchanged.
 */
export function normalizeGitDiffArgs(args: string[], cwd: string = process.cwd()): string[] {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--') return args; // already explicit — nothing to do
    if (arg.startsWith('-')) continue; // flag
    // Non-flag positional arg: check if it's a filesystem path
    if (existsSync(resolve(cwd, arg))) {
      return [...args.slice(0, i), '--', ...args.slice(i)];
    }
  }
  return args;
}

export function checkEarlyExit(): EarlyExitInfo {
  const args = getAppArgs();

  // Check for --help
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return { shouldExit: true, exitCode: 0 };
  }

  // Check for --version
  if (args.includes('--version') || args.includes('-v')) {
    printVersion();
    return { shouldExit: true, exitCode: 0 };
  }

  return { shouldExit: false, exitCode: 0 };
}
