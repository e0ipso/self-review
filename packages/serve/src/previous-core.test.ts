// Exercise default composition without optional capabilities, as in core 2.0.4.
// Vitest requires explicit undefined entries for missing mock exports; the plain
// objects in optional-core.test.ts also exercise truly absent properties.
// This checks export compatibility, not that version's I/O internals.
import { describe, expect, it, vi } from 'vitest';

vi.mock('@self-review/core', async importOriginal => {
  const exports = { ...(await importOriginal<Record<string, unknown>>()) };
  for (const key of [
    'validateReviewState',
    'resolveStartupSourceAsync',
    'decodeSuggestionApplyRequest',
    'MAX_CONTEXT_LINES',
    'applySuggestionForSessionAsync',
  ])
    exports[key] = undefined;
  return exports;
});

import * as core from '@self-review/core';
import { createReviewOperations } from './review-operations';
import { resolveCompatibleStartupSource } from './startup-compatibility';
import { requestContract } from './request-contract-compatibility';
import { validateCompatibleReviewState } from './core-compatibility';

const request = {
  filePath: 'a.txt',
  lineRange: null,
  suggestion: { originalCode: 'a', proposedCode: 'b' },
};

describe('default composition with previous core exports', () => {
  it('loads the prior decoder and state-validator fallbacks', () => {
    expect(core.decodeSuggestionApplyRequest).toBeUndefined();
    expect(core.validateReviewState).toBeUndefined();
    expect(requestContract.decode(request)).toEqual({ ok: true, value: request });
    const state = {
      timestamp: '2026-01-01T00:00:00Z',
      source: { type: 'directory', sourcePath: '/review' },
      files: [],
    };
    expect(validateCompatibleReviewState(state)).toEqual(state);
  });

  it('binds the legacy Apply implementation without requiring an unpublished export', async () => {
    expect(
      (core as unknown as Record<string, unknown>).applySuggestionForSessionAsync
    ).toBeUndefined();
    const operations = createReviewOperations(core.createReviewSession(), {
      path: '/review.xml',
      origin: 'explicit',
    });
    await expect(operations.applySuggestionForSession(request)).resolves.toMatchObject({
      status: 'refused',
    });
  });

  it('selects synchronous startup when its asynchronous counterpart is absent', async () => {
    expect(core.resolveStartupSourceAsync).toBeUndefined();
    const source = await resolveCompatibleStartupSource([], process.cwd(), {});
    expect(source.mode).toBe('git');
  });
});
