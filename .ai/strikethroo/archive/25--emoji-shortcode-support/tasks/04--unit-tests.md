---
id: 4
group: "emoji-support"
dependencies: [2, 3]
status: "completed"
created: "2026-02-27"
skills:
  - jest
---
# Write unit tests for emoji data utility and remark plugin

## Objective
Write meaningful unit tests for the emoji data utility functions and the remark-emoji plugin to verify correct search, resolution, and markdown transformation behavior.

## Skills Required
- Vitest unit testing

## Acceptance Criteria
- [ ] Tests for `searchEmojis`: returns results for valid queries, returns empty for nonsense queries, respects max 8 limit
- [ ] Tests for `resolveShortcode`: resolves known emojis (e.g., `rocket` → 🚀), returns null for unknown shortcodes
- [ ] Tests for `remarkEmoji` plugin: transforms `:rocket:` in markdown text, skips invalid shortcodes, skips shortcodes inside code blocks
- [ ] All tests pass with `npm run test:unit`

## Technical Requirements
- Use Vitest (project's existing test framework)
- Test files colocated with source: `emoji-data.test.ts` and `remark-emoji.test.ts` in `src/renderer/utils/`
- For the remark plugin, test by processing markdown through remark and checking output

## Input Dependencies
- Task 1: `src/renderer/utils/emoji-data.ts`
- Task 3: `src/renderer/utils/remark-emoji.ts`

## Output Artifacts
- `src/renderer/utils/emoji-data.test.ts`
- `src/renderer/utils/remark-emoji.test.ts`

## Implementation Notes

<details>
<summary>Details</summary>

### emoji-data.test.ts

```typescript
import { describe, it, expect } from 'vitest';
import { searchEmojis, resolveShortcode } from './emoji-data';

describe('searchEmojis', () => {
  it('returns matching emojis for a valid prefix', () => {
    const results = searchEmojis('rock');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('native');
    expect(results[0]).toHaveProperty('id');
  });

  it('returns empty array for nonsense query', () => {
    expect(searchEmojis('xyzzynotanemoji')).toEqual([]);
  });

  it('returns at most 8 results', () => {
    const results = searchEmojis('sm'); // many emojis start with sm
    expect(results.length).toBeLessThanOrEqual(8);
  });
});

describe('resolveShortcode', () => {
  it('resolves known shortcode to Unicode emoji', () => {
    expect(resolveShortcode('rocket')).toBe('🚀');
  });

  it('returns null for unknown shortcode', () => {
    expect(resolveShortcode('not_a_real_emoji_xyz')).toBeNull();
  });
});
```

### remark-emoji.test.ts

```typescript
import { describe, it, expect } from 'vitest';
import { remark } from 'remark';
import { remarkEmoji } from './remark-emoji';

// Note: may need to install `remark` as a dev dependency if not already available
// Or use the unified + remarkParse approach

describe('remarkEmoji', () => {
  it('replaces valid shortcodes with Unicode emojis', async () => {
    const result = await remark().use(remarkEmoji).process('Hello :rocket: world');
    expect(String(result)).toContain('🚀');
    expect(String(result)).not.toContain(':rocket:');
  });

  it('leaves invalid shortcodes as-is', async () => {
    const result = await remark().use(remarkEmoji).process('Hello :notanemoji: world');
    expect(String(result)).toContain(':notanemoji:');
  });

  it('does not replace shortcodes in inline code', async () => {
    const result = await remark().use(remarkEmoji).process('Hello `code :rocket: here` world');
    expect(String(result)).toContain(':rocket:');
  });
});
```

Check if `remark` (the processor) is available as a dependency. If not, use `unified` + `remarkParse` + `remarkStringify` which should be available transitively. Alternatively, test the plugin's transformer function directly by constructing MDAST nodes.

</details>
