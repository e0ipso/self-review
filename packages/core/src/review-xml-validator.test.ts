import { expect, it, vi } from 'vitest';
import { serializeReview } from './xml-serializer';
import { validateAgainstSchema } from './review-xml-validator';
import { XSD_SCHEMA } from './review-schema';
import { ReviewXmlError } from './xml-errors';
import type { ReviewState } from './types';

const state: ReviewState = {
  timestamp: '2026-01-01T00:00:00Z',
  source: { type: 'directory', sourcePath: '/virtual' },
  files: [],
};

it('uses the supplied schema effect with the emitted XML and unchanged schema', async () => {
  const validateSchema = vi.fn(() => ({ valid: true }));
  const result = await serializeReview(state, '/virtual/review.xml', { validateSchema });
  expect(validateSchema).toHaveBeenCalledExactlyOnceWith(result.xml, XSD_SCHEMA);
});

it('refuses a returned schema violation with the public typed error', async () => {
  const validateSchema = vi.fn(async () => ({
    valid: false,
    errors: [{ message: 'invalid document', loc: { lineNumber: 2 } }],
  }));
  const reportDiagnostic = vi.fn();
  await expect(
    serializeReview(state, '/virtual/review.xml', { validateSchema, reportDiagnostic })
  ).rejects.toMatchObject({
    constructor: ReviewXmlError,
    code: 'schema-invalid',
    details: ['line 2: invalid document'],
  });
  expect(reportDiagnostic).toHaveBeenCalledWith('XML validation failed:');
});

it.each(['throw', 'reject'] as const)(
  'preserves the infrastructure warning and XML with a %s effect',
  async mode => {
    const validateSchema = vi.fn(() => {
      if (mode === 'throw') throw new Error('validator unavailable');
      return Promise.reject(new Error('validator unavailable'));
    });
    const reportDiagnostic = vi.fn();
    const result = await serializeReview(state, '/virtual/review.xml', {
      validateSchema,
      reportDiagnostic,
    });
    expect(result.xml).toContain('<review xmlns="urn:self-review:v3"');
    expect(validateSchema).toHaveBeenCalledOnce();
    expect(reportDiagnostic).toHaveBeenCalledExactlyOnceWith(
      '[main] XML validation infrastructure failed: validator unavailable - emitting XML without validation'
    );
  }
);

it.each(['throw', 'reject'] as const)(
  'isolates a %s diagnostic while retaining invalid and infrastructure outcomes',
  async mode => {
    const report = vi.fn(() => {
      if (mode === 'throw') throw new Error('diagnostic unavailable');
      return Promise.reject(new Error('diagnostic unavailable'));
    });
    await expect(
      validateAgainstSchema('<review/>', report, () => ({ valid: false, errors: ['invalid'] }))
    ).rejects.toBeInstanceOf(ReviewXmlError);
    await expect(
      validateAgainstSchema('<review/>', report, () => {
        throw new Error('unavailable');
      })
    ).resolves.toBeUndefined();
  }
);

it('defaults to real schema validation when no effect is supplied', async () => {
  await expect(validateAgainstSchema('<wrong/>', () => {})).rejects.toMatchObject({
    constructor: ReviewXmlError,
    code: 'schema-invalid',
  });
  await expect(serializeReview(state, '/virtual/review.xml')).resolves.toHaveProperty('xml');
});
