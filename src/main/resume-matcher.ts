// src/main/resume-matcher.ts
// Context-aware line matching for --resume-from.
// Relocates ReviewComment objects to their correct positions in the
// current diff using a context-line fingerprint heuristic.

import { ReviewComment, DiffFile, DiffLine } from '../shared/types';
import { normalizeResumePath } from '../shared/path-utils';

const ANCHOR_WINDOW = 3;
const MATCH_THRESHOLD = 0.6;
const MIN_ANCHOR_LINES = 2;

interface FingerprintEntry {
  content: string;
  relOffset: number; // relative to the commented line's position on the stable side
}

/**
 * Relocate resume comments to their correct positions in the current diff.
 * Pure function — no side effects.
 */
export function matchResumeComments(
  comments: ReviewComment[],
  diffFiles: DiffFile[]
): ReviewComment[] {
  return comments.map(comment => relocateComment(comment, diffFiles));
}

function relocateComment(
  comment: ReviewComment,
  diffFiles: DiffFile[]
): ReviewComment {
  // File-level comments pass through unchanged
  if (comment.lineRange === null) {
    return comment;
  }

  // Find the matching DiffFile
  const diffFile = findDiffFile(comment.filePath, diffFiles);
  if (!diffFile) {
    return { ...comment, orphaned: true };
  }

  // Flatten all DiffLines from the file
  const allLines = diffFile.hunks.flatMap(h => h.lines);

  const { side, start, end } = comment.lineRange;
  const spanLength = end - start;

  // For 'new' side comments, use 'old' line numbers as the stable anchor
  // (insertions above change new line numbers but not old line numbers).
  // For 'old' side comments, use 'new' line numbers as the stable anchor
  // (deletions above change old line numbers but not new line numbers).
  // When neither works unambiguously, fall back to content-based search
  // on the same side.
  const stableSide: 'old' | 'new' = side === 'new' ? 'old' : 'new';
  const targetSide = side;

  // Build anchor fingerprint using stable-side line numbers near the stored position
  const fingerprint = buildFingerprint(allLines, start, stableSide);

  if (fingerprint.length < MIN_ANCHOR_LINES) {
    // Fallback: try fingerprinting on the same side
    const sameSideFingerprint = buildFingerprint(allLines, start, side);
    if (sameSideFingerprint.length < MIN_ANCHOR_LINES) {
      return { ...comment, orphaned: true };
    }
    // Same-side fingerprint — no relocation possible, keep original
    return comment;
  }

  // Find the new position of the commented line using the stable side
  const newLineNo = findRelocatedLineNo(
    allLines,
    fingerprint,
    start,
    stableSide,
    targetSide
  );

  if (newLineNo === null) {
    return { ...comment, orphaned: true };
  }

  if (newLineNo === start) {
    return comment;
  }

  // Update LineRange to reflect new position, preserving span
  const maxLineNo = getMaxLineNo(allLines, targetSide);
  const newStart = newLineNo;
  const newEnd = Math.min(newLineNo + spanLength, maxLineNo);

  return {
    ...comment,
    lineRange: {
      side,
      start: newStart,
      end: newEnd,
    },
  };
}

/**
 * Find the DiffFile matching comment.filePath.
 * Checks exact match on newPath/oldPath, then falls back to basename.
 */
function findDiffFile(
  filePath: string,
  diffFiles: DiffFile[]
): DiffFile | undefined {
  // Exact match
  const exact = diffFiles.find(
    f => f.newPath === filePath || f.oldPath === filePath
  );
  if (exact) return exact;

  // Basename fallback
  const commentBase = normalizeResumePath(filePath);
  const candidates = diffFiles.filter(
    f =>
      normalizeResumePath(f.newPath) === commentBase ||
      normalizeResumePath(f.oldPath) === commentBase
  );
  return candidates.length === 1 ? candidates[0] : undefined;
}

/**
 * Return the line number for a DiffLine on the given side.
 */
function getLineNo(line: DiffLine, side: 'old' | 'new'): number | null {
  return side === 'new' ? line.newLineNumber : line.oldLineNumber;
}

/**
 * Build a fingerprint of context lines adjacent to the given position,
 * using line numbers on the specified side.
 */
function buildFingerprint(
  lines: DiffLine[],
  lineNo: number,
  side: 'old' | 'new'
): FingerprintEntry[] {
  const fingerprint: FingerprintEntry[] = [];

  for (const l of lines) {
    if (l.type !== 'context') continue;
    const n = getLineNo(l, side);
    if (n === null) continue;
    const offset = n - lineNo;
    if (offset === 0 || Math.abs(offset) > ANCHOR_WINDOW) continue;
    fingerprint.push({ content: l.content.trim(), relOffset: offset });
  }

  fingerprint.sort((a, b) => a.relOffset - b.relOffset);
  return fingerprint;
}

/**
 * Given a fingerprint built from stableSide line numbers near the stored
 * line number, find the corresponding targetSide line number in the current
 * diff.
 *
 * Strategy: the fingerprint contains content + relOffset pairs. We find
 * the context lines in the current diff that match the fingerprint by
 * content, derive the stableSide anchor position, then look up the
 * targetSide line number for that position.
 */
function findRelocatedLineNo(
  lines: DiffLine[],
  fingerprint: FingerprintEntry[],
  originalLineNo: number,
  stableSide: 'old' | 'new',
  targetSide: 'old' | 'new'
): number | null {
  // Build content → stableSide positions map (context lines only)
  const contextByContent = new Map<string, Array<{ stable: number; target: number | null }>>();
  for (const l of lines) {
    if (l.type !== 'context') continue;
    const stable = getLineNo(l, stableSide);
    if (stable === null) continue;
    const target = getLineNo(l, targetSide);
    const content = l.content.trim();
    if (!contextByContent.has(content)) contextByContent.set(content, []);
    contextByContent.get(content)!.push({ stable, target });
  }

  // For each fingerprint entry, derive candidate stable-side anchor positions
  // A match at stableSide position P with relOffset R → anchor at P - R
  const anchorScores = new Map<number, number>();

  for (const entry of fingerprint) {
    const positions = contextByContent.get(entry.content) ?? [];
    for (const { stable } of positions) {
      const anchor = stable - entry.relOffset;
      if (anchor <= 0) continue;
      anchorScores.set(anchor, (anchorScores.get(anchor) ?? 0) + 1);
    }
  }

  // Find best anchor
  const minMatches = Math.max(
    MIN_ANCHOR_LINES,
    Math.ceil(fingerprint.length * MATCH_THRESHOLD)
  );

  let bestAnchor: number | null = null;
  let bestDistance = Infinity;

  for (const [anchor, count] of anchorScores) {
    if (count < minMatches) continue;
    const distance = Math.abs(anchor - originalLineNo);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestAnchor = anchor;
    }
  }

  if (bestAnchor === null) return null;

  // bestAnchor is the stableSide line number of the commented line.
  // Find the corresponding targetSide line number.
  for (const l of lines) {
    if (l.type !== 'context') continue;
    const stable = getLineNo(l, stableSide);
    if (stable === bestAnchor) {
      return getLineNo(l, targetSide);
    }
  }

  // The anchor line might be an addition/deletion (no stableSide number).
  // In that case, use the anchor itself as the best estimate on the targetSide.
  return bestAnchor;
}

/**
 * Return the maximum line number available on the given side of the diff.
 */
function getMaxLineNo(lines: DiffLine[], side: 'old' | 'new'): number {
  let max = 1;
  for (const l of lines) {
    const n = getLineNo(l, side);
    if (n !== null && n > max) max = n;
  }
  return max;
}
