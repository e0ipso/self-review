// materializer.ts
// Clone-aware diff materializer: turns a parsed forge URL into a local git
// context. Reuses an existing matching clone (fetch only, no working-tree
// changes) or creates a disposable blobless clone under the OS temp root,
// then reports the resolved base/head SHAs so downstream code can run the
// existing local git-mode pipeline over `baseSha...headSha`.
//
// Every run owns its snapshot: base and head are fetched into
// `refs/self-review/<session>/base|head` and the SHAs read from exactly those refs,
// so concurrent sessions never see each other's SHAs (R16). Every git command runs
// under the session's `AbortSignal` and a per-command timeout.
//
// All git interaction goes through an injectable command runner (the same
// shape providers use) so unit tests never spawn real git. This module never
// talks to a forge API: head refs come from the forges' well-known git refs
// (`refs/pull/N/head`, `refs/merge-requests/N/head`) over plain git.

import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { stripTrailingNewline } from './git';
import { CommandCancelledError } from './forge-provider';
import type {
  CommandCancelReason,
  ForgeCommandOptions,
  ForgeCommandResult,
  ForgeCommandRunner,
  ForgeUrl,
} from './forge-provider';

/** How the local git context was obtained. */
export type MaterializeMode = 'existing-clone' | 'temp-clone';

/** Result of materializing a forge URL into a local git context. */
export interface MaterializeResult {
  /** Root of the git repository to run the diff pipeline in. */
  repoPath: string;
  /** Resolved SHA of the PR/MR base branch tip. */
  baseSha: string;
  /** Resolved SHA of the PR/MR head (the live remote head). */
  headSha: string;
  mode: MaterializeMode;
  /**
   * Refs this session created in a reused clone and deletes on cleanup; empty for a temp clone.
   */
  ownedRefs: readonly string[];
  /**
   * Removes the temp clone (synchronously, before the first await, so an `exit`
   * handler that cannot wait still gets that far) and deletes the session's refs
   * from a reused clone. Idempotent, never rejects; a failed deletion goes to stderr.
   */
  cleanup: () => Promise<void>;
}

/** A local clone whose fetch remote matches the requested forge repository. */
export interface ExistingClone {
  repoPath: string;
  remoteName: string;
}

export interface MaterializeOptions {
  /**
   * Aborting kills the command in flight and rejects with {@link CommandCancelledError}; the temp
   * clone is removed first.
   */
  signal?: AbortSignal;
  /** Defaults to {@link DEFAULT_GIT_COMMAND_TIMEOUT_MS}. */
  commandTimeoutMs?: number;
}

/**
 * Generous because a blobless clone over a slow link is legitimately slow; tighter hosts abort via
 * the signal.
 */
export const DEFAULT_GIT_COMMAND_TIMEOUT_MS = 10 * 60 * 1000;

const CLEANUP_COMMAND_TIMEOUT_MS = 15_000;

const KILL_GRACE_MS = 2_000;

const MAX_OUTPUT_BYTES = 50 * 1024 * 1024;

const AUTH_HINT =
  'Hint: if this repository is private or requires authentication, run ' +
  '`gh auth setup-git` (GitHub) or `glab auth git-credential` (GitLab) to ' +
  'wire your CLI credentials into git.';

/**
 * Default runner: spawns the real binary. Rejects on spawn failure, on output over
 * the buffer cap, and with {@link CommandCancelledError} on abort or timeout (SIGTERM,
 * then SIGKILL after {@link KILL_GRACE_MS}; settles once the child exited).
 *
 * Deliberately not in its own process group: that would detach the controlling
 * terminal and silently disable git's and ssh's credential prompts.
 */
export const defaultGitRunner: ForgeCommandRunner = (command, args, options = {}) =>
  new Promise<ForgeCommandResult>((resolve, reject) => {
    const { signal, timeoutMs } = options;
    if (signal?.aborted) {
      reject(new CommandCancelledError('aborted', command, args));
      return;
    }

    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let outputBytes = 0;
    let settled = false;
    let cancelled: CommandCancelReason | null = null;
    let overflowed = false;
    let killTimer: NodeJS.Timeout | undefined;
    let timeoutTimer: NodeJS.Timeout | undefined;

    const killChild = () => {
      child.kill('SIGTERM');
      killTimer = setTimeout(() => {
        if (!settled) child.kill('SIGKILL');
      }, KILL_GRACE_MS);
    };
    const cancel = (reason: CommandCancelReason) => {
      if (settled || cancelled !== null) return;
      cancelled = reason;
      killChild();
    };
    const onAbort = () => cancel('aborted');
    signal?.addEventListener('abort', onAbort, { once: true });
    if (timeoutMs !== undefined && timeoutMs > 0) {
      timeoutTimer = setTimeout(() => cancel('timeout'), timeoutMs);
    }

    const settle = (outcome: () => void) => {
      if (settled) return;
      settled = true;
      if (killTimer) clearTimeout(killTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      signal?.removeEventListener('abort', onAbort);
      outcome();
    };

    const collect = (sink: Buffer[]) => (chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes > MAX_OUTPUT_BYTES) {
        if (!overflowed) {
          overflowed = true;
          killChild();
        }
        return;
      }
      sink.push(chunk);
    };
    child.stdout?.on('data', collect(stdout));
    child.stderr?.on('data', collect(stderr));

    child.on('error', error => settle(() => reject(error)));

    // A helper (ssh waiting on the terminal) may hold our pipes; closing them lets `close` follow
    // `exit`.
    child.on('exit', () => {
      if (cancelled !== null || overflowed) {
        child.stdout?.destroy();
        child.stderr?.destroy();
      }
    });

    child.on('close', (code, exitSignal) =>
      settle(() => {
        if (cancelled !== null) {
          reject(new CommandCancelledError(cancelled, command, args));
          return;
        }
        if (overflowed) {
          reject(
            new Error(`${command} ${args.join(' ')} produced more than ${MAX_OUTPUT_BYTES} bytes`)
          );
          return;
        }
        let stderrText = Buffer.concat(stderr).toString('utf-8');
        if (code === null && exitSignal) {
          stderrText += `${stderrText.endsWith('\n') || stderrText === '' ? '' : '\n'}(killed by ${exitSignal})\n`;
        }
        resolve({
          stdout: Buffer.concat(stdout).toString('utf-8'),
          stderr: stderrText,
          exitCode: code ?? 1,
        });
      })
    );
  });

/** Well-known git ref for the PR/MR head on each forge. */
function headRefFor(url: ForgeUrl): string {
  return url.forge === 'github'
    ? `refs/pull/${url.number}/head`
    : `refs/merge-requests/${url.number}/head`;
}

/**
 * HTTPS clone URL for the forge repository. Git's credential machinery
 * (helpers, `gh auth setup-git`) handles auth; no transport selection here.
 */
function cloneUrlFor(url: ForgeUrl): string {
  return `https://${url.host}/${url.owner}/${url.repo}.git`;
}

/** The refs one session fetches into. Unique per call. */
function sessionRefs(): { base: string; head: string } {
  const session = randomUUID();
  return {
    base: `refs/self-review/${session}/base`,
    head: `refs/self-review/${session}/head`,
  };
}

/** A git runner bound to one session's bounds: `git <args>` under its signal and timeout. */
type SessionGit = (args: string[]) => Promise<ForgeCommandResult>;

function bindGit(runner: ForgeCommandRunner, options: MaterializeOptions): SessionGit {
  const commandOptions: ForgeCommandOptions = {
    signal: options.signal,
    timeoutMs: options.commandTimeoutMs ?? DEFAULT_GIT_COMMAND_TIMEOUT_MS,
  };
  return args => {
    // A scripted runner may ignore the signal; the answer must not depend on the runner.
    if (options.signal?.aborted) {
      return Promise.reject(new CommandCancelledError('aborted', 'git', args));
    }
    return runner('git', args, commandOptions);
  };
}

function gitFailure(what: string, result: ForgeCommandResult, withAuthHint: boolean): Error {
  const stderr = result.stderr.trim();
  const lines = [
    `git ${what} failed (exit code ${result.exitCode})${stderr ? `:\n${stderr}` : ''}`,
  ];
  if (withAuthHint) {
    lines.push('', AUTH_HINT);
  }
  return new Error(lines.join('\n'));
}

/** Strip a trailing `.git` and trailing slashes from a repo path. */
function stripRepoPath(repoPath: string): string {
  return repoPath.replace(/\/+$/, '').replace(/\.git$/i, '');
}

/**
 * Normalize a git remote URL (SSH scp-style, ssh://, http(s)://) into a
 * comparable `{ host, path }` pair, or `null` when unrecognized.
 */
function normalizeRemoteUrl(raw: string): { host: string; path: string } | null {
  const trimmed = raw.trim();
  if (trimmed.includes('://')) {
    try {
      const parsed = new URL(trimmed);
      return {
        host: parsed.host.toLowerCase(),
        path: stripRepoPath(parsed.pathname.replace(/^\/+/, '')).toLowerCase(),
      };
    } catch {
      return null;
    }
  }
  // scp-style: [user@]host:path
  const scp = /^(?:[^@\s]+@)?([^:/\s]+):(.+)$/.exec(trimmed);
  if (scp) {
    return {
      host: scp[1].toLowerCase(),
      path: stripRepoPath(scp[2].replace(/^\/+/, '')).toLowerCase(),
    };
  }
  return null;
}

/**
 * Parse `git remote -v` output and return the name of the first remote whose
 * fetch URL matches the forge URL's host and owner/repo, or `null`.
 */
function findMatchingRemote(remoteVOutput: string, url: ForgeUrl): string | null {
  const wantedHost = url.host.toLowerCase();
  const wantedPath = `${url.owner}/${url.repo}`.toLowerCase();
  for (const line of remoteVOutput.split('\n')) {
    const match = /^(\S+)\t(.+?)\s+\(fetch\)$/.exec(line.trim());
    if (!match) continue;
    const normalized = normalizeRemoteUrl(match[2]);
    if (normalized && normalized.host === wantedHost && normalized.path === wantedPath) {
      return match[1];
    }
  }
  return null;
}

async function revParse(git: SessionGit, repoPath: string, ref: string): Promise<string> {
  const result = await git(['-C', repoPath, 'rev-parse', ref]);
  if (result.exitCode !== 0) {
    throw gitFailure(`rev-parse ${ref}`, result, false);
  }
  return result.stdout.trim();
}

/** One fetch into this session's refs, SHAs read back from exactly those refs. */
async function fetchSnapshot(
  git: SessionGit,
  repoPath: string,
  remote: string,
  url: ForgeUrl,
  baseBranch: string,
  refs: { base: string; head: string },
  failureLabel: string
): Promise<{ baseSha: string; headSha: string }> {
  // Forced refspecs are fine: these refs are ours alone.
  const fetch = await git([
    '-C',
    repoPath,
    'fetch',
    remote,
    `+refs/heads/${baseBranch}:${refs.base}`,
    `+${headRefFor(url)}:${refs.head}`,
  ]);
  if (fetch.exitCode !== 0) {
    throw gitFailure(failureLabel, fetch, true);
  }
  return {
    baseSha: await revParse(git, repoPath, refs.base),
    headSha: await revParse(git, repoPath, refs.head),
  };
}

/**
 * Detect an existing clone: when `cwd` is inside a git repository with a
 * remote matching the forge URL, return `{ repoPath, remoteName }`.
 */
export async function detectExistingClone(
  url: ForgeUrl,
  cwd: string,
  runner: ForgeCommandRunner = defaultGitRunner,
  options: MaterializeOptions = {}
): Promise<ExistingClone | null> {
  const git = bindGit(runner, options);
  const toplevel = await git(['-C', cwd, 'rev-parse', '--show-toplevel']);
  if (toplevel.exitCode !== 0) {
    return null;
  }
  // A blanket .trim() would eat whitespace that is part of the actual path
  // (SR-0047, same defect class as SR-0036's git.ts fix), reporting a root
  // short of what's on disk and breaking the `remote -v` call right after.
  const repoPath = stripTrailingNewline(toplevel.stdout);
  const remotes = await git(['-C', repoPath, 'remote', '-v']);
  if (remotes.exitCode !== 0) {
    return null;
  }
  const remoteName = findMatchingRemote(remotes.stdout, url);
  return remoteName === null ? null : { repoPath, remoteName };
}

async function materializeIntoExistingClone(
  runner: ForgeCommandRunner,
  options: MaterializeOptions,
  url: ForgeUrl,
  baseBranch: string,
  repoPath: string,
  remoteName: string
): Promise<MaterializeResult> {
  console.error(`self-review: reusing existing clone at ${repoPath} (remote "${remoteName}")`);
  const git = bindGit(runner, options);
  const refs = sessionRefs();
  const ownedRefs = [refs.base, refs.head];

  // Not under the session signal: an aborted session must still release its refs.
  let released = false;
  const cleanup = async (): Promise<void> => {
    if (released) return;
    released = true;
    for (const ref of ownedRefs) {
      try {
        const result = await runner('git', ['-C', repoPath, 'update-ref', '-d', ref], {
          timeoutMs: CLEANUP_COMMAND_TIMEOUT_MS,
        });
        if (result.exitCode !== 0) {
          console.error(
            `self-review: could not delete ${ref} in ${repoPath}: ${result.stderr.trim()}`
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`self-review: could not delete ${ref} in ${repoPath}: ${message}`);
      }
    }
  };

  // Namespaced refs only: no checkout, branch or working-tree change. A part-way
  // failure may have created one ref, so release them before rethrowing.
  try {
    const { baseSha, headSha } = await fetchSnapshot(
      git,
      repoPath,
      remoteName,
      url,
      baseBranch,
      refs,
      `fetch from remote "${remoteName}"`
    );
    return { repoPath, baseSha, headSha, mode: 'existing-clone', ownedRefs, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

async function materializeIntoTempClone(
  runner: ForgeCommandRunner,
  options: MaterializeOptions,
  url: ForgeUrl,
  baseBranch: string
): Promise<MaterializeResult> {
  const git = bindGit(runner, options);
  // This run creates the directory, so cleanup may only ever remove it; it is owned
  // from here on, before any git runs.
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'self-review-'));
  let removed = false;
  const cleanup = async (): Promise<void> => {
    if (removed) return;
    removed = true;
    fs.rmSync(tempDir, { recursive: true, force: true });
  };

  try {
    console.error(`self-review: created temporary blobless clone at ${tempDir}`);
    const cloneUrl = cloneUrlFor(url);
    // Blobless, never shallow: --depth would break merge-base computation.
    const clone = await git(['clone', '--filter=blob:none', cloneUrl, tempDir]);
    if (clone.exitCode !== 0) {
      throw gitFailure(`clone of ${cloneUrl}`, clone, true);
    }
    const { baseSha, headSha } = await fetchSnapshot(
      git,
      tempDir,
      'origin',
      url,
      baseBranch,
      sessionRefs(),
      `fetch of ${headRefFor(url)}`
    );
    return { repoPath: tempDir, baseSha, headSha, mode: 'temp-clone', ownedRefs: [], cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

/**
 * Materialize a forge PR/MR into a local git context.
 *
 * When `cwd` is inside a git repository with a remote matching the forge
 * URL (SSH and HTTPS forms recognized, `.git` suffix tolerated), the base
 * branch and PR/MR head refs are fetched into that clone under
 * `refs/self-review/<session>/` (read-only for the working tree; `cleanup()`
 * deletes exactly those two refs). Otherwise a blobless clone is created in a
 * unique directory under the OS temp root and `cleanup()` removes it. Callers
 * that already detected a clone may pass it to skip the git probes.
 *
 * The returned `headSha` is the live remote head, so callers can compare it
 * against a recorded `remote-head-sha` for drift detection.
 */
export async function materialize(
  url: ForgeUrl,
  baseBranch: string,
  cwd: string,
  runner: ForgeCommandRunner = defaultGitRunner,
  existingClone?: ExistingClone | null,
  options: MaterializeOptions = {}
): Promise<MaterializeResult> {
  if (options.signal?.aborted) {
    throw new CommandCancelledError('aborted', 'git', ['materialize', cloneUrlFor(url)]);
  }
  const existing =
    existingClone === undefined
      ? await detectExistingClone(url, cwd, runner, options)
      : existingClone;
  if (existing) {
    return materializeIntoExistingClone(
      runner,
      options,
      url,
      baseBranch,
      existing.repoPath,
      existing.remoteName
    );
  }
  return materializeIntoTempClone(runner, options, url, baseBranch);
}

/**
 * Git-only fallback for the base branch when no forge CLI is available:
 * resolves the remote's default branch from its HEAD symref via
 * `git ls-remote --symref <remote> HEAD`. When an existing matching clone
 * is supplied, the configured remote is used so its SSH/HTTPS transport
 * and credentials are preserved. Otherwise the forge HTTPS URL is used.
 * No forge API involved.
 */
export async function resolveRemoteDefaultBranch(
  url: ForgeUrl,
  runner: ForgeCommandRunner = defaultGitRunner,
  existing: ExistingClone | null = null,
  options: MaterializeOptions = {}
): Promise<string> {
  const git = bindGit(runner, options);
  const cloneUrl = cloneUrlFor(url);
  const remote = existing?.remoteName ?? cloneUrl;
  // Errors must identify the repository; a bare alias such as "origin"
  // does not say which repository the lookup was made against.
  const label = existing ? `${remote} (${cloneUrl})` : cloneUrl;
  const args = existing
    ? ['-C', existing.repoPath, 'ls-remote', '--symref', remote, 'HEAD']
    : ['ls-remote', '--symref', remote, 'HEAD'];
  const result = await git(args);
  if (result.exitCode !== 0) {
    throw gitFailure(`ls-remote of ${label}`, result, true);
  }
  const match = /^ref:\s+refs\/heads\/(\S+)\s+HEAD$/m.exec(result.stdout);
  if (!match) {
    throw new Error(
      `Failed to resolve the default branch of ${label}: ` +
        'git ls-remote returned no HEAD symref.'
    );
  }
  return match[1];
}
