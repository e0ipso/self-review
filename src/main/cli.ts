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
 */
function getAppArgs(): string[] {
  if ((process as NodeJS.Process & { defaultApp?: boolean }).defaultApp) {
    // Dev mode: skip past the main script (first non-flag argument)
    const rawArgs = process.argv.slice(1);
    const mainScriptIdx = rawArgs.findIndex(a => !a.startsWith('-'));
    return mainScriptIdx >= 0 ? rawArgs.slice(mainScriptIdx + 1) : [];
  }
  return process.argv.slice(1);
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
  self-review > review.xml                      # unstaged changes (git diff default)
  self-review --staged > review.xml             # staged changes
  self-review main..feature-branch > review.xml
  self-review HEAD~3 > review.xml
  self-review -- src/auth.ts > review.xml
  self-review --resume-from review.xml > review-updated.xml

All arguments except --resume-from and --help are passed to git diff.
If no arguments are provided, shows unstaged working tree changes.
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
