// packages/core/src/remote-mode.ts
// Remote PR/MR session bootstrap, shared by every front end.
//
// Binding rule: after materialization, remote mode *is* git mode. This
// module turns a forge URL into the inputs the existing git-mode pipeline
// already understands — a repo path and a `baseSha...headSha` range — plus
// the fetched discussion threads and the remote provenance the serializer
// records. `loadRemoteReview` then loads the diff and maps the threads against it,
// so the app and `fetch-comments` produce the same comments. Every external effect
// is injectable so unit tests never spawn git/gh/glab.
//
// Lifetime: one session, one `AbortSignal`. Aborting kills the command in flight
// and rejects with `CommandCancelledError`; whatever the session acquired is
// released first. A returned session hands its `cleanup` to the caller.

import {
  CommandCancelledError,
  ForgeCliUnavailableError,
  isCommandCancelled,
  parseForgeUrl,
} from './forge-provider';
import type {
  ForgeCommandRunner,
  ForgeName,
  ForgeProvider,
  ForgeThread,
  ForgeUrl,
} from './forge-provider';
import { createGitHubProvider } from './github-provider';
import { createGitLabProvider } from './gitlab-provider';
import {
  DEFAULT_GIT_COMMAND_TIMEOUT_MS,
  defaultGitRunner,
  detectExistingClone,
  materialize,
  resolveRemoteDefaultBranch,
} from './materializer';
import type {
  ExistingClone,
  MaterializeMode,
  MaterializeOptions,
  MaterializeResult,
} from './materializer';
import { mapThreadsToReviewComments } from './thread-mapper';
import { createIgnoreFilter } from './ignore-filter';
import type {
  DiffFile,
  DiffLoadPayload,
  RemoteDriftInfo,
  RemoteSessionInfo,
  ReviewComment,
  ReviewSourceIdentity,
  ReviewState,
} from './types';
import { loadGitDiffWithUntracked } from './git-diff-loader';
import { formatGitDiffArgs } from './git-diff-args';
import { canonicalSourcePath } from './source-identity';

/**
 * The git-mode inputs plus the forge threads, before any diff is loaded (so nothing to anchor
 * suggestions to yet).
 */
export interface MaterializedRemoteSession {
  forgeUrl: ForgeUrl;
  /** Root of the materialized clone; the pipeline's repo path. */
  repoPath: string;
  /** Arguments for the existing git-diff machinery: `[base...head]`. */
  gitDiffArgs: string[];
  mode: MaterializeMode;
  /** Idempotent, never rejects; the receiver of the session must call it. */
  cleanup: () => Promise<void>;
  /** Provenance + thread-sync status for payloads and the saved review. */
  remote: RemoteSessionInfo;
  /** Verbatim; empty when thread sync is unavailable. */
  fetchedThreads: ForgeThread[];
}

/** A session whose diff is loaded and whose threads are mapped against it. */
export interface RemoteSession extends MaterializedRemoteSession {
  /** Review-level threads keep the sentinel `filePath: ''` (REVIEW_LEVEL_FILE_PATH). */
  fetchedComments: ReviewComment[];
}

/** Injectable seams; defaults are the real core APIs. */
export interface RemoteSessionDeps {
  createProvider: (forge: ForgeName, runner: ForgeCommandRunner) => ForgeProvider;
  materialize: (
    url: ForgeUrl,
    baseBranch: string,
    cwd: string,
    runner: ForgeCommandRunner,
    existingClone?: ExistingClone | null,
    options?: MaterializeOptions
  ) => Promise<MaterializeResult>;
  detectExistingClone: (
    url: ForgeUrl,
    cwd: string,
    runner: ForgeCommandRunner,
    options?: MaterializeOptions
  ) => Promise<ExistingClone | null>;
  resolveRemoteDefaultBranch: (
    url: ForgeUrl,
    runner: ForgeCommandRunner,
    existing?: ExistingClone | null,
    options?: MaterializeOptions
  ) => Promise<string>;
  runner: ForgeCommandRunner;
  /** Untracked files are never included. A stand-in may omit `diagnostics` and `identity`. */
  loadDiff: (
    gitDiffArgs: string[],
    cwd: string
  ) => Promise<{
    files: DiffFile[];
    repository: string;
    diagnostics?: string[];
    identity?: ReviewSourceIdentity;
  }>;
}

function defaultCreateProvider(forge: ForgeName, runner: ForgeCommandRunner): ForgeProvider {
  return forge === 'github' ? createGitHubProvider(runner) : createGitLabProvider(runner);
}

/** Puts `gh`/`glab` under the session's bounds too, so a startup deadline can reach them. */
function bindSessionRunner(runner: ForgeCommandRunner, signal?: AbortSignal): ForgeCommandRunner {
  return (command, args, options) => {
    if (signal?.aborted) {
      return Promise.reject(new CommandCancelledError('aborted', command, args));
    }
    return runner(command, args, {
      signal,
      timeoutMs: DEFAULT_GIT_COMMAND_TIMEOUT_MS,
      ...options,
    });
  };
}

function throwIfAborted(signal: AbortSignal | undefined, stage: string): void {
  if (signal?.aborted) {
    throw new CommandCancelledError('aborted', 'self-review', [stage]);
  }
}

export const defaultRemoteSessionDeps: RemoteSessionDeps = {
  createProvider: defaultCreateProvider,
  detectExistingClone,
  materialize,
  resolveRemoteDefaultBranch,
  runner: defaultGitRunner,
  loadDiff: (gitDiffArgs, cwd) =>
    // A base...head diff of a remote PR/MR must never pick up local
    // untracked files (an existing clone may have unrelated ones).
    loadGitDiffWithUntracked(gitDiffArgs, cwd, { includeUntracked: false }),
};

export interface RemoteLifetimeOptions {
  /** Without one, the session is bounded only by the per-command timeout. */
  signal?: AbortSignal;
}

export interface StartRemoteSessionOptions extends RemoteLifetimeOptions {
  includeResolved?: boolean;
  /**
   * `'optional'` (default, the app): a failed fetch degrades to no threads.
   * `'required'` (`fetch-comments`): always attempted, and a failure is fatal.
   */
  threads?: 'optional' | 'required';
}

/**
 * Materialize a forge PR/MR URL into a local git context and fetch its
 * discussion threads.
 *
 * Fatal failures (unrecognizable URL, materialization errors, base-branch
 * lookup failures other than a missing CLI) throw — callers surface them
 * like any other startup git error. Forge-CLI unavailability is never
 * fatal for the base branch (git-only fallback); for threads see
 * {@link StartRemoteSessionOptions.threads}.
 */
export async function startRemoteSession(
  url: string,
  cwd: string,
  deps: Partial<RemoteSessionDeps> = {},
  options: StartRemoteSessionOptions = {}
): Promise<MaterializedRemoteSession> {
  const d: RemoteSessionDeps = { ...defaultRemoteSessionDeps, ...deps };
  const threadsRequired = options.threads === 'required';
  const { signal } = options;
  const lifetime: MaterializeOptions = { signal };
  throwIfAborted(signal, 'start');

  const forgeUrl = parseForgeUrl(url);
  if (!forgeUrl) {
    throw new Error(
      `Not a recognized pull-request or merge-request URL: ${url}\n` +
        'Expected a GitHub PR URL (…/pull/N) or a GitLab MR URL (…/-/merge_requests/N).'
    );
  }

  const provider = d.createProvider(forgeUrl.forge, bindSessionRunner(d.runner, signal));

  let cliAvailable = true;
  let baseBranch: string;
  let existingClone: ExistingClone | null | undefined;
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
    existingClone = await d.detectExistingClone(forgeUrl, cwd, d.runner, lifetime);
    baseBranch = await d.resolveRemoteDefaultBranch(forgeUrl, d.runner, existingClone, lifetime);
  }
  console.error(`[remote] Base branch: ${baseBranch}`);

  const materialized = await d.materialize(
    forgeUrl,
    baseBranch,
    cwd,
    d.runner,
    existingClone,
    lifetime
  );

  // The caller gets the cleanup handle only with a session, so anything ending the call before that
  // releases here.
  let fetchedThreads: ForgeThread[] = [];
  let threadSyncAvailable = false;
  if (cliAvailable || threadsRequired) {
    try {
      fetchedThreads = await provider.fetchThreads(forgeUrl, {
        includeResolved: options.includeResolved ?? false,
      });
      threadSyncAvailable = true;
    } catch (error) {
      // A cancelled fetch ends the session under either policy.
      if (threadsRequired || isCommandCancelled(error)) {
        await materialized.cleanup();
        if (error instanceof ForgeCliUnavailableError) {
          throw new Error(
            `Cannot fetch discussion threads: ${error.message}\n` +
              `This requires the ${error.cli} CLI to be installed and authenticated.`
          );
        }
        throw error;
      }
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
  if (signal?.aborted) {
    await materialized.cleanup();
    throwIfAborted(signal, 'threads');
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
      // A temporary clone is deleted on exit, so nothing may be written
      // into it; the front end needs the fact, not the path.
      temporaryClone: materialized.mode === 'temp-clone',
    },
    fetchedThreads,
  };
}

export interface RemoteReviewLoad {
  /** After the ignore configuration. */
  files: DiffFile[];
  repository: string;
  diagnostics: string[];
  /** `session.fetchedThreads` mapped against `files` and the materialized head. */
  comments: ReviewComment[];
  identity?: ReviewSourceIdentity;
}

/**
 * Load the diff, apply the ignore configuration and map the threads: the one place
 * this happens, so the app and `fetch-comments` cannot drift. Mapping against the
 * filtered files and the materialized head keeps a suggestion on an ignored path
 * or another head plain text (R05). Does not release the session on failure. An
 * abort during the load discards the result and throws.
 */
export async function loadRemoteReview(
  session: MaterializedRemoteSession,
  ignorePatterns: string[],
  loadDiff: RemoteSessionDeps['loadDiff'] = defaultRemoteSessionDeps.loadDiff,
  options: RemoteLifetimeOptions = {}
): Promise<RemoteReviewLoad> {
  throwIfAborted(options.signal, 'load');
  const { files, repository, diagnostics, identity } = await loadDiff(
    session.gitDiffArgs,
    session.repoPath
  );
  throwIfAborted(options.signal, 'load');
  const shouldKeep = createIgnoreFilter(ignorePatterns);
  const filteredFiles = files.filter(f => shouldKeep(f.newPath || f.oldPath));
  return {
    files: filteredFiles,
    repository,
    diagnostics: diagnostics ?? [],
    comments: mapThreadsToReviewComments(
      session.fetchedThreads,
      filteredFiles,
      session.remote.remoteHeadSha
    ),
    ...(identity ? { identity } : {}),
  };
}

/** A remote session plus the ready-to-send git-mode diff payload. */
export interface RemoteBootstrapResult {
  session: RemoteSession;
  payload: DiffLoadPayload;
  identity: ReviewSourceIdentity;
}

/**
 * The loader's identity relabelled as remote, with the user's launch directory rather than the
 * clone's; a stand-in loader still yields the head, with the merge base unknown.
 */
function remoteSourceIdentity(
  started: MaterializedRemoteSession,
  loaded: RemoteReviewLoad,
  cwd: string
): ReviewSourceIdentity {
  const resolved = loaded.identity ?? {
    sourceRoot: canonicalSourcePath(loaded.repository),
    gitDiffArgv: [...started.gitDiffArgs],
    pathPrefix: '',
    oldSide: { kind: 'unknown' as const, reason: 'the merge base was not resolved' },
    newSide: { kind: 'commit' as const, sha: started.remote.remoteHeadSha },
  };
  return { ...resolved, mode: 'remote', invocationCwd: cwd };
}

/**
 * Full remote bootstrap for the app: materialize, {@link loadRemoteReview}, and shape
 * the git-mode `DiffLoadPayload`. Thread sync degrades rather than failing.
 */
export async function bootstrapRemoteDiff(
  url: string,
  cwd: string,
  ignorePatterns: string[],
  deps: Partial<RemoteSessionDeps> = {},
  options: RemoteLifetimeOptions = {}
): Promise<RemoteBootstrapResult> {
  const d: RemoteSessionDeps = { ...defaultRemoteSessionDeps, ...deps };
  const started = await startRemoteSession(url, cwd, d, { signal: options.signal });

  // The caller gets the cleanup handle only with the result, so any failure before that releases
  // here.
  try {
    const loaded = await loadRemoteReview(started, ignorePatterns, d.loadDiff, options);
    for (const diagnostic of loaded.diagnostics) {
      console.error(`[remote] Diff diagnostic: ${diagnostic}`);
    }

    const session: RemoteSession = { ...started, fetchedComments: loaded.comments };
    return {
      session,
      identity: remoteSourceIdentity(started, loaded, cwd),
      payload: {
        files: loaded.files,
        source: {
          type: 'git',
          // Same renderer the git-mode path uses, so expand-context can
          // tokenize this string back into the exact argv.
          gitDiffArgs: formatGitDiffArgs(session.gitDiffArgs),
          repository: loaded.repository,
        },
        remote: session.remote,
        // So the renderer never mistakes a failed load for "no changes".
        ...(loaded.diagnostics.length > 0 ? { diagnostics: loaded.diagnostics } : {}),
      },
    };
  } catch (error) {
    await started.cleanup();
    throw error;
  }
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
    ...fetched.filter(c => c.remoteId === undefined || !resumedRemoteIds.has(c.remoteId)),
  ];
}

/**
 * Return a copy of the state carrying this session's remote provenance, so
 * "Finish Review" writes the `remote-*` root attributes. Always records the
 * live session values: the saved document describes the diff that was
 * actually reviewed.
 */
export function applyRemoteProvenance(state: ReviewState, remote: RemoteSessionInfo): ReviewState {
  return {
    ...state,
    // The three source shapes are mutually exclusive in the document: the
    // remote-* attributes ARE the source, so the in-session git source
    // (the materialized clone) must not leak into the saved review. The
    // welcome source emits no source attributes, mirroring fetch-comments.
    source: { type: 'welcome' },
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
