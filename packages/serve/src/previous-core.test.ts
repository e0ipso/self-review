// Exercise default composition without optional capabilities, as in core 2.0.4.
// Vitest requires explicit undefined entries for missing mock exports; the plain
// objects in optional-core.test.ts also exercise truly absent properties.
// This checks export compatibility, not that version's I/O internals.
import { describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

vi.mock('@self-review/core', async importOriginal => {
  const exports = { ...(await importOriginal<Record<string, unknown>>()) };
  for (const key of [
    'validateReviewState',
    'resolveStartupSourceAsync',
    'decodeSuggestionApplyRequest',
    'MAX_CONTEXT_LINES',
    'applySuggestionForSessionAsync',
    'loadSyntheticFilesAsync',
    'MAX_PUBLICATION_ASSET_BYTES',
    'MAX_REVIEW_ATTACHMENTS',
  ])
    exports[key] = undefined;
  // Historical v2.0.4 guide-loader.ts accepts only these three arguments.
  const loadGuide = exports.loadGuide as typeof import('@self-review/core').loadGuide;
  exports.loadGuide = (output: string, config: Parameters<typeof loadGuide>[1], files: string[]) =>
    loadGuide(output, config, files);
  return exports;
});

import * as core from '@self-review/core';
import { createReviewOperations } from './review-operations';
import { resolveCompatibleStartupSource } from './startup-compatibility';
import { requestContract } from './request-contract-compatibility';
import { validateCompatibleReviewState } from './core-compatibility';
import { createStartupHost } from './startup-composition';
import { reportCoreCompatibility } from './core-capabilities';

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

it('reports absent installed capabilities at the CLI composition edge', () => {
  const report = vi.fn();
  reportCoreCompatibility(report);
  expect(report).toHaveBeenCalledTimes(4);
});

it('keeps configured guides rooted at the host cwd when the peer ignores the fourth argument', async () => {
  const root = fs.mkdtempSync(join(tmpdir(), 'serve-legacy-guide-'));
  try {
    fs.writeFileSync(
      join(root, 'guide.xml'),
      `<guide xmlns="urn:self-review-guide:v1"><group name="Read first"><rationale>Changed logic</rationale><file path="a.txt"><description>Entry</description></file></group></guide>`
    );
    const host = createStartupHost(root, vi.fn());
    const guide = await host.operations.loadGuide(
      join(root, 'review.xml'),
      { guideFile: 'guide.xml' },
      ['a.txt'],
      { cwd: root, reportDiagnostic: host.reportDiagnostic }
    );
    expect(guide?.groups[0].name).toBe('Read first');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
