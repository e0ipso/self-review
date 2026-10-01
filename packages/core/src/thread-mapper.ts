// thread-mapper.ts
// Deterministic mapper from forge-neutral discussion threads to the v3
// ReviewComment model. Pure code: no I/O, no randomness, no timestamps —
// the same input always yields byte-identical output, and it contains no
// forge-conditional logic (anything forge-specific belongs in the
// providers). Fetch direction only.

import type { ForgeThread, ForgeThreadAnchor, ForgeThreadTurn } from './forge-provider';
import type { DiffFile, LineRange, Reply, ReviewComment, Suggestion } from './types';

/**
 * Sentinel `filePath` for review-level threads (threads with no file
 * association at all, e.g. GitLab non-diff discussions).
 *
 * The v3 schema has no review-level comment element — every `<comment>`
 * lives inside a `<file path>` — so the mapper degrades these threads to
 * file-level comments on this sentinel path, the closest legal shape.
 * The empty string can never collide with a repository-relative diff path,
 * so consumers (the fetch-comments orchestrator, the app's remote mode)
 * detect review-level comments by comparing against this constant and
 * decide their placement (e.g. a synthetic review-level file entry).
 */
export const REVIEW_LEVEL_FILE_PATH = '';

/**
 * How an anchor's line numbers relate to the reviewed head (R05).
 *
 * - `'outdated'`: the forge says so (`outdated: true`), or the anchor names a
 *   head (`headSha`) other than the one reviewed. Its line numbers describe
 *   a revision the reviewer is not looking at, so it degrades to file-level
 *   and can never yield a suggestion: the `originalCode` the mapper would
 *   read out of today's diff at those lines is not what the author proposed
 *   to replace.
 * - `'verified'`: the anchor names the reviewed head, or the forge re-anchored
 *   it onto the current head and vouches for it (`outdated: false` with no
 *   `headSha`). Only a verified anchor activates a suggestion.
 * - `'unverified'`: nothing ties the anchor to a revision — it names none and
 *   the forge reports no verdict, or it names one but the caller supplied no
 *   reviewed head to compare with. The line placement is kept (there is no
 *   evidence against it) but no suggestion is activated from it.
 */
type AnchorStatus = 'verified' | 'unverified' | 'outdated';

function classifyAnchor(
  anchor: ForgeThreadAnchor,
  reviewedHeadSha: string | undefined
): AnchorStatus {
  if (anchor.outdated === true) {
    return 'outdated';
  }
  if (anchor.headSha !== undefined) {
    if (reviewedHeadSha === undefined) return 'unverified';
    return anchor.headSha === reviewedHeadSha ? 'verified' : 'outdated';
  }
  return anchor.outdated === false ? 'verified' : 'unverified';
}

/**
 * Map an anchor to the model's line range, honoring the exactly-one-pair
 * rule: the single `LineRange.side` selects which pair the serializer
 * emits (`'new'` → `new-line-*`, `'old'` → `old-line-*`), so a comment can
 * never carry both.
 *
 * Returns `null` (file-level) when the anchor is outdated, has no usable
 * line information, or carries non-positive lines (the XSD requires
 * `xs:positiveInteger`, and the serializer must never receive an
 * unserializable range). Reversed bounds are normalized rather than
 * rejected so a defective provider payload still maps deterministically.
 */
function mapAnchorToLineRange(anchor: ForgeThreadAnchor, status: AnchorStatus): LineRange | null {
  if (status === 'outdated') {
    return null;
  }
  const { startLine, endLine } = anchor;
  if (startLine === null || endLine === null) {
    return null;
  }
  if (startLine < 1 || endLine < 1) {
    return null;
  }
  return {
    side: anchor.side,
    start: Math.min(startLine, endLine),
    end: Math.max(startLine, endLine),
  };
}

/**
 * Internal ids are in-memory render keys the app normally generates
 * randomly on parse. The mapper must be deterministic, so it derives them
 * from the forge-assigned ids instead.
 */
function internalId(turn: ForgeThreadTurn): string {
  return `remote-${turn.remoteId}`;
}

/**
 * Opening line of a fenced code block: up to three spaces of indent, then
 * three or more backticks or tildes, then the info string. A fence indented
 * four spaces or more is an indented code block, not a fence.
 */
const FENCE_OPEN = /^( {0,3})(`{3,}|~{3,})(.*)$/;

/** Drop a single trailing CR so a CRLF body yields LF-terminated lines. */
function stripCr(line: string): string {
  return line.endsWith('\r') ? line.slice(0, -1) : line;
}

/** Remove up to `width` leading spaces, the way CommonMark unindents a fence. */
function stripIndent(line: string, width: number): string {
  let i = 0;
  while (i < width && line[i] === ' ') i++;
  return line.slice(i);
}

/** A closing fence: the same character, at least as long, nothing after it. */
function isClosingFence(line: string, marker: string): boolean {
  const match = FENCE_OPEN.exec(line);
  return (
    match !== null &&
    match[2][0] === marker[0] &&
    match[2].length >= marker.length &&
    match[3].trim() === ''
  );
}

/**
 * Collect the bodies of every top-level ` ```suggestion ` block in a
 * markdown body, in document order.
 *
 * Fences are walked in order so a `suggestion` fence nested inside another
 * code block is never mistaken for a real one. The info string must be the
 * bare word `suggestion`: GitLab's range form (`suggestion:-1+2`) widens the
 * anchor by an amount this mapper cannot verify against the diff, so it is
 * deliberately not recognized and leaves the thread without a suggestion.
 */
function findSuggestionBlocks(body: string): string[] {
  const lines = body.split('\n').map(stripCr);
  const blocks: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const open = FENCE_OPEN.exec(lines[i]);
    if (!open) {
      i++;
      continue;
    }
    const [, indent, marker, info] = open;
    // A backtick fence's info string may not contain a backtick.
    if (marker[0] === '`' && info.includes('`')) {
      i++;
      continue;
    }
    const content: string[] = [];
    let j = i + 1;
    for (; j < lines.length && !isClosingFence(lines[j], marker); j++) {
      content.push(stripIndent(lines[j], indent.length));
    }
    if (info.trim().toLowerCase() === 'suggestion') {
      blocks.push(content.join('\n'));
    }
    // An unclosed fence runs to the end of the body, as GitHub renders it.
    i = j + 1;
  }
  return blocks;
}

/**
 * Read the reviewed lines the anchor points at, straight out of the diff.
 *
 * Returns `null` unless the diff covers the whole range: a partially covered
 * anchor would produce an `originalCode` that matches nothing, and the apply
 * engine's byte-for-byte check would refuse it anyway. Taking the text from
 * the diff rather than from the thread body is what makes the extracted
 * suggestion anchored rather than merely quoted.
 */
function readAnchoredLines(
  diffFiles: DiffFile[],
  filePath: string,
  range: LineRange
): string | null {
  const sidePath = (file: DiffFile) => (range.side === 'old' ? file.oldPath : file.newPath);
  const file =
    diffFiles.find(f => sidePath(f) === filePath) ??
    diffFiles.find(f => f.oldPath === filePath || f.newPath === filePath);
  if (!file) return null;

  const found: string[] = [];
  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      const number = range.side === 'old' ? line.oldLineNumber : line.newLineNumber;
      if (number !== null && number >= range.start && number <= range.end) {
        found.push(line.content);
      }
    }
  }
  return found.length === range.end - range.start + 1 ? found.join('\n') : null;
}

/**
 * Turn a `suggestion` fence in a thread's root body into an anchored
 * {@link Suggestion}, or `null` when there is nothing safe to anchor.
 *
 * `null` covers every uncertain case: no fence, more than one fence (the
 * model holds a single suggestion, and silently keeping the first would drop
 * the rest), a file-level, outdated or merely unverified anchor (see
 * {@link AnchorStatus}), and an anchor the reviewed diff does not cover.
 */
function extractSuggestion(
  body: string,
  filePath: string,
  range: LineRange | null,
  status: AnchorStatus,
  diffFiles: DiffFile[]
): Suggestion | null {
  if (!range || status !== 'verified') return null;
  const blocks = findSuggestionBlocks(body);
  if (blocks.length !== 1) return null;
  const originalCode = readAnchoredLines(diffFiles, filePath, range);
  if (originalCode === null) return null;
  return { originalCode, proposedCode: blocks[0] };
}

function mapReply(turn: ForgeThreadTurn): Reply {
  return {
    id: internalId(turn),
    body: turn.body,
    author: turn.author,
    remoteId: turn.remoteId,
  };
}

/**
 * Convert normalized forge threads into v3 `ReviewComment` threads.
 *
 * - The root turn becomes the root comment and owns the anchor; subsequent
 *   turns become flat replies in document order (nothing sorts them).
 * - Forge usernames land in `author`, forge thread/comment ids in
 *   `remoteId`, markdown bodies pass through verbatim.
 * - Outdated or line-less anchors degrade to file-level comments
 *   (`lineRange: null`); anchor-less threads degrade to file-level
 *   comments on {@link REVIEW_LEVEL_FILE_PATH}. The degradation is
 *   structural, never textual.
 * - Mapped comments carry no category, severity or confidence: forge
 *   threads have none, and absent means below every threshold. The empty
 *   `category` matches how the XML parser represents a missing category.
 * - A root body carrying a single ` ```suggestion ` fence becomes a
 *   `Suggestion` anchored to the thread's line range, with `originalCode`
 *   read out of `diffFiles` at that anchor — but only when the anchor is
 *   verified against the reviewed revision (see {@link AnchorStatus}): an
 *   anchor naming `reviewedHeadSha`, or one the forge vouches for. Without
 *   the reviewed diff there is nothing to anchor against, so the default
 *   leaves every `suggestion: null` exactly as before.
 * - An anchor naming a head other than `reviewedHeadSha` is outdated and
 *   degrades to file-level like a forge-reported one; its body is intact.
 *
 * `reviewedHeadSha` is the head the diff in `diffFiles` was taken against
 * (the materialized PR/MR head). Omitting it leaves every revision-naming
 * anchor unverifiable, which keeps its line placement but activates nothing.
 *
 * Output order is input order. The input is never mutated.
 */
export function mapThreadsToReviewComments(
  threads: ForgeThread[],
  diffFiles: DiffFile[] = [],
  reviewedHeadSha?: string
): ReviewComment[] {
  return threads.map(thread => {
    const filePath = thread.anchor?.filePath ?? REVIEW_LEVEL_FILE_PATH;
    const status = thread.anchor ? classifyAnchor(thread.anchor, reviewedHeadSha) : 'unverified';
    const lineRange = thread.anchor ? mapAnchorToLineRange(thread.anchor, status) : null;
    const comment: ReviewComment = {
      id: internalId(thread.root),
      filePath,
      lineRange,
      body: thread.root.body,
      category: '',
      suggestion: extractSuggestion(thread.root.body, filePath, lineRange, status, diffFiles),
      author: thread.root.author,
      remoteId: thread.root.remoteId,
    };
    if (thread.replies.length > 0) {
      comment.replies = thread.replies.map(mapReply);
    }
    return comment;
  });
}
