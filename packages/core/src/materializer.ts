// materializer.ts
// Clone-aware diff materializer: turns a parsed forge URL into a local git
// context. Reuses an existing matching clone (fetch only, no working-tree
// changes) or creates a disposable blobless clone under the OS temp root,
// then reports the resolved base/head SHAs so downstream code can run the
// existing local git-mode pipeline over `baseSha...headSha`.
//
// All git interaction goes through an injectable command runner (the same
// shape providers use) so unit tests never spawn real git. This module never
// talks to a forge API: head refs come from the forges' well-known git refs
// (`refs/pull/N/head`, `refs/merge-requests/N/head`) over plain git.

import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type {
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
   * Removes the temp clone directory when one was created this run; a no-op
   * for the existing-clone mode. Safe to call more than once. Only ever
   * deletes a directory this materializer created.
   */
  cleanup: () => void;
}

/** A local clone whose fetch remote matches the requested forge repository. */
export interface ExistingClone {
  repoPath: string;
  remoteName: string;
}

/** Local namespaced refs the materializer fetches into (never branches). */
const LOCAL_BASE_REF = 'refs/self-review/base';
const LOCAL_HEAD_REF = 'refs/self-review/head';

const AUTH_HINT =
  'Hint: if this repository is private or requires authentication, run ' +
  '`gh auth setup-git` (GitHub) or `glab auth git-credential` (GitLab) to ' +
  'wire your CLI credentials into git.';

/**
 * Default runner: spawns real git. Resolves with the exit code on any
 * completed run (including non-zero); rejects only when git cannot be
 * spawned at all (e.g. ENOENT).
 */
export const defaultGitRunner: ForgeCommandRunner = (command, args) =>
  new Promise<ForgeCommandResult>((resolve, reject) => {
    execFile(
      command,
      args,
      { maxBuffer: 50 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const spawnCode = (error as NodeJS.ErrnoException | null)?.code;
        if (error && typeof spawnCode === 'string') {
          reject(error);
          return;
        }
        resolve({
          stdout: stdout ?? '',
          stderr: stderr ?? '',
          exitCode: error ? (typeof spawnCode === 'number' ? spawnCode : 1) : 0,
        });
      }
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

function gitFailure(
  what: string,
  result: ForgeCommandResult,
  withAuthHint: boolean
): Error {
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
function normalizeRemoteUrl(
  raw: string
): { host: string; path: string } | null {
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

async function revParse(
  runner: ForgeCommandRunner,
  repoPath: string,
  ref: string
): Promise<string> {
  const result = await runner('git', ['-C', repoPath, 'rev-parse', ref]);
  if (result.exitCode !== 0) {
    throw gitFailure(`rev-parse ${ref}`, result, false);
  }
  return result.stdout.trim();
}

/**
 * Detect an existing clone: when `cwd` is inside a git repository with a
 * remote matching the forge URL, return `{ repoPath, remoteName }`.
 */
export async function detectExistingClone(
  url: ForgeUrl,
  cwd: string,
  runner: ForgeCommandRunner = defaultGitRunner
): Promise<ExistingClone | null> {
  const toplevel = await runner('git', ['-C', cwd, 'rev-parse', '--show-toplevel']);
  if (toplevel.exitCode !== 0) {
    return null;
  }
  const repoPath = toplevel.stdout.trim();
  const remotes = await runner('git', ['-C', repoPath, 'remote', '-v']);
  if (remotes.exitCode !== 0) {
    return null;
  }
  const remoteName = findMatchingRemote(remotes.stdout, url);
  return remoteName === null ? null : { repoPath, remoteName };
}

async function materializeIntoExistingClone(
  runner: ForgeCommandRunner,
  url: ForgeUrl,
  baseBranch: string,
  repoPath: string,
  remoteName: string
): Promise<MaterializeResult> {
  console.error(
    `self-review: reusing existing clone at ${repoPath} (remote "${remoteName}")`
  );
  // Fetch into namespaced local refs only: no checkout, no branch creation,
  // no working-tree change. Forced refspecs are fine — these refs are ours.
  const fetch = await runner('git', [
    '-C',
    repoPath,
    'fetch',
    remoteName,
    `+refs/heads/${baseBranch}:${LOCAL_BASE_REF}`,
    `+${headRefFor(url)}:${LOCAL_HEAD_REF}`,
  ]);
  if (fetch.exitCode !== 0) {
    throw gitFailure(`fetch from remote "${remoteName}"`, fetch, true);
  }
  return {
    repoPath,
    baseSha: await revParse(runner, repoPath, LOCAL_BASE_REF),
    headSha: await revParse(runner, repoPath, LOCAL_HEAD_REF),
    mode: 'existing-clone',
    cleanup: () => {},
  };
}

async function materializeIntoTempClone(
  runner: ForgeCommandRunner,
  url: ForgeUrl,
  baseBranch: string
): Promise<MaterializeResult> {
  // This run creates the directory, so cleanup may only ever remove it.
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'self-review-'));
  let removed = false;
  const cleanup = () => {
    if (removed) return;
    removed = true;
    fs.rmSync(tempDir, { recursive: true, force: true });
  };

  try {
    console.error(
      `self-review: created temporary blobless clone at ${tempDir}`
    );
    const cloneUrl = cloneUrlFor(url);
    // Blobless, never shallow: --depth would break merge-base computation.
    const clone = await runner('git', [
      'clone',
      '--filter=blob:none',
      cloneUrl,
      tempDir,
    ]);
    if (clone.exitCode !== 0) {
      throw gitFailure(`clone of ${cloneUrl}`, clone, true);
    }
    const fetch = await runner('git', [
      '-C',
      tempDir,
      'fetch',
      'origin',
      `+${headRefFor(url)}:${LOCAL_HEAD_REF}`,
    ]);
    if (fetch.exitCode !== 0) {
      throw gitFailure(`fetch of ${headRefFor(url)}`, fetch, true);
    }
    return {
      repoPath: tempDir,
      baseSha: await revParse(runner, tempDir, `origin/${baseBranch}`),
      headSha: await revParse(runner, tempDir, LOCAL_HEAD_REF),
      mode: 'temp-clone',
      cleanup,
    };
  } catch (error) {
    cleanup();
    throw error;
  }
}

/**
 * Materialize a forge PR/MR into a local git context.
 *
 * When `cwd` is inside a git repository with a remote matching the forge
 * URL (SSH and HTTPS forms recognized, `.git` suffix tolerated), the base
 * branch and PR/MR head refs are fetched into that clone under
 * `refs/self-review/*` — read-only for the working tree. Otherwise a
 * blobless clone is created in a unique directory under the OS temp root
 * and `cleanup()` removes exactly that directory. Callers that already
 * detected a clone may pass it to avoid repeating the git probes.
 *
 * The returned `headSha` is the live remote head, so callers can compare it
 * against a recorded `remote-head-sha` for drift detection.
 */
export async function materialize(
  url: ForgeUrl,
  baseBranch: string,
  cwd: string,
  runner: ForgeCommandRunner = defaultGitRunner,
  existingClone?: ExistingClone | null
): Promise<MaterializeResult> {
  const existing =
    existingClone === undefined
      ? await detectExistingClone(url, cwd, runner)
      : existingClone;
  if (existing) {
    return materializeIntoExistingClone(
      runner,
      url,
      baseBranch,
      existing.repoPath,
      existing.remoteName
    );
  }
  return materializeIntoTempClone(runner, url, baseBranch);
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
  existing: ExistingClone | null = null
): Promise<string> {
  const cloneUrl = cloneUrlFor(url);
  const remote = existing?.remoteName ?? cloneUrl;
  // Errors must identify the repository; a bare alias such as "origin"
  // does not say which repository the lookup was made against.
  const label = existing ? `${remote} (${cloneUrl})` : cloneUrl;
  const args = existing
    ? ['-C', existing.repoPath, 'ls-remote', '--symref', remote, 'HEAD']
    : ['ls-remote', '--symref', remote, 'HEAD'];
  const result = await runner('git', args);
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
