// Reuse the loaded snapshots for the initial patch and later context expansion.
// Recorded argv retains the reviewer's original symbolic revisions and options.
import type { ReviewSourceIdentity } from './types';
import { parseGitDiffArgs } from './git-diff-args';
import { describeGitDiffSides } from './source-identity';

export class UnresolvedComparisonError extends Error {
  constructor(reason: string) {
    super(`Cannot pin git diff comparison: ${reason}`);
    this.name = 'UnresolvedComparisonError';
  }
}

/**
 * Execution argv for a resolved comparison. Keeps flags and pathspecs, replaces revision
 * positionals with SHAs and removes --merge-base, whose result is already the old commit.
 * Unknown comparison shapes retain their argv so the parser can diagnose them. A supported
 * revision that failed to resolve refuses execution instead of racing its symbolic ref.
 */
export function pinnedGitDiffArgs(identity: ReviewSourceIdentity): string[] {
  const argv = identity.gitDiffArgv;
  const described = describeGitDiffSides(argv);
  if (described.oldSide.kind === 'unknown' || described.newSide.kind === 'unknown')
    return [...argv];
  for (const side of [identity.oldSide, identity.newSide]) {
    if (side.kind === 'unknown') throw new UnresolvedComparisonError(side.reason);
  }
  const parsed = parseGitDiffArgs(argv);
  const reverse = parsed.options.some(option => option.name === '-R');
  const sides = reverse
    ? [identity.newSide, identity.oldSide]
    : [identity.oldSide, identity.newSide];
  const revisions = sides.flatMap(side => {
    if (side.kind === 'commit') return [side.sha];
    if (side.kind === 'none') {
      if (!identity.emptyTreeSha)
        throw new UnresolvedComparisonError('the empty tree could not be identified');
      return [identity.emptyTreeSha];
    }
    return [];
  });
  const end = parsed.separatorIndex ?? argv.length;
  const dropped = new Set(parsed.positionalIndices.filter(index => index < end));
  for (const option of parsed.options) {
    if (option.name === '--merge-base') dropped.add(option.index);
  }
  return [
    ...argv.slice(0, end).filter((_, index) => !dropped.has(index)),
    ...revisions,
    ...argv.slice(end),
  ];
}
