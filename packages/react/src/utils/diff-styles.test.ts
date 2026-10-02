import { describe, it, expect } from 'vitest';
import { getChangeTypeInfo } from './diff-styles';

describe('getChangeTypeInfo', () => {
  it('gives every change type its own badge label', () => {
    const labels = (['added', 'modified', 'deleted', 'renamed', 'copied'] as const).map(
      type => getChangeTypeInfo(type).label
    );

    expect(labels).toEqual(['A', 'M', 'D', 'R', 'C']);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('styles a copied file rather than falling back to the unknown badge', () => {
    expect(getChangeTypeInfo('copied').className).not.toBe('');
  });
});
