// Installed-engine selection occurs once at composition. The 2.0.4 fallbacks
// remain supported; their weaker interruption guarantees are reported by the CLI.
import * as core from '@self-review/core';
import { ReviewXmlError } from '@self-review/core';
import type {
  GitExecutionOptions,
  ReviewSession,
  SuggestionApplyRequest,
  SuggestionApplyOutcome,
  ReviewState,
} from '@self-review/core';
import {
  validateReviewState,
  ReviewXmlError as BundledXmlError,
  decodeSuggestionApplyRequest,
  MAX_CONTEXT_LINES,
} from '@self-review/core/validation';
import { resumeAdopterFor } from './resume-adoption-compatibility';
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
  const applyAsync = engine.applySuggestionForSessionAsync?.bind(engine);
  const applySync = engine.applySuggestionForSession.bind(engine);
  return async (
    session: ReviewSession,
    request: SuggestionApplyRequest,
    options: ApplyOptions = {}
  ): Promise<SuggestionApplyOutcome> => {
    if (applyAsync) return applyAsync(session, request, options);
    if (options.signal?.aborted) throw options.signal.reason;
    return applySync(session, request);
  };
}
type Source = ReturnType<typeof core.resolveStartupSource>;
interface StartupEngine {
  resolveStartupSource: typeof core.resolveStartupSource;
  resolveStartupSourceAsync?: (
    args: string[],
    cwd?: string,
    options?: GitExecutionOptions
  ) => Promise<Source>;
}
export function startupSourceFor(engine: StartupEngine) {
  const resolveAsync = engine.resolveStartupSourceAsync?.bind(engine);
  const resolveSync = engine.resolveStartupSource.bind(engine);
  return async (args: string[], cwd: string, options: GitExecutionOptions): Promise<Source> => {
    if (options.signal?.aborted) throw options.signal.reason;
    return resolveAsync ? resolveAsync(args, cwd, options) : resolveSync(args, cwd);
  };
}
type ReviewStateValidator = (value: unknown) => ReviewState;

export function reviewStateValidatorFor(engine: {
  validateReviewState?: ReviewStateValidator;
}): ReviewStateValidator {
  return engine.validateReviewState ?? validateBundledReviewState;
}

function validateBundledReviewState(value: unknown): ReviewState {
  try {
    return validateReviewState(value);
  } catch (error) {
    // The bundled subpath has its own class in published serve. Keep callers'
    // instanceof checks tied to the installed root, in both ESM and CommonJS.
    if (error instanceof BundledXmlError) {
      throw new ReviewXmlError(error.code, error.message, {
        details: error.details,
        cause: error.cause,
      });
    }
    throw error;
  }
}

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

/** One explicit service contract for startup, request validation and execution. */
export function resolveServeEngine(engine: typeof core) {
  return {
    core: engine,
    compatibilityDiagnostics: coreCompatibilityDiagnostics(engine),
    resolveSource: startupSourceFor(engine),
    applySuggestion: applyFor(engine),
    validateReviewState: reviewStateValidatorFor(engine),
    requestContract: requestContractFor(engine),
    adoptResume: resumeAdopterFor(engine),
  };
}
export type ServeEngine = ReturnType<typeof resolveServeEngine>;
export const installedServeEngine = resolveServeEngine(core);

export interface CoreCapabilityShape {
  resolveStartupSourceAsync?: unknown;
  applySuggestionForSessionAsync?: unknown;
  loadSyntheticFilesAsync?: unknown;
  MAX_PUBLICATION_ASSET_BYTES?: unknown;
}

export function coreCompatibilityDiagnostics(engine: CoreCapabilityShape): readonly string[] {
  const messages: string[] = [];
  if (typeof engine.resolveStartupSourceAsync !== 'function')
    messages.push(
      '[serve] Installed core uses a synchronous startup probe; it blocks the event loop and cannot be interrupted.'
    );
  if (typeof engine.applySuggestionForSessionAsync !== 'function')
    messages.push(
      '[serve] Installed core uses synchronous Apply; deadlines and shutdown may be delayed during a write. Check the destination after a lost response; never replay automatically.'
    );
  if (typeof engine.loadSyntheticFilesAsync !== 'function')
    messages.push(
      '[serve] Installed core local loading does not support the startup signal; cancellation may wait for filesystem work.'
    );
  if (typeof engine.MAX_PUBLICATION_ASSET_BYTES !== 'number')
    messages.push(
      '[serve] Installed core publication lacks the aggregate asset budget and cooperative staging cancellation. The HTTP body limit does not bound resumed assets read from disk.'
    );
  return messages;
}
