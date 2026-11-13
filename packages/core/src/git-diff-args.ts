// Compatibility entry point. Pure policy and text conversion never depend on this Node wrapper.
import { existsSync } from 'fs';
import { resolve } from 'path';
import { normalizeGitDiffPaths } from './git-argument-paths';

export {
  consumesNextArgument,
  parseGitDiffArgs,
  describeDiffPathRelativity,
  singleFileRediffArgs,
  findWriteCapableGitDiffOptions,
  findUnsupportedGitDiffOptions,
  classifyGitDiffArgs,
} from './git-argument-policy';
export type {
  GitDiffOption,
  ParsedGitDiffArgs,
  DiffPathRelativity,
  SingleFileRediff,
} from './git-argument-policy';
export { tokenizeGitDiffArgs, formatGitDiffArgs } from './git-argument-text';

/** Insert `--` before the first existing positional path, relative to cwd. */
export function normalizeGitDiffArgs(args: string[], cwd: string = process.cwd()): string[] {
  return normalizeGitDiffPaths(args, candidate => existsSync(resolve(cwd, candidate)));
}
