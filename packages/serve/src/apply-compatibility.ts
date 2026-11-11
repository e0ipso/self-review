// Compatibility for @self-review/core 2.0.4, whose Apply operation is synchronous.
// Remove the synchronous fallback when the published minimum core provides
// applySuggestionForSessionAsync. Namespace lookup keeps older ESM cores loadable.
import * as core from '@self-review/core';
import type {
  ReviewSession,
  SuggestionApplyRequest,
  SuggestionApplyOutcome,
} from '@self-review/core';

export interface ApplyOptions {
  signal?: AbortSignal;
}
interface ApplyEngine {
  applySuggestionForSession(
    session: ReviewSession,
    request: SuggestionApplyRequest
  ): SuggestionApplyOutcome;
  applySuggestionForSessionAsync?: (
    session: ReviewSession,
    request: SuggestionApplyRequest,
    options?: ApplyOptions
  ) => Promise<SuggestionApplyOutcome>;
}

/** The legacy path blocks the event loop; it cannot interrupt an in-progress write. */
export function applyFor(engine: ApplyEngine) {
  return async (
    session: ReviewSession,
    request: SuggestionApplyRequest,
    options: ApplyOptions = {}
  ): Promise<SuggestionApplyOutcome> => {
    if (engine.applySuggestionForSessionAsync)
      return engine.applySuggestionForSessionAsync(session, request, options);
    if (options.signal?.aborted) throw options.signal.reason;
    return engine.applySuggestionForSession(session, request);
  };
}
export const applyCompatibleSuggestion = applyFor(core);
