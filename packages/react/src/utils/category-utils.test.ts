import { describe, it, expect } from 'vitest';
import type { CategoryDef } from '@self-review/types';
import { isUsableCategory, getUsableCategories, hasUsableCategory } from './category-utils';

const usable: CategoryDef = { name: 'bug', description: 'd', color: '#fff' };
const blank: CategoryDef = { name: '', description: 'd', color: '#fff' };
const whitespace: CategoryDef = { name: '   ', description: 'd', color: '#fff' };

describe('isUsableCategory', () => {
  it('is true for a non-blank name', () => {
    expect(isUsableCategory(usable)).toBe(true);
  });

  it('is false for an empty name', () => {
    expect(isUsableCategory(blank)).toBe(false);
  });

  it('is false for a whitespace-only name', () => {
    expect(isUsableCategory(whitespace)).toBe(false);
  });

  it('is false for a shaped-wrong entry a plain-JS caller could still pass', () => {
    expect(isUsableCategory({ name: 42 } as unknown as CategoryDef)).toBe(false);
    expect(isUsableCategory(null as unknown as CategoryDef)).toBe(false);
    expect(isUsableCategory(undefined as unknown as CategoryDef)).toBe(false);
  });
});

describe('getUsableCategories', () => {
  it('drops blank-name entries and keeps the rest in order', () => {
    expect(getUsableCategories([blank, usable, whitespace])).toEqual([usable]);
  });

  it('returns an empty array for undefined input', () => {
    expect(getUsableCategories(undefined)).toEqual([]);
  });

  it('returns an empty array when every entry is blank-name', () => {
    expect(getUsableCategories([blank, whitespace])).toEqual([]);
  });
});

describe('hasUsableCategory', () => {
  it('is false for an empty list', () => {
    expect(hasUsableCategory([])).toBe(false);
  });

  it('is false when every entry is blank-name', () => {
    expect(hasUsableCategory([blank, whitespace])).toBe(false);
  });

  it('is true when at least one entry is usable', () => {
    expect(hasUsableCategory([blank, usable])).toBe(true);
  });

  it('is false for undefined input', () => {
    expect(hasUsableCategory(undefined)).toBe(false);
  });
});
