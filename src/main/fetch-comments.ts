// src/main/fetch-comments.ts
// Headless orchestrator for `self-review fetch-comments <URL>`: materialize
// the PR/MR, fetch and map its discussion threads, and write a v3 review.xml
// with remote provenance — no window, nothing on stdout, all logging on
// stderr. Every collaborator is injectable so the flow is unit-testable; the
// CLI entry in main.ts stays thin.

import { writeFileSync } from 'fs';
import { resolve } from 'path';
import {
  ForgeCliUnavailableError,
  parseForgeUrl,
} from '../../packages/core/src/forge-provider';
import type {
  ForgeCommandRunner,
  ForgeName,
  ForgeProvider,
  ForgeUrl,
} from '../../packages/core/src/forge-provider';
import { createGitHubProvider } from '../../packages/core/src/github-provider';
import { createGitLabProvider } from '../../packages/core/src/gitlab-provider';
import {
  defaultGitRunner,
  detectExistingClone,
  materialize,
  resolveRemoteDefaultBranch,
} from '../../packages/core/src/materializer';
import type {
  ExistingClone,
  MaterializeResult,
} from '../../packages/core/src/materializer';
import {
  mapThreadsToReviewComments,
  REVIEW_LEVEL_FILE_PATH,
} from '../../packages/core/src/thread-mapper';
import { parseDiff } from '../../packages/core/src/diff-parser';
import { runGitDiffAsync } from '../../packages/core/src/git';
import { serializeReview } from '../../packages/core/src/xml-serializer';
import { loadConfig } from '../../packages/core/src/config';
import type {
  AppConfig,
  DiffFile,
  FileReviewState,
  RemoteForge,
  ReviewComment,
  ReviewState,
} from '../shared/types';

/**
 * Injectable seams for the orchestration. Defaults spawn real processes and
 * touch the real filesystem; tests replace them wholesale.
 */
export interface FetchCommentsDeps {
  /** Command runner shared by git, gh and glab invocations. */
  runner: ForgeCommandRunner;
  createProvider: (forge: ForgeName, runner: ForgeCommandRunner) => ForgeProvider;
  materialize: (
    url: ForgeUrl,
    baseBranch: string,
    cwd: string,
    runner: ForgeCommandRunner,
    existingClone?: ExistingClone | null
  ) => Promise<MaterializeResult>;
  detectExistingClone: (
    url: ForgeUrl,
    cwd: string,
    runner: ForgeCommandRunner
  ) => Promise<ExistingClone | null>;
  resolveRemoteDefaultBranch: (
    url: ForgeUrl,
    runner: ForgeCommandRunner,
    existing?: ExistingClone | null
  ) => Promise<string>;
  loadDiffFiles: (
    repoPath: string,
    baseSha: string,
    headSha: string
  ) => Promise<DiffFile[]>;
  serialize: (state: ReviewState, outputPath: string) => Promise<string>;
  writeFile: (path: string, content: string) => void;
  loadConfig: () => AppConfig;
  now: () => Date;
}

function defaultDeps(): FetchCommentsDeps {
  return {
    runner: defaultGitRunner,
    createProvider: (forge, runner) =>
      forge === 'github'
        ? createGitHubProvider(runner)
        : createGitLabProvider(runner),
    detectExistingClone,
    materialize,
    resolveRemoteDefaultBranch,
    loadDiffFiles: async (repoPath, baseSha, headSha) =>
      // Triple-dot: diff from the merge base, matching how forges present a
      // PR/MR diff. Runs inside the materialized clone.
      parseDiff(await runGitDiffAsync([`${baseSha}...${headSha}`], repoPath)),
    serialize: serializeReview,
    writeFile: (path, content) => writeFileSync(path, content, 'utf-8'),
    loadConfig,
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
export function buildRemoteReviewState(
  args: BuildRemoteReviewStateArgs
): ReviewState {
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

export interface FetchCommentsOptions {
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
 * clone, when one was created, is removed on both success and failure.
 */
export async function runFetchComments(
  url: string,
  options: FetchCommentsOptions = {}
): Promise<void> {
  const deps: FetchCommentsDeps = { ...defaultDeps(), ...options.deps };
  const cwd = options.cwd ?? process.cwd();

  const forgeUrl = parseForgeUrl(url);
  if (forgeUrl === null) {
    throw new Error(
      `Not a recognized pull/merge request URL: ${url}\n` +
        'Expected a GitHub PR URL (…/pull/N) or a GitLab MR URL ' +
        '(…/-/merge_requests/N).'
    );
  }

  const provider = deps.createProvider(forgeUrl.forge, deps.runner);

  let baseBranch: string;
  let existingClone: ExistingClone | null | undefined;
  try {
    baseBranch = await provider.fetchBaseBranch(forgeUrl);
  } catch (error) {
    if (!(error instanceof ForgeCliUnavailableError)) throw error;
    console.error(`[fetch-comments] ${error.message}`);
    console.error(
      `[fetch-comments] ${error.cli} unavailable for the base-branch lookup — ` +
        'falling back to the remote default branch via git ls-remote.'
    );
    existingClone = await deps.detectExistingClone(
      forgeUrl,
      cwd,
      deps.runner
    );
    baseBranch = await deps.resolveRemoteDefaultBranch(
      forgeUrl,
      deps.runner,
      existingClone
    );
  }
  console.error(`[fetch-comments] Base branch: ${baseBranch}`);

  const materialized = await deps.materialize(
    forgeUrl,
    baseBranch,
    cwd,
    deps.runner,
    existingClone
  );
  try {
    let threads;
    try {
      threads = await provider.fetchThreads(forgeUrl, {
        includeResolved: options.includeResolved ?? false,
      });
    } catch (error) {
      if (error instanceof ForgeCliUnavailableError) {
        // Fetching comments is this subcommand's entire purpose: no
        // degradation, fail with a clear error.
        throw new Error(
          `Cannot fetch discussion threads: ${error.message}\n` +
            `fetch-comments requires the ${error.cli} CLI to be installed ` +
            'and authenticated.'
        );
      }
      throw error;
    }
    console.error(`[fetch-comments] Fetched ${threads.length} threads`);

    const diffFiles = await deps.loadDiffFiles(
      materialized.repoPath,
      materialized.baseSha,
      materialized.headSha
    );
    const comments = mapThreadsToReviewComments(threads);

    const state = buildRemoteReviewState({
      remoteUrl: url,
      forge: forgeUrl.forge,
      baseSha: materialized.baseSha,
      headSha: materialized.headSha,
      diffFiles,
      comments,
      timestamp: deps.now().toISOString(),
    });

    const config = deps.loadConfig();
    const outputPath = resolve(cwd, config.outputFile);
    const xml = await deps.serialize(state, outputPath);
    deps.writeFile(outputPath, xml + '\n');
    console.error(
      `[fetch-comments] ${comments.length} threads written to ${outputPath}`
    );
  } finally {
    materialized.cleanup();
  }
}
