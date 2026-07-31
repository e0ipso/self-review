---
id: 1
group: "rendered-markdown-fixes"
dependencies: []
status: "completed"
created: "2026-02-27"
skills:
  - react-components
---
# Add `<details>` Component Mapping to RenderedMarkdownView

## Objective
Ensure `<details>` elements in the rendered markdown view go through `BlockWrapper` so they receive the gutter and left padding consistent with all other block-level elements.

## Skills Required
- react-components: Understanding of `react-markdown` component overrides and `BlockWrapper` pattern

## Acceptance Criteria
- [ ] `<details>` elements render with the same left padding/gutter alignment as other block elements (paragraphs, tables, headings)
- [ ] `<summary>` elements inside `<details>` do not duplicate the gutter (handled by `GutterNestingContext`)
- [ ] No visual regressions in other block elements

## Technical Requirements
- Add `details: createBlockRenderer('details')` to the `components` object in `RenderedMarkdownView.tsx`
- No new dependencies needed — `rehype-raw` already parses `<details>` from markdown

## Input Dependencies
None — this task is independent.

## Output Artifacts
- Modified `src/renderer/components/DiffViewer/RenderedMarkdownView.tsx` with `details` added to the components mapping

## Implementation Notes

<details>
<summary>Detailed implementation steps</summary>

**File to modify**: `src/renderer/components/DiffViewer/RenderedMarkdownView.tsx`

**Change**: In the `components` object defined in the `useMemo` block (around line 242-258), add a new entry for `details`:

```typescript
const components: Components = useMemo(() => ({
    p: createBlockRenderer('p'),
    h1: createBlockRenderer('h1'),
    // ... existing entries ...
    hr: createBlockRenderer('hr'),
    details: createBlockRenderer('details'),  // ADD THIS LINE
    code: CodeRenderer,
}), [createBlockRenderer, CodeRenderer]);
```

**Why only `details` and not `summary`?** The `<summary>` element is a child of `<details>`. The `BlockWrapper` uses a `GutterNestingContext` that prevents nested block elements from duplicating the gutter. Since `<summary>` will always be inside `<details>`, it will automatically be treated as nested content — no separate mapping needed.

**Regarding AST position data**: Raw HTML elements processed by `rehype-raw` may not carry `node.position` data. `BlockWrapper` already handles this gracefully — it renders the element without gutter line numbers when `startLine`/`endLine` are undefined, but still applies the correct left padding via CSS classes.

**Testing**: Manually verify by opening a markdown file containing `<details><summary>Title</summary>Content</details>` in the rendered view. The element should align with other blocks rather than appearing flush-left.

</details>
