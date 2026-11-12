import { build } from 'esbuild';
import { expect, it, vi } from 'vitest';
import { bindRouteValidation } from './route-composition';

it('binds supplied validation without substituting the installed engine defaults', () => {
  const validation = {
    parseExpandContextBody: vi.fn(),
    parseSuggestionApplyBody: vi.fn(),
    parseReviewStateBody: vi.fn(),
  };
  expect(bindRouteValidation({ requestValidation: validation })).toBe(validation);
  const override = { ...validation, parseReviewStateBody: vi.fn() };
  expect(bindRouteValidation({ requestValidation: validation }, override)).toBe(override);
  expect(
    bindRouteValidation({}).parseExpandContextBody({ filePath: 'a', contextLines: 0 })
  ).toEqual({
    ok: true,
    value: { filePath: 'a', contextLines: 0 },
  });
});

it('loads the complete route builder without selecting an installed engine or constructing validators', async () => {
  const result = await build({
    entryPoints: ['src/bound-api-routes.ts'],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    packages: 'external',
    metafile: true,
  });
  const loaded = Object.keys(result.metafile.inputs);
  expect(loaded).not.toContain('src/engine-contract.ts');
  expect(loaded).not.toContain('src/validate.ts');
  expect(loaded).not.toContain('src/route-composition.ts');
});
