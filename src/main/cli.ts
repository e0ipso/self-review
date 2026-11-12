// Process-facing compatibility facade. Parsing itself has no process or console effects.
import { extractDesktopArgs, parseAppArgs, parseEarlyExit } from './cli-parser';
import type { CliArgs } from './cli-parser';
export type { CliArgs } from './cli-parser';

function getAppArgs(): string[] {
  return extractDesktopArgs(
    process.argv,
    Boolean((process as NodeJS.Process & { defaultApp?: boolean }).defaultApp)
  );
}

export function parseCliArgs(): CliArgs {
  const result = parseAppArgs(getAppArgs());
  for (const message of result.diagnostics) console.error(message);
  if (result.exitCode !== null) process.exit(result.exitCode);
  return result.args;
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
  const action = parseEarlyExit(getAppArgs());
  if (action === 'help') printHelp();
  if (action === 'version') printVersion();
  return { shouldExit: action !== null, exitCode: 0 };
}
