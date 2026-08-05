// gitlab-provider.ts
// ForgeProvider implementation for GitLab (gitlab.com and self-hosted) backed
// by the read-only `glab` CLI. All child-process execution goes through an
// injected ForgeCommandRunner so the provider stays unit-testable and no real
// `glab` calls happen in tests. Only GET-style commands are issued (`glab
// api`); nothing is ever posted.

import {
  ForgeCliUnavailableError,
  type FetchThreadsOptions,
  type ForgeAnchorSide,
  type ForgeCommandRunner,
  type ForgeProvider,
  type ForgeThread,
  type ForgeThreadAnchor,
  type ForgeThreadTurn,
  type ForgeUrl,
} from './forge-provider';

const GLAB_CLI = 'glab';

// --- Minimal shapes of the GitLab API payloads we consume ---------------

interface GitLabLineRangeEdge {
  old_line?: number | null;
  new_line?: number | null;
}

interface GitLabPosition {
  old_path?: string | null;
  new_path?: string | null;
  old_line?: number | null;
  new_line?: number | null;
  line_range?: {
    start?: GitLabLineRangeEdge | null;
    end?: GitLabLineRangeEdge | null;
  } | null;
}

interface GitLabNote {
  id: number | string;
  body?: string;
  author?: { username?: string } | null;
  system?: boolean;
  resolvable?: boolean;
  resolved?: boolean;
  position?: GitLabPosition | null;
}

interface GitLabDiscussion {
  id: string;
  notes?: GitLabNote[];
}

// --- CLI plumbing -------------------------------------------------------

/** URL-encode the full project path; subgroup slashes become %2F. */
function encodeProjectPath(url: ForgeUrl): string {
  return encodeURIComponent(`${url.owner}/${url.repo}`);
}

function unavailable(message: string): ForgeCliUnavailableError {
  return new ForgeCliUnavailableError('gitlab', GLAB_CLI, message);
}

/**
 * Run `glab api <endpoint>` against the URL's host and return raw stdout.
 * Spawn failures (ENOENT) and non-zero exits (unauthenticated, API errors)
 * both surface as {@link ForgeCliUnavailableError}.
 */
async function runGlabApi(
  runCommand: ForgeCommandRunner,
  url: ForgeUrl,
  endpoint: string,
  extraArgs: string[] = []
): Promise<string> {
  const args = ['api', endpoint, '--hostname', url.host, ...extraArgs];
  let result;
  try {
    result = await runCommand(GLAB_CLI, args);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw unavailable(`glab CLI could not be spawned: ${detail}`);
  }
  if (result.exitCode !== 0) {
    const detail = result.stderr.trim() || `exit code ${result.exitCode}`;
    throw unavailable(`glab api ${endpoint} failed: ${detail}`);
  }
  return result.stdout;
}

/**
 * Parse stdout that may contain several concatenated top-level JSON
 * documents, as `glab api --paginate` emits one array per page. A simple
 * bracket/string scanner keeps `][` sequences inside note bodies from
 * breaking the split.
 */
function parseJsonDocuments(text: string): unknown[] {
  const documents: unknown[] = [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === '[' || ch === '{') {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === ']' || ch === '}') {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        documents.push(JSON.parse(text.slice(start, i + 1)));
        start = -1;
      }
    }
  }
  if (depth !== 0 || inString) {
    throw new Error('truncated JSON document');
  }
  return documents;
}

// --- Normalization ------------------------------------------------------

function toTurn(note: GitLabNote): ForgeThreadTurn {
  return {
    remoteId: String(note.id),
    author: note.author?.username ?? 'unknown',
    body: note.body ?? '',
  };
}

/**
 * A discussion counts as resolved when it has at least one resolvable note
 * and every resolvable note is resolved. Discussions with no resolvable
 * notes (non-diff discussions) are never "resolved".
 */
function isDiscussionResolved(notes: GitLabNote[]): boolean {
  const resolvable = notes.filter((note) => note.resolvable === true);
  return resolvable.length > 0 && resolvable.every((note) => note.resolved === true);
}

/**
 * Build the neutral anchor from a GitLab position object, or `null` when the
 * note has no position (non-diff discussion) or the position carries no
 * usable file path.
 *
 * Side selection: `new_line` present → `'new'` (using `new_path`), otherwise
 * `old_line` present → `'old'` (using `old_path`). A position with a path
 * but neither line (e.g. `position_type: "file"`) becomes a file-level
 * anchor with null lines and side `'new'`, per the neutral shape's contract.
 * Multi-line `line_range` edges are read on the side chosen above, falling
 * back to the single-line position when an edge lacks that side's line.
 *
 * GitLab has no per-note outdated flag (positions on older heads stay valid
 * positions), so `outdated` is always `false`; drift detection downstream
 * informs the reviewer instead.
 */
function toAnchor(position: GitLabPosition | null | undefined): ForgeThreadAnchor | null {
  if (!position) return null;

  const side: ForgeAnchorSide =
    typeof position.old_line === 'number' && typeof position.new_line !== 'number'
      ? 'old'
      : 'new';
  const pathForSide = side === 'old' ? position.old_path : position.new_path;
  const filePath = pathForSide ?? position.new_path ?? position.old_path;
  if (!filePath) return null;

  const lineOf = (edge: GitLabLineRangeEdge | null | undefined): number | null => {
    const value = side === 'old' ? edge?.old_line : edge?.new_line;
    return typeof value === 'number' ? value : null;
  };

  const positionLine = lineOf(position);
  const startLine = lineOf(position.line_range?.start) ?? positionLine;
  const endLine = lineOf(position.line_range?.end) ?? positionLine;

  return { filePath, side, startLine, endLine, outdated: false };
}

/**
 * Normalize one GitLab discussion into the forge-neutral thread shape, or
 * `null` when nothing user-authored remains after dropping system notes.
 * The first surviving note roots the thread and owns the anchor; the rest
 * are ordered replies (GitLab document order is preserved verbatim).
 */
function toThread(discussion: GitLabDiscussion): ForgeThread | null {
  const notes = (discussion.notes ?? []).filter((note) => note.system !== true);
  if (notes.length === 0) return null;
  const [rootNote, ...replyNotes] = notes;
  return {
    root: toTurn(rootNote),
    replies: replyNotes.map(toTurn),
    anchor: toAnchor(rootNote.position),
  };
}

// --- Provider -----------------------------------------------------------

/**
 * Create the GitLab {@link ForgeProvider} backed by the `glab` CLI.
 *
 * The URL's host is forwarded via `--hostname`, so self-hosted instances
 * (e.g. git.drupalcode.org) work with zero configuration beyond `glab auth`.
 * Resolved discussions are excluded unless `includeResolved` is set.
 */
export function createGitLabProvider(runCommand: ForgeCommandRunner): ForgeProvider {
  return {
    forge: 'gitlab',

    async fetchBaseBranch(url: ForgeUrl): Promise<string> {
      const endpoint = `projects/${encodeProjectPath(url)}/merge_requests/${url.number}`;
      const stdout = await runGlabApi(runCommand, url, endpoint);
      let mr: unknown;
      try {
        mr = JSON.parse(stdout);
      } catch {
        throw unavailable(`glab api ${endpoint} returned unparseable JSON`);
      }
      const targetBranch = (mr as { target_branch?: unknown })?.target_branch;
      if (typeof targetBranch !== 'string' || targetBranch.length === 0) {
        throw unavailable(`glab api ${endpoint} returned no target_branch`);
      }
      return targetBranch;
    },

    async fetchThreads(url: ForgeUrl, options?: FetchThreadsOptions): Promise<ForgeThread[]> {
      const endpoint = `projects/${encodeProjectPath(url)}/merge_requests/${url.number}/discussions`;
      const stdout = await runGlabApi(runCommand, url, endpoint, ['--paginate']);

      let discussions: GitLabDiscussion[];
      try {
        const pages = parseJsonDocuments(stdout);
        if (pages.length === 0 && stdout.trim() !== '') {
          throw new Error('no JSON documents in output');
        }
        discussions = pages.flatMap((page) =>
          Array.isArray(page) ? (page as GitLabDiscussion[]) : []
        );
      } catch {
        throw unavailable(`glab api ${endpoint} returned unparseable JSON`);
      }

      const includeResolved = options?.includeResolved === true;
      const threads: ForgeThread[] = [];
      for (const discussion of discussions) {
        const notes = discussion.notes ?? [];
        if (!includeResolved && isDiscussionResolved(notes)) continue;
        const thread = toThread(discussion);
        if (thread) threads.push(thread);
      }
      return threads;
    },
  };
}
