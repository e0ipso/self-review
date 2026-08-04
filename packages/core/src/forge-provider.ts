// forge-provider.ts
// Conversation-plane forge abstraction: URL parsing with forge detection by
// path shape, the ForgeProvider interface (base-branch lookup + thread fetch),
// and the forge-neutral normalized thread types produced by every provider.
//
// This module is pure code: no I/O, no child processes. Provider
// implementations (github-provider.ts, gitlab-provider.ts) do the CLI work
// through an injectable command runner so they stay unit-testable.

/** Forges the app knows how to talk to. */
export type ForgeName = 'github' | 'gitlab';

/**
 * A parsed pull-request / merge-request web URL.
 *
 * Detection is by URL path shape only (`/pull/N` → GitHub,
 * `/-/merge_requests/N` → GitLab) on any host, so self-hosted instances such
 * as git.drupalcode.org work with zero configuration.
 */
export interface ForgeUrl {
  forge: ForgeName;
  /** Host as it appears in the URL, including a port when present. */
  host: string;
  /**
   * Repository owner. For GitLab this is the full namespace path and may
   * contain slashes (subgroups, e.g. `group/subgroup`); for GitHub it is a
   * single segment.
   */
  owner: string;
  /** Repository name (final path segment before the PR/MR marker). */
  repo: string;
  /** Pull-request number / merge-request IID. */
  number: number;
}

/** Which side of the diff a thread anchor points at. */
export type ForgeAnchorSide = 'old' | 'new';

/**
 * Forge-neutral anchor of a discussion thread onto the diff.
 *
 * The mapper consumes this shape without forge-conditional logic:
 * - `startLine`/`endLine` are equal for single-line anchors.
 * - `startLine`/`endLine` are `null` when the forge supplies a file path but
 *   no usable line information (the mapper degrades to a file-level comment;
 *   `side` is meaningless in that case and providers should set `'new'`).
 * - `outdated: true` means the forge reports the anchor no longer applies to
 *   the current head (e.g. GitHub outdated review comments); the line fields
 *   then hold the historic anchor and the mapper degrades to file-level.
 */
export interface ForgeThreadAnchor {
  filePath: string;
  side: ForgeAnchorSide;
  startLine: number | null;
  endLine: number | null;
  outdated: boolean;
}

/** One turn (root comment or reply) in a forge discussion thread. */
export interface ForgeThreadTurn {
  /** Forge-assigned comment/note ID, kept as a string verbatim. */
  remoteId: string;
  /** Forge username of the turn's author. */
  author: string;
  /** Markdown body, passed through verbatim. */
  body: string;
}

/**
 * A normalized discussion thread: an ordered root + flat replies.
 *
 * The root turn owns the anchor. `anchor` is `null` for threads with no file
 * association at all (e.g. GitLab non-diff discussions); the mapper turns
 * those into its review-level representation. `replies` preserve the forge's
 * document order — nothing else sorts them.
 */
export interface ForgeThread {
  root: ForgeThreadTurn;
  replies: ForgeThreadTurn[];
  anchor: ForgeThreadAnchor | null;
}

/** Options for {@link ForgeProvider.fetchThreads}. */
export interface FetchThreadsOptions {
  /**
   * Include threads the forge marks resolved. Defaults to false where the
   * forge tracks resolution (GitLab); providers without a comparable concept
   * on the fetch path (GitHub REST review comments) may ignore it.
   */
  includeResolved?: boolean;
}

/**
 * Result of running a forge CLI command through {@link ForgeCommandRunner}.
 */
export interface ForgeCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Injectable command runner used by provider implementations, mirroring how
 * `git.ts` keeps child-process execution testable. Resolves with the exit
 * code on any completed run (including non-zero); rejects only when the
 * binary cannot be spawned at all (e.g. ENOENT when the CLI is absent).
 */
export type ForgeCommandRunner = (
  command: string,
  args: string[]
) => Promise<ForgeCommandResult>;

/**
 * The conversation plane of a forge. Exactly two capabilities: base-branch
 * lookup and discussion-thread fetching. No diff fetching, no blob fetching,
 * no posting — those concerns live elsewhere.
 *
 * Implementations throw {@link ForgeCliUnavailableError} when their CLI is
 * absent or unauthenticated so callers can degrade cleanly.
 */
export interface ForgeProvider {
  readonly forge: ForgeName;
  /** Resolve the PR/MR base (target) branch name. */
  fetchBaseBranch(url: ForgeUrl): Promise<string>;
  /** Fetch the PR/MR discussion threads in normalized form. */
  fetchThreads(
    url: ForgeUrl,
    options?: FetchThreadsOptions
  ): Promise<ForgeThread[]>;
}

/**
 * Thrown by providers when their CLI is missing (spawn ENOENT) or exits
 * non-zero due to authentication/API failure. Callers catch this to degrade
 * (print to stderr, continue without threads) instead of crashing.
 */
export class ForgeCliUnavailableError extends Error {
  readonly forge: ForgeName;
  readonly cli: string;

  constructor(forge: ForgeName, cli: string, message: string) {
    super(message);
    this.name = 'ForgeCliUnavailableError';
    this.forge = forge;
    this.cli = cli;
  }
}

// Path-shape matchers. The number must terminate its path segment so
// `/pull/12x` does not parse as PR 12; anything after the number segment
// (trailing slash, sub-pages like /files) still identifies the same PR/MR.
// Numbered groups (owner, repo, number in order): the app tsconfig targets
// ES6, which predates named capture groups.
const GITHUB_PR_PATH = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)(?=\/|$)/;
const GITLAB_MR_PATH = /^\/(.+)\/([^/]+)\/-\/merge_requests\/(\d+)(?=\/|$)/;

/**
 * Parse a forge web URL into a {@link ForgeUrl}, or return `null` for
 * anything that is not a PR/MR URL. Detection is by path shape only, on any
 * http(s) host. Query strings and fragments are ignored.
 */
export function parseForgeUrl(url: string): ForgeUrl | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }

  // GitLab first: `/-/merge_requests/` is the more specific marker.
  const gitlab = GITLAB_MR_PATH.exec(parsed.pathname);
  if (gitlab) {
    return {
      forge: 'gitlab',
      host: parsed.host,
      owner: gitlab[1],
      repo: gitlab[2],
      number: Number.parseInt(gitlab[3], 10),
    };
  }

  const github = GITHUB_PR_PATH.exec(parsed.pathname);
  if (github) {
    return {
      forge: 'github',
      host: parsed.host,
      owner: github[1],
      repo: github[2],
      number: Number.parseInt(github[3], 10),
    };
  }

  return null;
}
