import { describe, it, expect } from 'vitest';
import { searchEmojis, resolveShortcode } from './emoji-data';

describe('searchEmojis', () => {
  it('returns matching emojis for a valid prefix', () => {
    const results = searchEmojis('rock');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('native');
    expect(results[0]).toHaveProperty('id');
    expect(results[0]).toHaveProperty('name');
  });

  it('returns empty array for nonsense query', () => {
    expect(searchEmojis('xyzzynotanemoji')).toEqual([]);
  });

  it('returns at most 8 results', () => {
    const results = searchEmojis('sm');
    expect(results.length).toBeLessThanOrEqual(8);
  });

  it('returns empty array for empty query', () => {
    expect(searchEmojis('')).toEqual([]);
  });
});

describe('resolveShortcode', () => {
  it('resolves known shortcode to Unicode emoji', () => {
    expect(resolveShortcode('rocket')).toBe('🚀');
  });

  it('resolves another known shortcode', () => {
    expect(resolveShortcode('heart')).toBe('❤️');
  });

  it('returns null for unknown shortcode', () => {
    expect(resolveShortcode('not_a_real_emoji_xyz')).toBeNull();
  });
});
