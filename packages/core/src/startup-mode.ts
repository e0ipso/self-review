// packages/core/src/startup-mode.ts
// Startup mode detection: what the app should review, from the CLI args and the CWD.

import { statSync } from 'fs';
import { stat } from 'fs/promises';
import { execFileSync } from 'child_process';
import { repositoryEnvironment } from './command-runner';
import { executeGit, type GitExecutionOptions } from './git';
import { CommandCancelledError, isCommandCancelled } from './forge-provider';
import { resolve } from 'path';
import { classifyGitDiffArgs } from './git-diff-args';

const PROBE_TIMEOUT_MS = 10_000;
const PROBE_OUTPUT_BYTES = 1024 * 1024;

/** Bounded compatibility path for callers that still need synchronous mode detection. */
function probeSync(args: string[], cwd: string): boolean {
  try {
    execFileSync('git', args, {
      stdio: 'ignore',
      cwd,
      env: repositoryEnvironment(),
      timeout: PROBE_TIMEOUT_MS,
      killSignal: 'SIGKILL',
      maxBuffer: PROBE_OUTPUT_BYTES,
    });
    return true;
  } catch {
    return false;
  }
}

/** Missing git and non-repositories retain the welcome/file fallback; interruption propagates. */
async function probeAsync(
  args: string[],
  cwd: string,
  options: GitExecutionOptions
): Promise<boolean> {
  try {
    await executeGit(args, cwd, options, PROBE_OUTPUT_BYTES);
    return true;
  } catch (error) {
    if (isCommandCancelled(error)) throw error;
    checkCancellation(options, args);
    return false;
  }
}

function firstCandidate(gitDiffArgs: readonly string[], cwd: string) {
  const { positionalIndices } = classifyGitDiffArgs([...gitDiffArgs]);
  const positional = gitDiffArgs[positionalIndices[0]];
  return { positional, candidate: positional ? resolve(cwd, positional) : null };
}

/**
 * What a review starts from; `welcome` means nothing to review (desktop shows its picker, serve
 * refuses).
 */
export type StartupSource =
  | { mode: 'git' }
  | { mode: 'directory'; sourcePath: string }
  | { mode: 'file'; sourcePath: string }
  | { mode: 'welcome' };

/**
 * The candidate is the first *positional* by the shared classifier, so `-S src/x.ts` never selects
 * a file.
 */
export function resolveStartupSource(
  gitDiffArgs: readonly string[],
  cwd: string = process.cwd()
): StartupSource {
  const { positional: firstPositional, candidate } = firstCandidate(gitDiffArgs, cwd);

  // Tracked files go through git diff, others are scanned.
  if (candidate && firstPositional && isExisting(candidate, 'file')) {
    if (probeSync(['rev-parse', '--git-dir'], cwd)) {
      return probeSync(['ls-files', '--error-unmatch', '--', firstPositional], cwd)
        ? { mode: 'git' }
        : { mode: 'file', sourcePath: candidate };
    }
    return { mode: 'file', sourcePath: candidate };
  }

  if (probeSync(['rev-parse', '--git-dir'], cwd)) {
    return { mode: 'git' };
  }

  if (candidate && isExisting(candidate, 'directory')) {
    return { mode: 'directory', sourcePath: candidate };
  }

  return { mode: 'welcome' };
}

function isExisting(candidate: string, kind: 'file' | 'directory'): boolean {
  try {
    const stats = statSync(candidate);
    return kind === 'file' ? stats.isFile() : stats.isDirectory();
  } catch {
    return false;
  }
}

/** The mode alone; see {@link resolveStartupSource} for the source path. */
export function determineMode(gitDiffArgs: string[]): 'git' | 'directory' | 'file' | 'welcome' {
  return resolveStartupSource(gitDiffArgs).mode;
}

/** Classification metadata only; content loading uses its own filesystem roles. */
export interface StartupPathStats {
  isFile(): boolean;
  isDirectory(): boolean;
}

/** An authoritative path probe. A refusal or failure never retries against the native filesystem. */
export interface StartupPathProbe {
  stat(path: string): Promise<StartupPathStats | null>;
}

export interface StartupSourceOptions extends GitExecutionOptions {
  sourceProbe?: StartupPathProbe;
}

function checkCancellation(
  options: GitExecutionOptions,
  args: string[] = ['rev-parse', '--git-dir']
): void {
  if (options.signal?.aborted) throw new CommandCancelledError('aborted', 'git', args);
}

async function candidateStat(candidate: string, options: StartupSourceOptions) {
  checkCancellation(options);
  try {
    const stats = options.sourceProbe
      ? await options.sourceProbe.stat(candidate)
      : await stat(candidate);
    checkCancellation(options);
    return stats;
  } catch (error) {
    if (isCommandCancelled(error)) throw error;
    checkCancellation(options);
    return null;
  }
}

/**
 * Nonblocking startup probes for hosts. Commands use the shared bounded runner and its
 * explicit-repository environment, including a deliberately selected local alternate index.
 * Abort and timeout reject with CommandCancelledError; ordinary probe failures keep the
 * synchronous API's file/directory/welcome fallback. timeoutMs bounds each command.
 * sourceProbe supplies classification metadata only and retains its receiver. Native stat and
 * supplied probes are joined before cancellation propagates; neither can be forcibly preempted.
 */
export async function resolveStartupSourceAsync(
  gitDiffArgs: readonly string[],
  cwd: string = process.cwd(),
  options: StartupSourceOptions = {}
): Promise<StartupSource> {
  checkCancellation(options);
  const { positional, candidate } = firstCandidate(gitDiffArgs, cwd);
  const candidateStats = candidate ? await candidateStat(candidate, options) : null;
  const inRepository = await probeAsync(['rev-parse', '--git-dir'], cwd, options);
  if (candidate && positional && candidateStats?.isFile()) {
    const tracked =
      inRepository &&
      (await probeAsync(['ls-files', '--error-unmatch', '--', positional], cwd, options));
    return tracked ? { mode: 'git' } : { mode: 'file', sourcePath: candidate };
  }
  if (inRepository) return { mode: 'git' };
  if (candidate && candidateStats?.isDirectory()) {
    return { mode: 'directory', sourcePath: candidate };
  }
  return { mode: 'welcome' };
}
