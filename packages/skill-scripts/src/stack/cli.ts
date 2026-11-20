// Entry point of the self-review-stack helper, bundled into
// .agents/skills/self-review-stack/scripts/stack.cjs. Core is imported by relative source
// path, never through the @self-review/core barrel, so the bundle carries only the modules
// the helper reaches.

import { describeGitDiffSides } from '../../../core/src/source-identity';

const USAGE = 'usage: stack.cjs resolve <git-diff-args...>';

/** Placeholder: prints the two snapshot kinds the diff arguments compare. */
function resolve(args: readonly string[]): number {
  const { oldSide, newSide } = describeGitDiffSides(args);
  process.stdout.write(`old: ${oldSide.kind}\nnew: ${newSide.kind}\n`);
  return 0;
}

function main(argv: readonly string[]): number {
  const [subcommand, ...args] = argv;
  switch (subcommand) {
    case 'resolve':
      return resolve(args);
    default:
      process.stderr.write(`${USAGE}\n`);
      return 2;
  }
}

process.exitCode = main(process.argv.slice(2));
