// packages/core/src/fetch-comments.ts
// Headless orchestrator for `self-review fetch-comments <URL>`: materialize
// the PR/MR, fetch and map its discussion threads, and write a v3 review.xml
// with remote provenance — no window, nothing on stdout, all logging on
// stderr. The materialize → load → filter → map steps are the same ones the
// app runs (remote-mode.ts), so both produce the same suggestions for the
// same PR/MR under the same effective configuration; only the thread-fetch
// policy differs (the app degrades, this subcommand fails). Every
// collaborator is injectable so the flow is unit-testable; the CLI entry in
// main.ts stays thin.
//
// Lifetime: the run has no overall deadline of its own — a headless
// consumer may legitimately wait on a large clone — so it is bounded by the
// materializer's per-command timeout (DEFAULT_GIT_COMMAND_TIMEOUT_MS) and by
// the caller's `signal`, which the CLI entry wires to SIGINT/SIGTERM.
// Either way the run ends the same: the git or forge command in flight is
// killed, the temporary clone is removed and the run rejects; nothing is
// written. One try/finally owns the session from the moment it exists.

import { REVIEW_LEVEL_FILE_PATH } from './thread-mapper';
import { publishReview } from './review-publisher';
import type { PublishReviewOptions, PublishReviewResult } from './review-publisher';
import { loadConfigWithProvenance } from './config';
import type { LoadedConfig } from './config';
import { publishOptionsFor, resolveOutputTarget } from './startup';
import { defaultRemoteSessionDeps, loadRemoteReview, startRemoteSession } from './remote-mode';
import type { RemoteLifetimeOptions, RemoteSessionDeps } from './remote-mode';
import type { DiffFile, FileReviewState, RemoteForge, ReviewComment, ReviewState } from './types';

/**
 * Injectable seams for the orchestration: the remote-session seams the app
 * shares (provider, materializer, diff loader) plus this subcommand's own
 * output concerns. Defaults spawn real processes and touch the real
 * filesystem; tests replace them wholesale.
 */
export interface FetchCommentsDeps extends RemoteSessionDeps {
  /** Validates, stages assets and atomically writes the document; see review-publisher.ts. */
  publish: (
    state: ReviewState,
    outputPath: string,
    options: PublishReviewOptions
  ) => Promise<PublishReviewResult>;
  /** The merged configuration with the origin of each value; see `resolveOutputTarget`. */
  loadConfig: () => LoadedConfig;
  now: () => Date;
}

function defaultDeps(): FetchCommentsDeps {
  return {
    ...defaultRemoteSessionDeps,
    publish: publishReview,
    loadConfig: loadConfigWithProvenance,
    now: () => new Date(),
  };
}

export interface BuildRemoteReviewStateArgs {
  remoteUrl: string;
  forge: RemoteForge;
  baseSha: string;
  headSha: string;
  diffFiles: DiffFile[];
  comments: ReviewComment[];
  timestamp: string;
}

/**
 * Assemble the ReviewState for a fetched remote review. Pure and
 * deterministic: same inputs, same state.
 *
 * Placement rules:
 * - Every diff file gets a file entry in diff order; fetched threads land on
 *   their files, in thread order.
 * - Comments whose path is not in the diff (e.g. outdated anchors on files
 *   no longer touched) get a synthetic entry with change-type "modified" —
 *   the schema requires the attribute and "modified" is the least-claiming
 *   value for a file we cannot classify.
 * - Review-level threads (sentinel {@link REVIEW_LEVEL_FILE_PATH}) are
 *   folded into a single trailing file entry with the sentinel path: the v3
 *   schema requires every <comment> inside a <file path>, and the empty
 *   path can never collide with a real diff path, so consumers detect these
 *   by comparing against the constant. Omitted when there are none.
 * - Every file is viewed="false": fetch-comments reviews nothing, and a
 *   viewed mark claims a human looked at the file. A subsequent
 *   --resume-from session therefore starts with the full file list pending.
 * - `source` is `{ type: 'welcome' }`: the remote-* root attributes are the
 *   review's source shape, and the three shapes (git, directory, remote)
 *   are mutually exclusive by contract, so no local source attributes are
 *   serialized.
 */
export function buildRemoteReviewState(args: BuildRemoteReviewStateArgs): ReviewState {
  const commentsByPath = new Map<string, ReviewComment[]>();
  for (const comment of args.comments) {
    const list = commentsByPath.get(comment.filePath);
    if (list) {
      list.push(comment);
    } else {
      commentsByPath.set(comment.filePath, [comment]);
    }
  }

  const files: FileReviewState[] = [];
  const diffPaths = new Set<string>();
  for (const diffFile of args.diffFiles) {
    const path = diffFile.changeType === 'deleted' ? diffFile.oldPath : diffFile.newPath;
    diffPaths.add(path);
    files.push({
      path,
      changeType: diffFile.changeType,
      viewed: false,
      comments: commentsByPath.get(path) ?? [],
    });
  }

  // Synthetic entries for anchored comments whose file is not in the diff,
  // in first-appearance order.
  for (const [path, comments] of commentsByPath) {
    if (path === REVIEW_LEVEL_FILE_PATH || diffPaths.has(path)) continue;
    files.push({ path, changeType: 'modified', viewed: false, comments });
  }

  const reviewLevel = commentsByPath.get(REVIEW_LEVEL_FILE_PATH);
  if (reviewLevel && reviewLevel.length > 0) {
    files.push({
      path: REVIEW_LEVEL_FILE_PATH,
      changeType: 'modified',
      viewed: false,
      comments: reviewLevel,
    });
  }

  return {
    timestamp: args.timestamp,
    source: { type: 'welcome' },
    files,
    remoteUrl: args.remoteUrl,
    remoteBaseSha: args.baseSha,
    remoteHeadSha: args.headSha,
    remoteForge: args.forge,
  };
}

export interface FetchCommentsOptions extends RemoteLifetimeOptions {
  /** Include threads the forge marks resolved (GitLab). Default false. */
  includeResolved?: boolean;
  /** Working directory for clone detection and output resolution. */
  cwd?: string;
  /** Test seams; every omitted member falls back to the real default. */
  deps?: Partial<FetchCommentsDeps>;
}

/**
 * Run the headless fetch-comments flow end to end. Throws on any failure
 * (the caller prints the message to stderr and exits 1); the temporary
 * clone, when one was created, is removed on both success and failure, and
 * the removal has completed by the time the promise settles.
 *
 * Fetching comments is this subcommand's entire purpose, so the thread
 * fetch runs under the `'required'` policy: a missing or unauthenticated
 * forge CLI is a clear error, not a degraded review. `options.signal`
 * bounds the whole run; see the module comment.
 */
export async function runFetchComments(
  url: string,
  options: FetchCommentsOptions = {}
): Promise<void> {
  const deps: FetchCommentsDeps = { ...defaultDeps(), ...options.deps };
  const cwd = options.cwd ?? process.cwd();
  const lifetime: RemoteLifetimeOptions = { signal: options.signal };

  // startRemoteSession releases what it acquired itself when it fails;
  // from the moment a session exists, this try/finally owns it.
  const session = await startRemoteSession(url, cwd, deps, {
    ...lifetime,
    includeResolved: options.includeResolved ?? false,
    threads: 'required',
  });
  try {
    console.error(`[fetch-comments] Fetched ${session.fetchedThreads.length} threads`);

    // The same effective configuration the app reviews under: the output
    // path and the ignore patterns both come from it.
    const loadedConfig = deps.loadConfig();
    const config = loadedConfig.config;
    const loaded = await loadRemoteReview(session, config.ignore ?? [], deps.loadDiff, lifetime);
    for (const diagnostic of loaded.diagnostics) {
      console.error(`[fetch-comments] Diff diagnostic: ${diagnostic}`);
    }

    const state = buildRemoteReviewState({
      remoteUrl: url,
      forge: session.forgeUrl.forge,
      baseSha: session.remote.remoteBaseSha,
      headSha: session.remote.remoteHeadSha,
      diffFiles: loaded.files,
      comments: loaded.comments,
      timestamp: deps.now().toISOString(),
    });

    // No flag names the output here, so the configuration's provenance
    // decides its trust, exactly as in the app and serve: a reviewer's own
    // user-level output-file is explicit; project configuration or the
    // default is inherited and must stay inside the launch directory.
    const target = resolveOutputTarget(null, loadedConfig, cwd);
    await deps.publish(state, target.path, publishOptionsFor(target));
    console.error(`[fetch-comments] ${loaded.comments.length} threads written to ${target.path}`);
  } finally {
    await session.cleanup();
  }
}
