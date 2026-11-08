import { describe, it, expect } from 'vitest';
import {
  buildFrontMatterDisplay,
  FRONT_MATTER_MAX_DEPTH,
  FRONT_MATTER_MAX_NODES,
  parseFrontMatter,
} from './front-matter';

describe('parseFrontMatter', () => {
  it('parses valid front matter with scalar values', () => {
    const content = `---
title: Hello World
date: 2024-01-15
draft: false
count: 42
---
# Hello World

Some content here.`;

    const result = parseFrontMatter(content);
    expect(result).not.toBeNull();
    expect(result!.metadata).toEqual({
      title: 'Hello World',
      date: '2024-01-15',
      draft: false,
      count: 42,
    });
    expect(result!.body).toBe('# Hello World\n\nSome content here.');
    expect(result!.lineOffset).toBe(6);
  });

  it('parses front matter with arrays and objects', () => {
    const content = `---
tags:
  - typescript
  - react
author:
  name: Jane Doe
  email: jane@example.com
---
Body text.`;

    const result = parseFrontMatter(content);
    expect(result).not.toBeNull();
    expect(result!.metadata.tags).toEqual(['typescript', 'react']);
    expect(result!.metadata.author).toEqual({
      name: 'Jane Doe',
      email: 'jane@example.com',
    });
    expect(result!.body).toBe('Body text.');
  });

  it('returns null for content without front matter', () => {
    const content = '# Just a heading\n\nSome paragraph text.';
    expect(parseFrontMatter(content)).toBeNull();
  });

  it('returns null for malformed YAML between delimiters', () => {
    const content = `---
: invalid: yaml: [
  not closed
---
Body text.`;

    expect(parseFrontMatter(content)).toBeNull();
  });

  it('returns null for --- used as horizontal rule (no closing ---)', () => {
    const content = `---
This is just regular text after a horizontal rule.
No closing delimiter here.`;

    expect(parseFrontMatter(content)).toBeNull();
  });

  it('calculates lineOffset correctly', () => {
    const content = `---
a: 1
b: 2
c: 3
---
rest`;

    const result = parseFrontMatter(content);
    expect(result).not.toBeNull();
    expect(result!.lineOffset).toBe(5);
  });

  it('handles empty front matter block', () => {
    const content = `---
---
Body after empty front matter.`;

    const result = parseFrontMatter(content);
    expect(result).not.toBeNull();
    expect(result!.metadata).toEqual({});
    expect(result!.body).toBe('Body after empty front matter.');
    expect(result!.lineOffset).toBe(2);
  });

  it('handles front matter with only whitespace between delimiters', () => {
    const content = `---

---
Body text.`;

    const result = parseFrontMatter(content);
    expect(result).not.toBeNull();
    expect(result!.metadata).toEqual({});
    expect(result!.body).toBe('Body text.');
  });

  it('returns null for empty content', () => {
    expect(parseFrontMatter('')).toBeNull();
  });

  it('returns null when first line is not ---', () => {
    const content = `Some text
---
title: Hello
---`;

    expect(parseFrontMatter(content)).toBeNull();
  });
});

describe('buildFrontMatterDisplay', () => {
  it('converts nested metadata into a display tree', () => {
    const result = buildFrontMatterDisplay({
      title: 'Hello',
      tags: ['a', 1],
      author: { name: 'Jane', active: true, extra: null },
    });

    expect(result).toEqual({
      ok: true,
      entries: [
        ['title', { kind: 'scalar', text: 'Hello' }],
        [
          'tags',
          {
            kind: 'list',
            items: [
              { kind: 'scalar', text: 'a' },
              { kind: 'scalar', text: '1' },
            ],
          },
        ],
        [
          'author',
          {
            kind: 'map',
            entries: [
              ['name', { kind: 'scalar', text: 'Jane' }],
              ['active', { kind: 'scalar', text: 'true' }],
              ['extra', { kind: 'null' }],
            ],
          },
        ],
      ],
    });
  });

  it('rejects the 33-byte self-referencing YAML alias as a cycle', () => {
    const parsed = parseFrontMatter('---\nloop: &loop [*loop]\n---\nhello');
    expect(parsed).not.toBeNull();

    expect(buildFrontMatterDisplay(parsed!.metadata)).toEqual({ ok: false, reason: 'cycle' });
  });

  it('accepts a shared, non-cyclic alias rendered in two places', () => {
    const parsed = parseFrontMatter('---\nbase: &b {k: v}\ncopy: *b\n---\nbody');

    const result = buildFrontMatterDisplay(parsed!.metadata);
    expect(result.ok).toBe(true);
  });

  it('rejects nesting deeper than the depth budget', () => {
    let value: unknown = 'leaf';
    for (let i = 0; i < FRONT_MATTER_MAX_DEPTH + 1; i++) {
      value = [value];
    }

    expect(buildFrontMatterDisplay({ deep: value })).toEqual({ ok: false, reason: 'depth' });
  });

  it('accepts nesting exactly at the depth budget', () => {
    let value: unknown = 'leaf';
    for (let i = 0; i < FRONT_MATTER_MAX_DEPTH - 1; i++) {
      value = [value];
    }

    expect(buildFrontMatterDisplay({ deep: value }).ok).toBe(true);
  });

  it('rejects metadata with more values than the node budget', () => {
    const wide = Array.from({ length: FRONT_MATTER_MAX_NODES + 1 }, (_, i) => i);

    expect(buildFrontMatterDisplay({ wide })).toEqual({ ok: false, reason: 'nodes' });
  });
});
