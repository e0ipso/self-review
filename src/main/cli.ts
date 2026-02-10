// src/main/cli.ts
// CLI argument parsing for self-review

export interface CliArgs {
  resumeFrom: string | null;
  gitDiffArgs: string[];
}

export function parseCliArgs(): CliArgs {
  const args = process.argv.slice(2);
  let resumeFrom: string | null = null;
  const gitDiffArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    if (arg === '--version' || arg === '-v') {
      printVersion();
      process.exit(0);
    }

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
  self-review --staged > review.xml
  self-review main..feature-branch > review.xml
  self-review HEAD~3 > review.xml
  self-review --staged -- src/auth.ts > review.xml
  self-review --staged --resume-from review.xml > review-updated.xml

All arguments except --resume-from and --help are passed to git diff.
If no arguments are provided, defaults to --staged.
`;
  console.error(help.trim());
}

function printVersion(): void {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const packageJson = require('../../package.json');
  console.error(`self-review v${packageJson.version}`);
}
