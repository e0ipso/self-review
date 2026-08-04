// github-provider.ts
// GitHub implementation of the ForgeProvider interface, backed entirely by
// the `gh` CLI through an injectable command runner (never the network
// directly). Read-only: only `gh pr view` and `gh api` GET calls.
//
// GitHub Enterprise-style hosts are honored by passing the URL's host (which
// may include a port) verbatim to gh: as the HOST/OWNER/REPO form for
// `pr view --repo` and as `--hostname` for `gh api`. gh's own host handling
// takes it from there (auth per host, API base URL).

import {
  ForgeCliUnavailableError,
  type FetchThreadsOptions,
  type ForgeCommandResult,
  type ForgeCommandRunner,
  type ForgeProvider,
  type ForgeThread,
  type ForgeThreadAnchor,
  type ForgeUrl,
} from './forge-provider';

/** Relevant subset of a GitHub REST pull-request review comment. */
interface GitHubReviewComment {
  id: number;
  in_reply_to_id?: number | null;
  /** `null` for deleted user accounts. */
  user: { login: string } | null;
  body: string;
  path: string;
  side?: 'LEFT' | 'RIGHT' | null;
  line: number | null;
  start_line?: number | null;
  original_line?: number | null;
  original_start_line?: number | null;
}

const GH_CLI = 'gh';

/**
 * Run a gh command, translating both failure modes into the typed
 * unavailable error: a runner rejection means the CLI could not be spawned
 * (e.g. ENOENT when gh is absent), a non-zero exit means gh ran but failed
 * (unauthenticated, API error). Callers degrade on this error, never crash.
 */
async function runGh(
  runCommand: ForgeCommandRunner,
  args: string[]
): Promise<string> {
  let result: ForgeCommandResult;
  try {
    result = await runCommand(GH_CLI, args);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new ForgeCliUnavailableError(
      'github',
      GH_CLI,
      `Failed to run the gh CLI: ${detail}`
    );
  }
  if (result.exitCode !== 0) {
    const detail = result.stderr.trim() || `exit code ${result.exitCode}`;
    throw new ForgeCliUnavailableError(
      'github',
      GH_CLI,
      `gh exited with code ${result.exitCode}: ${detail}`
    );
  }
  return result.stdout;
}

/**
 * Parse gh JSON output, surfacing malformed output as the typed unavailable
 * error so callers keep a single degradation path.
 */
function parseGhJson(stdout: string, context: string): unknown {
  try {
    return JSON.parse(stdout);
  } catch {
    throw new ForgeCliUnavailableError(
      'github',
      GH_CLI,
      `gh returned unparseable JSON for ${context}`
    );
  }
}

/**
 * Normalize one review comment's anchor. GitHub reports `line: null` when
 * the comment no longer applies to the head diff (outdated); the
 * `original_*` fields then retain the historic anchor.
 */
function toAnchor(comment: GitHubReviewComment): ForgeThreadAnchor {
  const outdated = comment.line === null || comment.line === undefined;
  const endLine = outdated ? (comment.original_line ?? null) : comment.line;
  const startLine = outdated
    ? (comment.original_start_line ?? comment.original_line ?? null)
    : (comment.start_line ?? comment.line);
  const hasLines = startLine !== null && endLine !== null;
  return {
    filePath: comment.path,
    // Side is meaningless without usable lines; the contract says 'new'.
    side: hasLines && comment.side === 'LEFT' ? 'old' : 'new',
    startLine: hasLines ? startLine : null,
    endLine: hasLines ? endLine : null,
    outdated,
  };
}

/** GitHub shows deleted user accounts as "ghost"; mirror that. */
function toTurn(comment: GitHubReviewComment) {
  return {
    remoteId: String(comment.id),
    author: comment.user?.login ?? 'ghost',
    body: comment.body,
  };
}

/**
 * Group flat review comments into threads. A comment without
 * `in_reply_to_id` roots a thread; a reply attaches to the thread containing
 * the comment it replies to (root or any member). An orphan reply whose
 * parent is unknown degrades to a thread root of its own. Document order is
 * preserved throughout — nothing sorts.
 */
function groupIntoThreads(comments: GitHubReviewComment[]): ForgeThread[] {
  const threads: ForgeThread[] = [];
  const threadByCommentId = new Map<number, ForgeThread>();
  for (const comment of comments) {
    const parentThread =
      comment.in_reply_to_id === null || comment.in_reply_to_id === undefined
        ? undefined
        : threadByCommentId.get(comment.in_reply_to_id);
    if (parentThread) {
      parentThread.replies.push(toTurn(comment));
      threadByCommentId.set(comment.id, parentThread);
    } else {
      const thread: ForgeThread = {
        root: toTurn(comment),
        replies: [],
        anchor: toAnchor(comment),
      };
      threads.push(thread);
      threadByCommentId.set(comment.id, thread);
    }
  }
  return threads;
}

/**
 * Create the GitHub {@link ForgeProvider} backed by an injected command
 * runner, mirroring how `git.ts` keeps child-process execution testable.
 */
export function createGitHubProvider(
  runCommand: ForgeCommandRunner
): ForgeProvider {
  return {
    forge: 'github',

    async fetchBaseBranch(url: ForgeUrl): Promise<string> {
      const stdout = await runGh(runCommand, [
        'pr',
        'view',
        String(url.number),
        '--repo',
        `${url.host}/${url.owner}/${url.repo}`,
        '--json',
        'baseRefName',
      ]);
      const parsed = parseGhJson(stdout, 'pr view') as {
        baseRefName?: unknown;
      };
      if (typeof parsed?.baseRefName !== 'string' || parsed.baseRefName === '') {
        throw new ForgeCliUnavailableError(
          'github',
          GH_CLI,
          'gh pr view returned no baseRefName'
        );
      }
      return parsed.baseRefName;
    },

    // The REST review-comment list carries no resolution state, so
    // `options.includeResolved` is deliberately ignored: GitHub fetch
    // returns all review threads (resolved-state filtering is a GitLab
    // concern).
    async fetchThreads(
      url: ForgeUrl,
      _options?: FetchThreadsOptions
    ): Promise<ForgeThread[]> {
      const stdout = await runGh(runCommand, [
        'api',
        `repos/${url.owner}/${url.repo}/pulls/${url.number}/comments`,
        '--hostname',
        url.host,
        '--paginate',
        '--slurp',
      ]);
      // `--paginate --slurp` wraps each response page in an outer array:
      // [[...page1], [...page2]]. Flatten one level to the comment list.
      const pages = parseGhJson(stdout, 'pull request comments');
      if (!Array.isArray(pages)) {
        throw new ForgeCliUnavailableError(
          'github',
          GH_CLI,
          'gh api returned an unexpected payload shape for pull request comments'
        );
      }
      const comments = pages.flat(1) as GitHubReviewComment[];
      return groupIntoThreads(comments);
    },
  };
}
