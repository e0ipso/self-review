import { describe, expect, it } from 'vitest';
import { resolveReviewedMediaPath } from './reviewed-media-path';

describe('review-relative media paths', () => {
  it.each([
    ['pic.png', 'docs/note.md', 'docs/pic.png'],
    ['../images/a.png', 'docs/note.md', 'images/a.png'],
    ['/images/a.png?download=1#preview', 'docs/note.md', 'images/a.png'],
    ['./space%20and%20%C3%A9.png', 'docs/note.md', 'docs/space and é.png'],
    ['pic.png', undefined, 'pic.png'],
    ['%2e%2e/images/a.png', 'docs/note.md', 'images/a.png'],
    ['%252e%252e/pic.png', 'docs/note.md', 'docs/%2e%2e/pic.png'],
    ['question%3Fmark%23.png', undefined, 'question?mark#.png'],
  ])('resolves %s relative to %s', (url, documentPath, expected) => {
    expect(resolveReviewedMediaPath(url!, documentPath)).toBe(expected);
  });
  it.each([
    '../../private.png',
    '/../../private.png',
    '%2e%2e/%2e%2e/private.png',
    '//host/private.png',
    'file:///private.png',
    'https://host/a.png',
    'C:/private.png',
    'data:image/png;base64,AA==',
    'blob:null/a',
    'a%2fb.png',
    '%2fhost/private.png',
    'a%5cb.png',
    'a\\b.png',
    '%00.png',
    '%0a.png',
    'a\nb.png',
    '%zz.png',
    '?query',
    '#fragment',
    '',
  ])('refuses an ambiguous or escaping reference %s', url => {
    expect(resolveReviewedMediaPath(url, 'docs/note.md')).toBeNull();
  });
});
