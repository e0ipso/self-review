// Pure canonical fallback is bundled; the installed core remains the runtime engine.
import * as core from '@self-review/core';
import { decodeSuggestionApplyRequest, MAX_CONTEXT_LINES } from '@self-review/core/validation';

interface RequestContract {
  decodeSuggestionApplyRequest?: typeof decodeSuggestionApplyRequest;
  MAX_CONTEXT_LINES?: number;
}

export function requestContractFor(engine: RequestContract) {
  return {
    decode: engine.decodeSuggestionApplyRequest ?? decodeSuggestionApplyRequest,
    maxContextLines: engine.MAX_CONTEXT_LINES ?? MAX_CONTEXT_LINES,
  };
}
export const requestContract = requestContractFor(core);
