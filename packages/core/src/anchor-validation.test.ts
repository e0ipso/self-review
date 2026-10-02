import { describe, it, expect } from 'vitest';
import { validateLineAnchor, validateLineRange } from './anchor-validation';

describe('validateLineAnchor', () => {
  it('returns null for a file-level comment (no line fields at all)', () => {
    expect(validateLineAnchor({})).toBeNull();
    expect(validateLineAnchor({ oldLineStart: undefined, newLineEnd: null })).toBeNull();
  });

  it.each([
    ['new side, numbers', { newLineStart: 3, newLineEnd: 7 }, { side: 'new', start: 3, end: 7 }],
    ['old side, numbers', { oldLineStart: 1, oldLineEnd: 1 }, { side: 'old', start: 1, end: 1 }],
    [
      'decimal strings, as read off XML attributes',
      { newLineStart: '12', newLineEnd: '40' },
      { side: 'new', start: 12, end: 40 },
    ],
    [
      'leading zeros are still the same integer',
      { oldLineStart: '007', oldLineEnd: '009' },
      { side: 'old', start: 7, end: 9 },
    ],
  ])('accepts %s', (_name, fields, anchor) => {
    expect(validateLineAnchor(fields)).toEqual({ ok: true, anchor });
  });

  it.each([
    ['NaN', { newLineStart: Number.NaN, newLineEnd: 2 }, /not a positive integer/],
    ['non-numeric text', { newLineStart: 'abc', newLineEnd: '2' }, /not a positive integer/],
    ['zero', { newLineStart: 0, newLineEnd: 2 }, /not a positive integer/],
    ['negative', { oldLineStart: '-3', oldLineEnd: '2' }, /not a positive integer/],
    ['fractional', { newLineStart: 1.5, newLineEnd: 2 }, /not a positive integer/],
    ['exponent form', { newLineStart: '1e3', newLineEnd: '2000' }, /not a positive integer/],
    [
      'infinity',
      { newLineStart: 1, newLineEnd: Number.POSITIVE_INFINITY },
      /not a positive integer/,
    ],
    ['beyond the safe range', { newLineStart: 1, newLineEnd: 2 ** 53 }, /not a positive integer/],
    ['reversed', { newLineStart: 9, newLineEnd: 4 }, /reversed/],
    [
      'both sides',
      { oldLineStart: 1, oldLineEnd: 2, newLineStart: 1, newLineEnd: 2 },
      /both old and new/,
    ],
    ['half a side (start only)', { newLineStart: 4 }, /incomplete/],
    ['half a side (end only)', { oldLineEnd: 4 }, /incomplete/],
    ['boolean', { newLineStart: true, newLineEnd: 2 }, /not a positive integer/],
  ])('rejects %s', (_name, fields, reason) => {
    const result = validateLineAnchor(fields);
    expect(result).not.toBeNull();
    expect(result!.ok).toBe(false);
    if (!result!.ok) expect(result!.reason).toMatch(reason);
  });

  it('enforces an optional upper bound against the end line', () => {
    expect(validateLineAnchor({ newLineStart: 2, newLineEnd: 5 }, 5)).toEqual({
      ok: true,
      anchor: { side: 'new', start: 2, end: 5 },
    });
    const result = validateLineAnchor({ newLineStart: 2, newLineEnd: 6 }, 5);
    expect(result).toMatchObject({ ok: false });
    if (result && !result.ok) expect(result.reason).toMatch(/beyond line 5/);
  });
});

describe('validateLineRange', () => {
  it('checks an in-memory LineRange with the same rules', () => {
    expect(validateLineRange({ side: 'old', start: 2, end: 3 })).toEqual({
      ok: true,
      anchor: { side: 'old', start: 2, end: 3 },
    });
    expect(validateLineRange({ side: 'new', start: Number.NaN, end: 3 })).toMatchObject({
      ok: false,
    });
    expect(validateLineRange({ side: 'new', start: 5, end: 3 })).toMatchObject({ ok: false });
    expect(validateLineRange({ side: 'new', start: 1, end: 30 }, 10)).toMatchObject({
      ok: false,
    });
  });
});
