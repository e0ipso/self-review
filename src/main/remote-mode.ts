// src/main/remote-mode.ts
// Remote PR/MR session bootstrap for the main process.
//
// Binding rule: after materialization, remote mode *is* git mode. This
// module turns a forge URL into the inputs the existing git-mode pipeline
// already understands — a repo path and a `baseSha...headSha` range — plus
// the fetched discussion threads (mapped to ReviewComments for the
// resume:load path) and the remote provenance the serializer records.
//
// Reused by both the CLI URL path (main.ts startup) and the splash-screen
// URL entry (the remote:open-url IPC handler). Every external effect goes
// through an injectable dependency so unit tests never spawn git/gh/glab.

import {
  parseForgeUrl,
  ForgeCliUnavailableError,
  createGitHubProvider,
  createGitLabProvider,
  materialize,
  resolveRemoteDefaultBranch,
  defaultGitRunner,
  mapThreadsToReviewComments,
  createIgnoreFilter,
} from '../../packages/core/src/index';
import type {
  ForgeCommandRunner,
  ForgeName,
  ForgeProvider,
  ForgeUrl,
  MaterializeMode,
  MaterializeResult,
} from '../../packages/core/src/index';
import type {
  DiffFile,
  DiffLoadPayload,
  RemoteDriftInfo,
  RemoteSessionInfo,
  ReviewComment,
  ReviewState,
} from '../shared/types';
import { loadGitDiffWithUntracked } from './git-diff-loader';

/** A materialized remote PR/MR session, ready for the git-mode pipeline. */
export interface RemoteSession {
  forgeUrl: ForgeUrl;
  /** Root of the materialized clone; the pipeline's repo path. */
  repoPath: string;
  /** Arguments for the existing git-diff machinery: `[base...head]`. */
  gitDiffArgs: string[];
  mode: MaterializeMode;
  /** Removes the temp clone when one was created; idempotent no-op otherwise. */
  cleanup: () => void;
  /** Provenance + thread-sync status for payloads and the saved review. */
  remote: RemoteSessionInfo;
  /**
   * Forge discussion threads mapped to ReviewComments. Empty when the forge
   * CLI is unavailable. Review-level threads keep the mapper's sentinel
   * `filePath: ''` (REVIEW_LEVEL_FILE_PATH).
   */
  fetchedComments: ReviewComment[];
}

/** Injectable seams; defaults are the real core APIs. */
export interface RemoteSessionDeps {
  createProvider: (forge: ForgeName, runner: ForgeCommandRunner) => ForgeProvider;
  materialize: (
    url: ForgeUrl,
    baseBranch: string,
    cwd: string,
    runner: ForgeCommandRunner
  ) => Promise<MaterializeResult>;
  resolveRemoteDefaultBranch: (
    url: ForgeUrl,
    runner: ForgeCommandRunner
  ) => Promise<string>;
  runner: ForgeCommandRunner;
  /** Loads the diff from the clone. Untracked files are never included. */
  loadDiff: (
    gitDiffArgs: string[],
    cwd: string
  ) => Promise<{ files: DiffFile[]; repository: string }>;
}

function defaultCreateProvider(
  forge: ForgeName,
  runner: ForgeCommandRunner
): ForgeProvider {
  return forge === 'github'
    ? createGitHubProvider(runner)
    : createGitLabProvider(runner);
}

const defaultDeps: RemoteSessionDeps = {
  createProvider: defaultCreateProvider,
  materialize,
  resolveRemoteDefaultBranch,
  runner: defaultGitRunner,
  loadDiff: (gitDiffArgs, cwd) =>
    // A base...head diff of a remote PR/MR must never pick up local
    // untracked files (an existing clone may have unrelated ones).
    loadGitDiffWithUntracked(gitDiffArgs, cwd, { includeUntracked: false }),
};

/**
 * Materialize a forge PR/MR URL into a local git context and fetch its
 * discussion threads.
 *
 * Fatal failures (unrecognizable URL, materialization errors, base-branch
 * lookup failures other than a missing CLI) throw — callers surface them
 * like any other startup git error. Forge-CLI unavailability is never
 * fatal: the base branch falls back to the git-only default-branch lookup
 * and thread sync degrades to an empty list with a single stderr note.
 */
export async function startRemoteSession(
  url: string,
  cwd: string,
  deps: Partial<RemoteSessionDeps> = {}
): Promise<RemoteSession> {
  const d: RemoteSessionDeps = { ...defaultDeps, ...deps };

  const forgeUrl = parseForgeUrl(url);
  if (!forgeUrl) {
    throw new Error(
      `Not a recognized pull-request or merge-request URL: ${url}`
    );
  }

  const provider = d.createProvider(forgeUrl.forge, d.runner);

  let cliAvailable = true;
  let baseBranch: string;
  try {
    baseBranch = await provider.fetchBaseBranch(forgeUrl);
  } catch (error) {
    if (!(error instanceof ForgeCliUnavailableError)) {
      throw error;
    }
    cliAvailable = false;
    console.error(
      `[remote] Forge CLI unavailable (${error.cli}): ${error.message} — ` +
        'falling back to the remote default branch via git.'
    );
    baseBranch = await d.resolveRemoteDefaultBranch(forgeUrl, d.runner);
  }

  const materialized = await d.materialize(forgeUrl, baseBranch, cwd, d.runner);

  let fetchedComments: ReviewComment[] = [];
  let threadSyncAvailable = false;
  if (cliAvailable) {
    try {
      const threads = await provider.fetchThreads(forgeUrl);
      fetchedComments = mapThreadsToReviewComments(threads);
      threadSyncAvailable = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `[remote] thread sync unavailable — continuing without forge threads: ${message}`
      );
    }
  } else {
    console.error(
      '[remote] thread sync unavailable — forge CLI missing, continuing without forge threads.'
    );
  }

  return {
    forgeUrl,
    repoPath: materialized.repoPath,
    gitDiffArgs: [`${materialized.baseSha}...${materialized.headSha}`],
    mode: materialized.mode,
    cleanup: materialized.cleanup,
    remote: {
      remoteUrl: url,
      remoteBaseSha: materialized.baseSha,
      remoteHeadSha: materialized.headSha,
      remoteForge: forgeUrl.forge,
      threadSyncAvailable,
    },
    fetchedComments,
  };
}

/** A remote session plus the ready-to-send git-mode diff payload. */
export interface RemoteBootstrapResult {
  session: RemoteSession;
  payload: DiffLoadPayload;
}

/**
 * Full remote bootstrap: materialize the session, load the diff from the
 * clone through the existing git-diff machinery, apply the ignore filter,
 * and shape the git-mode `DiffLoadPayload` (with `remote` provenance
 * attached). Shared by the CLI URL startup path and the splash-screen
 * `remote:open-url` handler.
 */
export async function bootstrapRemoteDiff(
  url: string,
  cwd: string,
  ignorePatterns: string[],
  deps: Partial<RemoteSessionDeps> = {}
): Promise<RemoteBootstrapResult> {
  const d: RemoteSessionDeps = { ...defaultDeps, ...deps };
  const session = await startRemoteSession(url, cwd, d);

  const { files, repository } = await d.loadDiff(
    session.gitDiffArgs,
    session.repoPath
  );
  const shouldKeep = createIgnoreFilter(ignorePatterns);
  const filteredFiles = files.filter(f => shouldKeep(f.newPath || f.oldPath));

  return {
    session,
    payload: {
      files: filteredFiles,
      source: {
        type: 'git',
        gitDiffArgs: session.gitDiffArgs.join(' '),
        repository,
      },
      remote: session.remote,
    },
  };
}

/**
 * Merge fetched forge threads into a resumed document's comments. The
 * resumed document wins: a fetched thread whose root `remoteId` already
 * appears in the resumed comments is skipped (the resumed copy may carry
 * the user's added replies). Order: resumed comments first, then the
 * non-duplicate fetched threads in fetch order. Inputs are not mutated.
 */
export function mergeRemoteThreads(
  resumed: ReviewComment[],
  fetched: ReviewComment[]
): ReviewComment[] {
  const resumedRemoteIds = new Set(
    resumed.map(c => c.remoteId).filter((id): id is string => id !== undefined)
  );
  return [
    ...resumed,
    ...fetched.filter(
      c => c.remoteId === undefined || !resumedRemoteIds.has(c.remoteId)
    ),
  ];
}

/**
 * Return a copy of the state carrying this session's remote provenance, so
 * "Finish Review" writes the `remote-*` root attributes. Always records the
 * live session values: the saved document describes the diff that was
 * actually reviewed.
 */
export function applyRemoteProvenance(
  state: ReviewState,
  remote: RemoteSessionInfo
): ReviewState {
  return {
    ...state,
    remoteUrl: remote.remoteUrl,
    remoteBaseSha: remote.remoteBaseSha,
    remoteHeadSha: remote.remoteHeadSha,
    remoteForge: remote.remoteForge,
  };
}

/**
 * Compare a resumed document's recorded `remote-head-sha` with the live
 * head from materialization. Returns `null` when the document recorded no
 * head SHA (nothing to compare).
 */
export function computeRemoteDrift(
  recordedHeadSha: string | undefined,
  liveHeadSha: string
): RemoteDriftInfo | null {
  if (recordedHeadSha === undefined) {
    return null;
  }
  return {
    recordedHeadSha,
    liveHeadSha,
    drifted: recordedHeadSha !== liveHeadSha,
  };
}
