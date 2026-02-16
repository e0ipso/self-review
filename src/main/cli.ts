// src/main/cli.ts
// CLI argument parsing for self-review

export interface CliArgs {
  resumeFrom: string | null;
  gitDiffArgs: string[];
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
  return args.filter(arg => !arg.startsWith('-psn_'));
}

export function parseCliArgs(): CliArgs {
  const args = getAppArgs();
  let resumeFrom: string | null = null;
  const gitDiffArgs: string[] = [];

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

    // All other args are passed through to git diff
    gitDiffArgs.push(arg);
  }

  return { resumeFrom, gitDiffArgs };
}

function printHelp(): void {
  const help = `
self-review - Local git diff review UI

Usage: self-review [options] [<git-diff-args>...]

Options:
  --resume-from <file>    Load a previous review XML file
  --help, -h              Show this help message
  --version, -v           Show version number

Examples:
  self-review                                   # unstaged changes (git diff default)
  self-review --staged                          # staged changes
  self-review main..feature-branch
  self-review HEAD~3
  self-review -- src/auth.ts
  self-review --resume-from review.xml          # resume a previous review

All arguments except --resume-from and --help are passed to git diff.
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
