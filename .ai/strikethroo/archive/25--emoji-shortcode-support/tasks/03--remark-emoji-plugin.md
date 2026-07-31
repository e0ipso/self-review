---
id: 3
group: "emoji-support"
dependencies: [1]
status: "completed"
created: "2026-02-27"
skills:
  - typescript
---
# Create remark-emoji plugin and integrate into all markdown renderers

## Objective
Build a custom remark plugin that transforms `:shortcode:` text into Unicode emoji characters in the markdown AST, and integrate it into CommentDisplay and RenderedMarkdownView.

## Skills Required
- TypeScript, remark/unified plugin authoring

## Acceptance Criteria
- [ ] A remark plugin at `src/renderer/utils/remark-emoji.ts` transforms `:shortcode:` patterns to Unicode emojis
- [ ] Only valid shortcodes are replaced (invalid ones left as-is)
- [ ] Shortcodes inside inline code or code blocks are NOT replaced
- [ ] Plugin is added to `remarkPlugins` in `CommentDisplay.tsx`
- [ ] Plugin is added to `remarkPlugins` in `RenderedMarkdownView.tsx`
- [ ] Emojis render correctly in both light and dark themes

## Technical Requirements
- Use `resolveShortcode` from `src/renderer/utils/emoji-data.ts` (task 1)
- The plugin must follow the unified/remark plugin API (return a transformer function)
- Must walk text nodes in the MDAST tree, skipping code/inlineCode nodes
- Pattern to match: `/:([a-z0-9_+-]+):/g`

## Input Dependencies
- Task 1: `src/renderer/utils/emoji-data.ts` with `resolveShortcode` function

## Output Artifacts
- `src/renderer/utils/remark-emoji.ts` — remark plugin
- Modified `src/renderer/components/Comments/CommentDisplay.tsx` — add plugin
- Modified `src/renderer/components/DiffViewer/RenderedMarkdownView.tsx` — add plugin

## Implementation Notes

<details>
<summary>Details</summary>

### remark-emoji plugin (`src/renderer/utils/remark-emoji.ts`)

1. Import `visit` from `unist-util-visit` (already in the project dependencies via remark)
2. Import `resolveShortcode` from `./emoji-data`
3. Export a function `remarkEmoji` that returns a transformer:

```typescript
import { visit } from 'unist-util-visit';
import type { Root, Text } from 'mdast';
import { resolveShortcode } from './emoji-data';

export function remarkEmoji() {
  return (tree: Root) => {
    visit(tree, 'text', (node: Text, index, parent) => {
      // Skip if parent is code or inlineCode
      if (parent && (parent.type === 'code' || parent.type === 'inlineCode')) return;

      const regex = /:([a-z0-9_+-]+):/g;
      let match;
      let lastIndex = 0;
      const newNodes: any[] = [];

      while ((match = regex.exec(node.value)) !== null) {
        const emoji = resolveShortcode(match[1]);
        if (emoji) {
          // Add text before the match
          if (match.index > lastIndex) {
            newNodes.push({ type: 'text', value: node.value.slice(lastIndex, match.index) });
          }
          // Add the emoji
          newNodes.push({ type: 'text', value: emoji });
          lastIndex = regex.lastIndex;
        }
      }

      if (newNodes.length > 0) {
        // Add remaining text
        if (lastIndex < node.value.length) {
          newNodes.push({ type: 'text', value: node.value.slice(lastIndex) });
        }
        // Replace the node with the new nodes
        if (parent && typeof index === 'number') {
          parent.children.splice(index, 1, ...newNodes);
        }
      }
    });
  };
}
```

4. Note: `unist-util-visit` should already be available as a transitive dependency of remark. If not, install it.

### CommentDisplay.tsx integration

Find the `<ReactMarkdown>` usage (around line 229-231) and add the plugin:

```tsx
import { remarkEmoji } from '../../utils/remark-emoji';

// In the JSX:
<ReactMarkdown remarkPlugins={[remarkGfm, remarkEmoji]}>
  {comment.body}
</ReactMarkdown>
```

### RenderedMarkdownView.tsx integration

Find the `<ReactMarkdown>` usage and add the plugin similarly:

```tsx
import { remarkEmoji } from '../../utils/remark-emoji';

// Add to existing remarkPlugins array
remarkPlugins={[remarkGfm, remarkEmoji]}
```

</details>
