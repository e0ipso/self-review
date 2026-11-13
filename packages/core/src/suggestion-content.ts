// Byte-range suggestion edits. No whole-file decoding or per-line arrays.
import { isUtf8 } from 'node:buffer';
import type { Suggestion } from './types';
import type { ApplyRefusalReason } from './apply-suggestion';
import { isWellFormedUnicode } from './unicode-text';

export interface PreparedSuggestion {
  bytes: Buffer;
  replacedLines: number;
}

export interface ContentRefusal {
  reason: ApplyRefusalReason;
  detail: string;
}

/** The LF belongs to the separator, while a CR belongs to the line being compared. */
function locateAnchor(bytes: Buffer, start: number, end: number) {
  let lineCount = 0;
  let startOffset = -1;
  let endOffset = -1;
  let crlf = true;
  for (let offset = 0; offset < bytes.length; ) {
    lineCount++;
    const newline = bytes.indexOf(10, offset);
    const lineEnd = newline === -1 ? bytes.length : newline;
    if (lineCount === start) startOffset = offset;
    if (lineCount >= start && lineCount <= end) {
      if (lineEnd === offset || bytes[lineEnd - 1] !== 13) crlf = false;
    }
    if (lineCount === end) endOffset = lineEnd;
    offset = newline === -1 ? bytes.length : newline + 1;
  }
  return { lineCount, startOffset, endOffset, crlf };
}

/** One terminator ends the proposal; additional trailing LFs remain actual empty lines. */
function proposalBody(proposed: string): string {
  if (proposed.endsWith('\r\n')) return proposed.slice(0, -2);
  return proposed.endsWith('\n') ? proposed.slice(0, -1) : proposed;
}

export function outputBudgetRefusal(maxBytes: number): ContentRefusal {
  return {
    reason: 'write-failed',
    detail: `The proposed file exceeds the ${maxBytes} byte Apply output limit, so nothing was written.`,
  };
}

export function prepareSuggestionContent(
  bytes: Buffer,
  start: number,
  end: number,
  suggestion: Suggestion,
  maxOutputBytes: number
): PreparedSuggestion | ContentRefusal {
  if (!isUtf8(bytes))
    return { reason: 'file-not-utf8', detail: 'The file is not valid UTF-8 text.' };
  const anchor = locateAnchor(bytes, start, end);
  if (end > anchor.lineCount) {
    return {
      reason: 'anchor-out-of-range',
      detail: `Lines ${start}-${end} are outside this file, which has ${anchor.lineCount} line(s).`,
    };
  }
  const original = bytes.subarray(anchor.startOffset, anchor.endOffset);
  // Check the length before encoding a possibly enormous caller-supplied original.
  if (
    suggestion.originalCode.length > original.length ||
    Buffer.byteLength(suggestion.originalCode) !== original.length ||
    original.toString('utf8') !== suggestion.originalCode
  ) {
    return {
      reason: 'context-mismatch',
      detail: `Lines ${start}-${end} no longer match the code this suggestion was written against.`,
    };
  }

  const hasReplacement = suggestion.proposedCode !== '';
  const body = proposalBody(suggestion.proposedCode);
  if (body.length > maxOutputBytes || Buffer.byteLength(body) > maxOutputBytes)
    return outputBudgetRefusal(maxOutputBytes);
  if (!isWellFormedUnicode(body))
    return {
      reason: 'write-failed',
      detail: 'The proposed code contains an unpaired Unicode surrogate, so nothing was written.',
    };
  const proposed = Buffer.from(body);
  let extraCrs = 0;
  if (hasReplacement && anchor.crlf) {
    for (let i = 0; i <= proposed.length; i++) {
      if ((i === proposed.length || proposed[i] === 10) && (i === 0 || proposed[i - 1] !== 13))
        extraCrs++;
    }
  }
  const hasPrefix = start > 1;
  const hasSuffix = end < anchor.lineCount;
  const hasOutput = hasPrefix || hasReplacement || hasSuffix;
  const trailingLf = bytes.length > 0 && bytes[bytes.length - 1] === 10;
  const logicalEnd = bytes.length - (trailingLf ? 1 : 0);
  // Keep the prefix's separator only when another line follows it.
  const prefixEnd = hasPrefix ? anchor.startOffset - (hasReplacement || hasSuffix ? 0 : 1) : 0;
  const suffixStart = hasSuffix ? anchor.endOffset + 1 : logicalEnd;
  const separator = hasReplacement && hasSuffix ? 1 : 0;
  const finalLf = hasOutput && trailingLf ? 1 : 0;
  const size =
    prefixEnd + proposed.length + extraCrs + separator + (logicalEnd - suffixStart) + finalLf;
  if (size > maxOutputBytes) return outputBudgetRefusal(maxOutputBytes);

  const output = Buffer.allocUnsafe(size);
  let offset = bytes.copy(output, 0, 0, prefixEnd);
  // Copy runs between LFs. This never materializes an array of lines, even for blank-line files.
  for (let from = 0; from < proposed.length; ) {
    const newline = proposed.indexOf(10, from);
    const to = newline === -1 ? proposed.length : newline;
    offset += proposed.copy(output, offset, from, to);
    if (anchor.crlf && hasReplacement && (to === from || proposed[to - 1] !== 13))
      output[offset++] = 13;
    if (newline !== -1) output[offset++] = 10;
    from = newline === -1 ? proposed.length : newline + 1;
  }
  // The final logical line can be empty, including a proposal of exactly one terminator.
  if (
    anchor.crlf &&
    hasReplacement &&
    (proposed.length === 0 || proposed[proposed.length - 1] === 10)
  )
    output[offset++] = 13;
  if (separator) output[offset++] = 10;
  offset += bytes.copy(output, offset, suffixStart, logicalEnd);
  if (finalLf) output[offset++] = 10;
  return { bytes: output, replacedLines: end - start + 1 };
}
