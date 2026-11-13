// Installed-engine selection occurs once at composition. The 2.0.4 fallbacks
// remain supported; their weaker interruption guarantees are reported by the CLI.
// Remove fallback policies only when the supported Core minimum provides every
// selected capability; preserve the original compatibility entry-point exports.
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
  ReviewXmlError?: typeof ReviewXmlError;
}): ReviewStateValidator {
  if (engine.validateReviewState) return engine.validateReviewState;
  const ErrorType = engine.ReviewXmlError ?? ReviewXmlError;
  return value => validateBundledReviewState(value, ErrorType);
}

function validateBundledReviewState(value: unknown, ErrorType: typeof ReviewXmlError): ReviewState {
  try {
    return validateReviewState(value);
  } catch (error) {
    // The bundled subpath has its own class in published serve. Keep callers'
    // instanceof checks tied to the installed root, in both ESM and CommonJS.
    if (error instanceof BundledXmlError) {
      throw new ErrorType(error.code, error.message, {
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

/** Only capabilities selected here are required. Extra root members retain their
 * inferred types and identity, including the original complete Core namespace. */
export type ServeEngineCapabilities = ApplyEngine &
  StartupEngine &
  RequestContract & {
    ReviewXmlError: typeof core.ReviewXmlError;
    recordResumedAttachments: typeof core.recordResumedAttachments;
    validateReviewState?: ReviewStateValidator;
    adoptResumeDocument?: typeof core.adoptResumeDocument;
    commitLoadedReview?: typeof core.commitLoadedReview;
  } & CoreCapabilityShape;

function selectServeEngine<T extends ServeEngineCapabilities>(engine: T) {
  return {
    core: engine,
    commitLoadedReview:
      typeof engine.commitLoadedReview === 'function' ? engine.commitLoadedReview : undefined,
    compatibilityDiagnostics: coreCompatibilityDiagnostics(engine),
    resolveSource: startupSourceFor(engine),
    applySuggestion: applyFor(engine),
    validateReviewState: reviewStateValidatorFor(engine),
    requestContract: requestContractFor(engine),
    adoptResume: resumeAdopterFor(engine),
  };
}
// The final overload preserves the original ReturnType as well as call-site
// inference. The alias adds no forwarding call or runtime ownership.
export const resolveServeEngine: {
  <T extends ServeEngineCapabilities>(engine: T): ReturnType<typeof selectServeEngine<T>>;
  (engine: typeof core): ReturnType<typeof selectServeEngine<typeof core>>;
} = selectServeEngine;

/** Original complete-root type remains available for existing consumers. */
export type ServeEngine = ReturnType<typeof resolveServeEngine<typeof core>>;
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
