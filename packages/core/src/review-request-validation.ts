// Transport-neutral request structure. Anchor usability belongs to the engine,
// which returns typed refusals before reading or changing reviewed source.
import type { SuggestionApplyRequest } from './types';
import { isWellFormedUnicode } from './unicode-text';

export const MAX_CONTEXT_LINES = 99_999;
export type RequestDecodeResult<T> = { ok: true; value: T } | { ok: false; error: string };

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Preserves extension fields; each transport decides its own unknown-key policy. */
export function decodeSuggestionApplyRequest(
  value: unknown
): RequestDecodeResult<SuggestionApplyRequest> {
  if (!record(value)) return { ok: false, error: 'body must be a JSON object' };
  if (typeof value.filePath !== 'string') return { ok: false, error: 'filePath must be a string' };
  const range = value.lineRange;
  if (range !== null) {
    if (!record(range)) return { ok: false, error: 'lineRange must be an object or null' };
    if (range.side !== 'old' && range.side !== 'new')
      return { ok: false, error: "lineRange.side must be 'old' or 'new'" };
    for (const key of ['start', 'end'] as const) {
      if (typeof range[key] !== 'number')
        return { ok: false, error: `lineRange.${key} must be a number` };
    }
  }
  if (!record(value.suggestion)) return { ok: false, error: 'suggestion must be an object' };
  for (const key of ['originalCode', 'proposedCode'] as const) {
    if (typeof value.suggestion[key] !== 'string')
      return { ok: false, error: `suggestion.${key} must be a string` };
  }
  if (!isWellFormedUnicode(value.suggestion.proposedCode as string))
    return { ok: false, error: 'suggestion.proposedCode must be well-formed Unicode text' };
  return { ok: true, value: value as unknown as SuggestionApplyRequest };
}
