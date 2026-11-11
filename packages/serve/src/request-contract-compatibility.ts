// Compatibility for @self-review/core 2.0.4, without structural request decoding.
// Remove the fallback when serve's published minimum core exports the decoder
// and MAX_CONTEXT_LINES. HTTP keeps its own unknown-field policy.
import * as core from '@self-review/core';
import type { SuggestionApplyRequest } from '@self-review/core';

type Result = { ok: true; value: SuggestionApplyRequest } | { ok: false; error: string };
type Decoder = (value: unknown) => Result;
interface RequestContract {
  decodeSuggestionApplyRequest?: Decoder;
  MAX_CONTEXT_LINES?: number;
}

export function requestContractFor(engine: RequestContract) {
  return {
    decode: engine.decodeSuggestionApplyRequest ?? decodeLegacyRequest,
    maxContextLines: engine.MAX_CONTEXT_LINES ?? 99_999,
  };
}
export const requestContract = requestContractFor(core);

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function decodeLegacyRequest(value: unknown): Result {
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
  return { ok: true, value: value as unknown as SuggestionApplyRequest };
}
