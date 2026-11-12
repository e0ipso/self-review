import { describe, expect, it } from 'vitest';
import { DEFAULT_SOURCE_BUDGETS, resolveSourceBudgets } from './input-budgets';

describe('source budget boundary', () => {
  it.each([-1, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1])(
    'refuses invalid limits %s',
    value => {
      expect(() => resolveSourceBudgets({ maxTotalBytes: value })).toThrow(
        'maxTotalBytes must be a nonnegative safe integer'
      );
    }
  );
  it('retains defaults and permits a zero budget for refusing all eligible input', () => {
    expect(resolveSourceBudgets({ maxEntries: 0 })).toEqual({
      ...DEFAULT_SOURCE_BUDGETS,
      maxEntries: 0,
    });
  });
});

describe('additive representation budgets', () => {
  it.each([
    'maxFileLines',
    'maxTotalLines',
    'maxDiffFiles',
    'maxDiffHunks',
    'maxDiagnostics',
  ] as const)('validates %s and keeps zero as a real refusal limit', name => {
    expect(() => resolveSourceBudgets({ [name]: -1 })).toThrow(RangeError);
    expect(resolveSourceBudgets({ [name]: 0 })[name]).toBe(0);
    expect(resolveSourceBudgets({ [name]: undefined })[name]).toBe(DEFAULT_SOURCE_BUDGETS[name]);
  });
});
