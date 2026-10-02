// Line-anchor validation shared by the resume importer and Apply, both untrusted input.

import type { LineRange } from './types';

export type AnchorSide = 'old' | 'new';

export interface LineAnchor {
  side: AnchorSide;
  start: number;
  end: number;
}

export type AnchorCheck = { ok: true; anchor: LineAnchor } | { ok: false; reason: string };

/** The four raw line fields; `unknown` because XML gives strings and JSON gives anything. */
export interface AnchorFields {
  oldLineStart?: unknown;
  oldLineEnd?: unknown;
  newLineStart?: unknown;
  newLineEnd?: unknown;
}

/**
 * Returns `null` when no field is present (a file-level comment), else the first
 * rule broken: positive safe integers (digit strings accepted), exactly one
 * complete side, start <= end, end <= `maxLine`. `reason` is embedded in diagnostics.
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
 * Same rules as {@link validateLineAnchor} for a typed range; `NaN`, `0`, `1.5` and `Infinity` are
 * still numbers.
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
 * A positive safe integer from a number or decimal digit string; anything else (`1e3`, `NaN`,
 * booleans) is `null`.
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
