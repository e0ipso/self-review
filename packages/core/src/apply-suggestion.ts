// apply-suggestion.ts
// Writes one anchored suggestion into one working file, or refuses and
// writes nothing. Node-only, Electron-free, and free of process-global
// state: the caller names the destination root, so nothing here ever
// consults `process.cwd()`.
//
// The engine is deliberately narrow. It performs a byte-for-byte context
// check and a literal line replacement — no fuzzy matching, no force flag,
// no staging, no git. Every outcome is reported: a refusal names its reason
// and leaves the file untouched (PRD Section 5.4.8).

import { readFileSync, writeFileSync } from 'fs';
import { isAbsolute, relative, resolve, sep } from 'path';
import type { LineRange, Suggestion } from './types';

/**
 * Why an apply was refused. Every value is a structural fact about the
 * request or the file — never a fragment of the file's contents, so a
 * refusal is safe to surface in the UI and in logs.
 */
export type ApplyRefusalReason =
  /** The suggestion is file-level: there is nothing to replace. */
  | 'no-anchor'
  /**
   * The anchor names deleted lines (`side: 'old'`). Those lines are not in
   * the working file, and the app holds no old→new line mapping, so the
   * target is undefined rather than merely missing.
   */
  | 'old-side-anchor'
  /** `destinationRoot` is relative; resolving it would consult the cwd. */
  | 'destination-not-absolute'
  /** `filePath` resolves outside `destinationRoot`. */
  | 'path-escapes-destination'
  /** No file at the resolved path. */
  | 'file-missing'
  /** The path exists but could not be read (permissions, a directory, …). */
  | 'file-unreadable'
  /**
   * The file is not valid UTF-8. Rewriting it would round-trip its bytes
   * through a lossy decode and corrupt regions outside the anchor.
   */
  | 'file-not-utf8'
  /** The anchor falls outside the file's line count. */
  | 'anchor-out-of-range'
  /** The anchored lines no longer match `suggestion.originalCode`. */
  | 'context-mismatch'
  /** The context matched but the write itself failed. */
  | 'write-failed';

export interface ApplySuggestionRequest {
  /**
   * Absolute path of the directory the reviewed files live in. Always
   * supplied by the caller: a git-mode working tree, a directory-mode root,
   * a reused clone, or the destination the user picked for a temporary-clone
   * review. Never derived here.
   */
  destinationRoot: string;
  /** Path of the file to modify, relative to `destinationRoot`. */
  filePath: string;
  /** The comment's anchor. `null` (file-level) is refused. */
  lineRange: LineRange | null;
  suggestion: Suggestion;
}

export interface ApplySuggestionApplied {
  status: 'applied';
  /** Echoed from the request, so a batch caller can attribute the result. */
  filePath: string;
  absolutePath: string;
  /** How many on-disk lines the proposal replaced. */
  replacedLines: number;
}

export interface ApplySuggestionRefused {
  status: 'refused';
  filePath: string;
  reason: ApplyRefusalReason;
  /** One sentence naming the refusal, safe to show to the reviewer. */
  detail: string;
}

export type ApplySuggestionResult = ApplySuggestionApplied | ApplySuggestionRefused;

function refuse(
  filePath: string,
  reason: ApplyRefusalReason,
  detail: string
): ApplySuggestionRefused {
  return { status: 'refused', filePath, reason, detail };
}

function errorCode(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException | undefined)?.code;
}

/**
 * Split file text into lines, keeping each line's own bytes intact.
 *
 * The split is on `\n` only, so a CRLF file's `\r` stays at the end of the
 * line it terminates. That makes the comparison against `originalCode`
 * byte-exact (the diff parser hands the same `\r` through in `DiffLine`),
 * and it means rejoining preserves mixed line endings exactly as found.
 */
function splitLines(content: string): string[] {
  if (content === '') return [];
  const lines = content.split('\n');
  // A trailing terminator produces an empty final element that is not a line.
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/**
 * True when every line being replaced carries a CRLF terminator. Only then
 * is it unambiguous that a hand-typed LF proposal should be written back as
 * CRLF; a mixed or LF region takes the proposal verbatim.
 */
function isCrlfRegion(anchored: string[]): boolean {
  return anchored.length > 0 && anchored.every(line => line.endsWith('\r'));
}

/**
 * Apply one anchored suggestion to one file under `destinationRoot`.
 *
 * On a byte-for-byte match between the anchored lines and
 * `suggestion.originalCode`, the anchored lines are replaced with
 * `suggestion.proposedCode` and the file is rewritten. Lines outside the
 * anchor keep their exact bytes, including their line terminators, and the
 * file's trailing-newline state is preserved either way. Any other outcome
 * refuses with a reason and writes nothing.
 */
export function applySuggestion(request: ApplySuggestionRequest): ApplySuggestionResult {
  const { destinationRoot, filePath, lineRange, suggestion } = request;

  if (!lineRange) {
    return refuse(
      filePath,
      'no-anchor',
      'This suggestion is file-level, so there are no lines to replace.'
    );
  }
  if (lineRange.side === 'old') {
    return refuse(
      filePath,
      'old-side-anchor',
      'This suggestion is anchored to deleted lines, which are not in the working file.'
    );
  }
  if (!isAbsolute(destinationRoot)) {
    return refuse(
      filePath,
      'destination-not-absolute',
      'The destination directory must be an absolute path.'
    );
  }

  const root = resolve(destinationRoot);
  const absolutePath = resolve(root, filePath);
  const rel = relative(root, absolutePath);
  if (isAbsolute(filePath) || rel === '' || rel === '..' || rel.startsWith(`..${sep}`)) {
    return refuse(
      filePath,
      'path-escapes-destination',
      'The file path resolves outside the destination directory.'
    );
  }

  let buffer: Buffer;
  try {
    buffer = readFileSync(absolutePath);
  } catch (error) {
    const code = errorCode(error);
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      return refuse(filePath, 'file-missing', 'The file is not in the destination directory.');
    }
    return refuse(
      filePath,
      'file-unreadable',
      `The file could not be read (${code ?? 'unknown'}).`
    );
  }

  const content = buffer.toString('utf8');
  if (!Buffer.from(content, 'utf8').equals(buffer)) {
    return refuse(filePath, 'file-not-utf8', 'The file is not valid UTF-8 text.');
  }

  const lines = splitLines(content);
  const { start, end } = lineRange;
  if (start < 1 || end < start || end > lines.length) {
    return refuse(
      filePath,
      'anchor-out-of-range',
      `Lines ${start}-${end} are outside this file, which has ${lines.length} line(s).`
    );
  }

  const anchored = lines.slice(start - 1, end);
  if (anchored.join('\n') !== suggestion.originalCode) {
    return refuse(
      filePath,
      'context-mismatch',
      `Lines ${start}-${end} no longer match the code this suggestion was written against.`
    );
  }

  const proposed = suggestion.proposedCode.split('\n');
  const replacement = isCrlfRegion(anchored)
    ? proposed.map(line => (line.endsWith('\r') ? line : `${line}\r`))
    : proposed;
  const updated = [...lines.slice(0, start - 1), ...replacement, ...lines.slice(end)];
  const output = updated.join('\n') + (content.endsWith('\n') ? '\n' : '');

  try {
    writeFileSync(absolutePath, output, 'utf8');
  } catch (error) {
    return refuse(
      filePath,
      'write-failed',
      `The file could not be written (${errorCode(error) ?? 'unknown'}).`
    );
  }

  return { status: 'applied', filePath, absolutePath, replacedLines: anchored.length };
}
