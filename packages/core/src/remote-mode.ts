// packages/core/src/remote-mode.ts
// Remote PR/MR session bootstrap, shared by every front end.
//
// Binding rule: after materialization, remote mode *is* git mode. This
// module turns a forge URL into the inputs the existing git-mode pipeline
// already understands — a repo path and a `baseSha...headSha` range — plus
// the fetched discussion threads and the remote provenance the serializer
// records. `loadRemoteReview` then loads that diff, applies the ignore
// configuration and maps the threads against what was loaded, so the app
// (CLI URL startup, the splash-screen `remote:open-url` handler) and the
// headless `fetch-comments` subcommand produce the same comments and the
// same suggestions for the same PR/MR under the same effective
// configuration. Every external effect goes through an injectable
// dependency so unit tests never spawn git/gh/glab.
//
// Lifetime: one session, one `AbortSignal`, one owner. Every git, gh and
// glab command of a session runs under the caller's signal and the
// materializer's per-command timeout; aborting kills the command in flight
// and the session rejects with a `CommandCancelledError`. Whatever the
// session acquired by then — a temporary clone, session refs in a reused
// clone — is released before that rejection reaches the caller, at every
// stage from clone to thread mapping. A session that is returned hands its
// `cleanup` to the caller, who owns it from then on.

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
 * A materialized remote PR/MR session: the git-mode inputs plus the forge
 * threads, before any diff has been loaded. Nothing here is mapped against
 * files — there are none yet — so there is nothing to anchor a suggestion
 * to; {@link loadRemoteReview} does that once the diff exists.
 */
export interface MaterializedRemoteSession {
  forgeUrl: ForgeUrl;
  /** Root of the materialized clone; the pipeline's repo path. */
  repoPath: string;
  /** Arguments for the existing git-diff machinery: `[base...head]`. */
  gitDiffArgs: string[];
  mode: MaterializeMode;
  /**
   * Releases what materialization acquired: the temp clone when one was
   * created, the session's refs in a reused clone otherwise. Idempotent,
   * never rejects; the caller that received this session owns calling it.
   */
  cleanup: () => Promise<void>;
  /** Provenance + thread-sync status for payloads and the saved review. */
  remote: RemoteSessionInfo;
  /**
   * Forge discussion threads, verbatim. Empty when thread sync is
   * unavailable (see {@link StartRemoteSessionOptions.threads}).
   */
  fetchedThreads: ForgeThread[];
}

/**
 * A remote session whose diff has been loaded and whose threads have been
 * mapped against it: what the app's front ends consume.
 */
export interface RemoteSession extends MaterializedRemoteSession {
  /**
   * `fetchedThreads` mapped against the reviewed (ignore-filtered) diff and
   * verified against the materialized head. Review-level threads keep the
   * mapper's sentinel `filePath: ''` (REVIEW_LEVEL_FILE_PATH).
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
  /**
   * Loads the diff from the clone. Untracked files are never included.
   * `diagnostics` carries what could not be loaded faithfully (see
   * `LoadGitDiffResult`); absent means a clean load. `identity` is the
   * loader's resolution of the compared snapshots; a stand-in may omit it.
   */
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

/**
 * A runner that runs every command under the session's bounds, for the
 * forge provider: `gh`/`glab` are part of the session too, and a startup
 * deadline that could not reach them would wait on them.
 */
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

/** Reject with the session's cancellation once `signal` has fired. */
function throwIfAborted(signal: AbortSignal | undefined, stage: string): void {
  if (signal?.aborted) {
    throw new CommandCancelledError('aborted', 'self-review', [stage]);
  }
}

/** The real dependencies: shared by every caller that does not inject its own. */
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

/** The lifetime bound a caller hands a remote session. */
export interface RemoteLifetimeOptions {
  /**
   * The session's signal. Aborting it kills the git/forge command in
   * flight; the session releases what it acquired and rejects with a
   * {@link CommandCancelledError}. An already-aborted signal rejects before
   * anything runs. Without one the session is bounded only by the
   * per-command timeout.
   */
  signal?: AbortSignal;
}

/** Per-call choices for {@link startRemoteSession}. */
export interface StartRemoteSessionOptions extends RemoteLifetimeOptions {
  /** Forwarded to the provider: include threads the forge marks resolved. */
  includeResolved?: boolean;
  /**
   * What a failed thread fetch means.
   *
   * - `'optional'` (default; the app): the review proceeds without forge
   *   threads. A forge CLI already found missing is not asked again; any
   *   other failure is one stderr note and `threadSyncAvailable: false`.
   * - `'required'` (`fetch-comments`): the threads are the whole point, so
   *   the fetch is always attempted and a failure is fatal. The clone this
   *   call materialized is released before the error propagates.
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
 * fatal for the base branch, which falls back to the git-only
 * default-branch lookup; for the threads it is governed by
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

  // From here on the session owns a temporary clone or session refs; the
  // caller receives the cleanup handle only with a session, so anything that
  // ends the call before that releases them here.
  let fetchedThreads: ForgeThread[] = [];
  let threadSyncAvailable = false;
  if (cliAvailable || threadsRequired) {
    try {
      fetchedThreads = await provider.fetchThreads(forgeUrl, {
        includeResolved: options.includeResolved ?? false,
      });
      threadSyncAvailable = true;
    } catch (error) {
      // A session being torn down is not a review without threads: a
      // cancelled fetch ends the session under either policy.
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

/** The reviewed diff of a remote session and the threads mapped against it. */
export interface RemoteReviewLoad {
  /** The diff after the ignore configuration; what the reviewer sees. */
  files: DiffFile[];
  /** Repository root the loader resolved (the clone). */
  repository: string;
  /** What the loader could not load faithfully; empty on a clean load. */
  diagnostics: string[];
  /** `session.fetchedThreads` mapped against `files` and the materialized head. */
  comments: ReviewComment[];
  /** The loader's identity of the compared snapshots, when it supplied one. */
  identity?: ReviewSourceIdentity;
}

/**
 * Load a materialized session's diff, apply the ignore configuration and
 * map its threads against the result — the one place this happens, so the
 * app and `fetch-comments` cannot drift apart.
 *
 * Mapping against the filtered files, with the materialized head as the
 * reviewed revision, is what makes the output honest: a `suggestion` fence
 * on an ignored path stays plain text rather than a proposal over code the
 * review never shows, and one on a position computed for another head is
 * never activated (R05). Does not release the session on failure; the
 * caller owns the clone's lifetime. An abort that lands during the load is
 * honoured once it returns: the result is discarded and the session's
 * cancellation is thrown instead.
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
  /** The identity to commit with `payload`: mode `remote`, rooted at the clone. */
  identity: ReviewSourceIdentity;
}

/**
 * The identity of a remote session: the loader's resolution of
 * `base...head` relabelled as remote and rooted at the clone, with the
 * user's own launch directory rather than the clone the loader ran in. A
 * loader stand-in that supplied none still yields the head commit, which
 * materialization resolved; the merge base it did not is left unknown.
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
 * Full remote bootstrap for the app: materialize the session, run
 * {@link loadRemoteReview} over it, and shape the git-mode `DiffLoadPayload`
 * (with `remote` provenance attached). Shared by the CLI URL startup path
 * and the splash-screen `remote:open-url` handler. Thread sync degrades
 * rather than failing: the review proceeds without forge threads.
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

  // One boundary from here to the return: the session owns a temporary
  // clone or session refs, and the caller receives the cleanup handle only
  // with the result, so anything that ends the call before that — the
  // load, the filter, the mapping, an abort — releases them here.
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
        // Carried only when something could not be loaded faithfully, so the
        // renderer never mistakes a failed load for "no changes".
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
