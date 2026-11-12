import { classifyGitDiffArgs } from './git-argument-policy';

/** The probe interprets each positional path in the caller's chosen directory. */
export function normalizeGitDiffPaths(
  args: string[],
  pathExists: (path: string) => boolean
): string[] {
  const { positionalIndices, hasSeparator } = classifyGitDiffArgs(args);
  if (hasSeparator) return args;
  for (const index of positionalIndices) {
    if (pathExists(args[index])) return [...args.slice(0, index), '--', ...args.slice(index)];
  }
  return args;
}
