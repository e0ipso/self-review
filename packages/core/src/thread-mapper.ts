// thread-mapper.ts
// Deterministic mapper from forge-neutral discussion threads to the v3
// ReviewComment model. Pure code: no I/O, no randomness, no timestamps —
// the same input always yields byte-identical output, and it contains no
// forge-conditional logic (anything forge-specific belongs in the
// providers). Fetch direction only.

import type { ForgeThread, ForgeThreadAnchor, ForgeThreadTurn } from './forge-provider';
import type { LineRange, Reply, ReviewComment } from './types';

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
function mapAnchorToLineRange(anchor: ForgeThreadAnchor): LineRange | null {
  if (anchor.outdated) {
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
 *
 * Output order is input order. The input is never mutated.
 */
export function mapThreadsToReviewComments(
  threads: ForgeThread[]
): ReviewComment[] {
  return threads.map((thread) => {
    const comment: ReviewComment = {
      id: internalId(thread.root),
      filePath: thread.anchor?.filePath ?? REVIEW_LEVEL_FILE_PATH,
      lineRange: thread.anchor ? mapAnchorToLineRange(thread.anchor) : null,
      body: thread.root.body,
      category: '',
      suggestion: null,
      author: thread.root.author,
      remoteId: thread.root.remoteId,
    };
    if (thread.replies.length > 0) {
      comment.replies = thread.replies.map(mapReply);
    }
    return comment;
  });
}
