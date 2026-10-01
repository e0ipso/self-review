// packages/core/src/anchor-validation.ts
// Pure, side-effect-free validation of a comment's line anchor.
//
// Every boundary that accepts an anchor it did not create goes through here:
// the resume importer (a document is untrusted input, whatever wrote it) and
// Apply (a request is untrusted input, whatever transport carried it). Both
// need the same answer to the same question — is this a real, usable range? —
// so the rules live in one place and neither side re-derives them.

import type { LineRange } from './types';

export type AnchorSide = 'old' | 'new';

export interface LineAnchor {
  side: AnchorSide;
  start: number;
  end: number;
}

export type AnchorCheck = { ok: true; anchor: LineAnchor } | { ok: false; reason: string };

/**
 * The four raw line fields of a comment, before anyone has decided what they
 * mean. `unknown` on purpose: XML hands over strings, a transport hands over
 * whatever JSON gave it, and an in-memory caller hands over numbers.
 */
export interface AnchorFields {
  oldLineStart?: unknown;
  oldLineEnd?: unknown;
  newLineStart?: unknown;
  newLineEnd?: unknown;
}

/**
 * Validate a line anchor from its four raw fields.
 *
 * Returns `null` when no field is present — a file-level comment, which is a
 * valid shape and not an error. Otherwise returns `{ ok: true, anchor }` for a
 * usable range or `{ ok: false, reason }` naming the first rule it broke:
 *
 * - every present field is a positive safe integer (a decimal digit string is
 *   accepted, because that is what an XML attribute is);
 * - exactly one side is present, and that side is complete (start and end);
 * - start ≤ end;
 * - end ≤ `maxLine` when a bound is given.
 *
 * The reason is a short phrase meant to be embedded in a diagnostic, e.g.
 * `"new-line-end is not a positive integer (abc)"`.
 */
export function validateLineAnchor(fields: AnchorFields, maxLine?: number): AnchorCheck | null {
  const old = sideFields('old', fields.oldLineStart, fields.oldLineEnd);
  const next = sideFields('new', fields.newLineStart, fields.newLineEnd);

  if (!old.present && !next.present) return null;
  if (old.present && next.present) {
    return { ok: false, reason: 'carries both old and new line ranges' };
  }

  const side = old.present ? old : next;
  if (side.start === undefined || side.end === undefined) {
    return { ok: false, reason: `${side.name}-line range is incomplete (start and end required)` };
  }

  const start = toPositiveSafeInteger(side.start);
  if (start === null) {
    return {
      ok: false,
      reason: `${side.name}-line-start is not a positive integer (${describe(side.start)})`,
    };
  }
  const end = toPositiveSafeInteger(side.end);
  if (end === null) {
    return {
      ok: false,
      reason: `${side.name}-line-end is not a positive integer (${describe(side.end)})`,
    };
  }

  return checkRange({ side: side.name, start, end }, maxLine);
}

/**
 * Validate an in-memory `LineRange` with the same rules as
 * {@link validateLineAnchor}. For callers that already hold a typed range
 * (Apply, the UI) and need to know whether it is actually usable: the type
 * says `number`, but `NaN`, `0`, `1.5` and `Infinity` are all numbers.
 */
export function validateLineRange(range: LineRange, maxLine?: number): AnchorCheck {
  const start = toPositiveSafeInteger(range.start);
  if (start === null) {
    return {
      ok: false,
      reason: `${range.side}-line-start is not a positive integer (${describe(range.start)})`,
    };
  }
  const end = toPositiveSafeInteger(range.end);
  if (end === null) {
    return {
      ok: false,
      reason: `${range.side}-line-end is not a positive integer (${describe(range.end)})`,
    };
  }
  return checkRange({ side: range.side, start, end }, maxLine);
}

function checkRange(anchor: LineAnchor, maxLine: number | undefined): AnchorCheck {
  if (anchor.start > anchor.end) {
    return {
      ok: false,
      reason: `${anchor.side}-line range is reversed (${anchor.start} > ${anchor.end})`,
    };
  }
  if (maxLine !== undefined && anchor.end > maxLine) {
    return {
      ok: false,
      reason: `${anchor.side}-line range ends beyond line ${maxLine} (${anchor.end})`,
    };
  }
  return { ok: true, anchor };
}

interface SideFields {
  name: AnchorSide;
  present: boolean;
  start: unknown;
  end: unknown;
}

function sideFields(name: AnchorSide, start: unknown, end: unknown): SideFields {
  const s = isAbsent(start) ? undefined : start;
  const e = isAbsent(end) ? undefined : end;
  return { name, present: s !== undefined || e !== undefined, start: s, end: e };
}

function isAbsent(value: unknown): boolean {
  return value === undefined || value === null;
}

/**
 * Read a positive safe integer out of a number or a decimal digit string.
 * Anything else — `NaN`, `0`, negatives, fractions, `Infinity`, `1e3`,
 * booleans, numbers past `MAX_SAFE_INTEGER` — yields `null`.
 */
function toPositiveSafeInteger(value: unknown): number | null {
  let n: number;
  if (typeof value === 'number') {
    n = value;
  } else if (typeof value === 'string' && /^\d+$/.test(value)) {
    n = Number(value);
  } else {
    return null;
  }
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function describe(value: unknown): string {
  return typeof value === 'string' ? JSON.stringify(value) : String(value);
}
