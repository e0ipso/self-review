---
id: 3
group: "rendered-markdown-view"
dependencies: [2]
status: "completed"
created: "2026-02-18"
skills: ["react-components", "typescript"]
---

# Add Gutter and Comment Interaction to RenderedMarkdownView

## Objective

Add a gutter column to `RenderedMarkdownView` that displays collapsed source line ranges (e.g., "5-8") for each rendered block. Support click and drag-select on gutter cells to open `CommentInput` with the correct `LineRange`. Display existing comments below their corresponding rendered blocks.

## Skills Required

React component development, DOM event handling (mousedown/mousemove/mouseup for drag selection), familiarity with the existing comment system (`LineRange`, `CommentInput`, `CommentDisplay`).

## Acceptance Criteria

- [ ] Each rendered block has a gutter cell to its left showing the collapsed line range (e.g., "5-8" for multi-line, "5" for single-line)
- [ ] Hovering over a gutter cell reveals a comment icon (MessageSquarePlus)
- [ ] Clicking a gutter cell opens `CommentInput` with `LineRange { side: 'new', start, end }` matching the block's source lines
- [ ] Drag-selecting across multiple gutter cells unions their line ranges into a single `LineRange`
- [ ] `CommentInput` is the same component used in `UnifiedView` — no duplication
- [ ] Existing comments for lines within a block's range are displayed below that block
- [ ] Comment placement in rendered view produces correct `LineRange` values that also display correctly in raw (unified) view

## Technical Requirements

- The gutter sits to the left of the rendered content, similar to the existing diff gutter in `UnifiedView.tsx`.
- Use the `data-source-start-line` and `data-source-end-line` attributes set on blocks (from task 2) to identify line ranges.
- Drag interaction: `mouseDown` on a gutter cell starts selection, `mouseMove` extends it across blocks, `mouseUp` finalizes the range and opens `CommentInput`.
- Use `useReview()` context to access `getCommentsForFile` and render `CommentDisplay` for existing comments.
- All lines are `side: 'new'` since this only applies to new (added) files.

## Input Dependencies

Task 2: `RenderedMarkdownView` component with `data-source-start-line` / `data-source-end-line` annotated blocks.

## Output Artifacts

- Updated `RenderedMarkdownView.tsx` with gutter column and comment interaction
- The component is fully functional for commenting — ready for integration into `FileSection`

## Implementation Notes

<details>

### Layout structure

Use a two-column layout for the rendered view: gutter (narrow, fixed width) + content area.

```tsx
<div className="flex">
  <div className="gutter-column w-16 flex-shrink-0">
    {/* Gutter cells */}
  </div>
  <div className="content-column flex-1 prose dark:prose-invert max-w-none">
    {/* react-markdown output */}
  </div>
</div>
```

### Approach: Wrapper-based gutter

Instead of trying to align a separate gutter with the rendered content (which is hard due to variable block heights), wrap each block in a row container that includes both the gutter cell and the content:

```tsx
function createBlockRenderer(Tag: string) {
  return function BlockRenderer({ node, children, ...props }) {
    const startLine = node?.position?.start?.line;
    const endLine = node?.position?.end?.line;
    const rangeLabel = startLine === endLine ? `${startLine}` : `${startLine}-${endLine}`;

    return (
      <div className="flex group" data-source-start-line={startLine} data-source-end-line={endLine}>
        <div
          className="gutter-cell w-16 flex-shrink-0 text-xs text-muted-foreground select-none cursor-pointer flex items-start justify-end pr-2 pt-1"
          onMouseDown={handleMouseDown}
        >
          <span className="opacity-0 group-hover:opacity-100">{/* comment icon */}</span>
          <span>{rangeLabel}</span>
        </div>
        <Tag {...props} className="flex-1">
          {children}
        </Tag>
      </div>
    );
  };
}
```

**Important caveat**: This wrapper approach means the block-level element is nested inside a flex container. This may affect `prose` styling since Typography expects direct children. Test this carefully and adjust. An alternative is to use CSS grid or absolute positioning for the gutter.

### Drag selection

Study how `UnifiedView.tsx` implements drag selection (search for `onMouseDown`, `dragState`, `handleDragStart`). Replicate the same pattern:

1. `mouseDown` on gutter cell → record start block's line range
2. Track mouse position, find which block the cursor is over (using `document.elementFromPoint` + `closest('[data-source-start-line]')`)
3. `mouseUp` → compute union of start and end block line ranges → set `commentRange` state
4. Render `CommentInput` below the last block in the selected range

### Displaying existing comments

For each rendered block, check if there are comments whose `lineRange` overlaps with the block's source lines. Use `getCommentsForFile(filePath)` from `useReview()` and filter by line overlap. Render `CommentDisplay` below the block for matching comments.

### Coordinate with existing patterns

Read `UnifiedView.tsx` carefully before implementing — particularly:
- How `commentRange` state is managed
- How `CommentInput` is rendered inline
- How `CommentDisplay` is positioned relative to diff lines
- The `onDragStart` / drag handling pattern

The rendered view should feel consistent with the existing diff commenting UX even though the visual presentation is different.

</details>
