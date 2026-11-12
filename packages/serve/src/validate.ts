// Request validation for the serve package. Core's handlers assume a caller the
// compiler checked; over HTTP the body is whatever the socket delivered.

import { installedServeEngine, type ServeEngine } from './engine-contract';
import { decodeFileAttachments } from './attachment-codec';

// Compatibility for callers that imported containment from this module.
export { containPath } from './contained-path';
import type { ExpandContextRequest, ReviewState, SuggestionApplyRequest } from '@self-review/core';

/**
 * Reaches git as `-U${contextLines}`, so it must be bounded. Matches
 * `MAX_CONTEXT` in useExpandContext.ts; keep the two in step.
 */
export const MAX_CONTEXT_LINES = installedServeEngine.requestContract.maxContextLines;

export type RequestValidationRole = Pick<ServeEngine, 'requestContract' | 'validateReviewState'> & {
  core: Pick<ServeEngine['core'], 'ReviewXmlError'>;
};

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** The same peer supplies validation, decode policy and its error identity. */
export function createRequestValidation(engine: RequestValidationRole) {
  const { requestContract, validateReviewState: validateCompatibleReviewState } = engine;
  const { ReviewXmlError } = engine.core;
  const maxContextLines = requestContract.maxContextLines;

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  const EXPAND_CONTEXT_KEYS: ReadonlySet<string> = new Set(['filePath', 'contextLines']);

  /**
   * Accepts exactly `{ filePath, contextLines }`. Unknown keys are rejected, not
   * ignored. The route authorizes `filePath` as a reviewed path before git sees it.
   */
  function parseExpandContextBody(body: unknown): ParseResult<ExpandContextRequest> {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return { ok: false, error: 'body must be a JSON object' };
    }
    const record = body as Record<string, unknown>;

    for (const key of Object.keys(record)) {
      if (!EXPAND_CONTEXT_KEYS.has(key)) {
        return { ok: false, error: `unknown field: ${key}` };
      }
    }

    const { filePath, contextLines } = record;
    if (typeof filePath !== 'string') {
      return { ok: false, error: 'filePath must be a string' };
    }
    if (
      typeof contextLines !== 'number' ||
      !Number.isInteger(contextLines) ||
      contextLines < 0 ||
      contextLines > maxContextLines
    ) {
      return {
        ok: false,
        error: `contextLines must be an integer between 0 and ${maxContextLines}`,
      };
    }

    return { ok: true, value: { filePath, contextLines } };
  }

  const APPLY_KEYS: ReadonlySet<string> = new Set(['filePath', 'lineRange', 'suggestion']);
  const LINE_RANGE_KEYS: ReadonlySet<string> = new Set(['side', 'start', 'end']);
  const SUGGESTION_KEYS: ReadonlySet<string> = new Set(['originalCode', 'proposedCode']);

  /**
   * Validate the body of `POST /api/apply-suggestion`.
   *
   * This is the one route that rewrites a file in the reviewed tree, so the shape
   * is checked exactly rather than deferred. Core refuses anything whose anchored
   * lines do not still match `originalCode` byte for byte, but it should never be
   * asked a question this malformed in the first place.
   */
  function parseSuggestionApplyBody(body: unknown): ParseResult<SuggestionApplyRequest> {
    if (!isRecord(body)) {
      return { ok: false, error: 'body must be a JSON object' };
    }
    for (const key of Object.keys(body)) {
      if (!APPLY_KEYS.has(key)) return { ok: false, error: `unknown field: ${key}` };
    }

    const { filePath, lineRange, suggestion } = body;
    if (typeof filePath !== 'string' || filePath === '') {
      return { ok: false, error: 'filePath must be a non-empty string' };
    }

    // A file-level comment has no anchor, and core refuses it. Accept the null so
    // the refusal comes back in core's vocabulary rather than as a 400.
    if (lineRange !== null) {
      if (!isRecord(lineRange)) {
        return { ok: false, error: 'lineRange must be an object or null' };
      }
      for (const key of Object.keys(lineRange)) {
        if (!LINE_RANGE_KEYS.has(key)) {
          return { ok: false, error: `unknown lineRange field: ${key}` };
        }
      }
    }

    if (!isRecord(suggestion)) {
      return { ok: false, error: 'suggestion must be an object' };
    }
    for (const key of Object.keys(suggestion)) {
      if (!SUGGESTION_KEYS.has(key)) {
        return { ok: false, error: `unknown suggestion field: ${key}` };
      }
    }
    for (const key of ['originalCode', 'proposedCode'] as const) {
      if (typeof suggestion[key] !== 'string') {
        return { ok: false, error: `suggestion.${key} must be a string` };
      }
    }

    return requestContract.decode(body);
  }

  const REVIEW_STATE_KEYS: ReadonlySet<string> = new Set(['timestamp', 'source', 'files']);

  /**
   * Accepts exactly `{ timestamp, source, files }`. Remote provenance is never
   * taken from the client; the process injects it after submission.
   *
   * Decode transport-only attachment fields, then validate the complete runtime
   * DTO before it reaches session storage. XSD validation still checks publication.
   */
  function parseReviewStateBody(body: unknown): ParseResult<ReviewState> {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return { ok: false, error: 'body must be a JSON object' };
    }
    const record = body as Record<string, unknown>;

    for (const key of Object.keys(record)) {
      if (!REVIEW_STATE_KEYS.has(key)) {
        return { ok: false, error: `unknown field: ${key}` };
      }
    }

    const { timestamp, source, files } = record;
    if (typeof timestamp !== 'string') {
      return { ok: false, error: 'timestamp must be a string' };
    }
    if (typeof source !== 'object' || source === null || Array.isArray(source)) {
      return { ok: false, error: 'source must be an object' };
    }
    if (!Array.isArray(files)) {
      return { ok: false, error: 'files must be an array' };
    }

    const decoded = decodeFileAttachments(files);
    if (!decoded.ok) {
      return decoded;
    }

    try {
      return {
        ok: true,
        value: validateCompatibleReviewState({ timestamp, source, files: decoded.value }),
      };
    } catch (error) {
      if (!(error instanceof ReviewXmlError)) throw error;
      return { ok: false, error: error.message };
    }
  }

  return { parseExpandContextBody, parseSuggestionApplyBody, parseReviewStateBody };
}
export type RequestValidation = ReturnType<typeof createRequestValidation>;
// Original exports remain default compatibility facades.
const defaults = createRequestValidation(installedServeEngine);
export const parseExpandContextBody = defaults.parseExpandContextBody;
export const parseSuggestionApplyBody = defaults.parseSuggestionApplyBody;
export const parseReviewStateBody = defaults.parseReviewStateBody;
