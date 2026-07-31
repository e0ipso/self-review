---
id: 1
group: 'foundation'
dependencies: []
status: 'completed'
created: '2026-02-16'
skills:
  - react-components
---

# Add Data Attributes for Keyboard Hint Targeting

## Objective

Add `data-line-type`, `data-scroll-container`, and `data-file-path` attributes to existing DOM elements so the keyboard hint system can target them via DOM queries.

## Skills Required

React components — modifying existing JSX to add data attributes.

## Acceptance Criteria

- [ ] `UnifiedView.tsx` line divs have `data-line-type="addition"`, `"deletion"`, or `"context"` based on line type
- [ ] `SplitView.tsx` line divs have the same `data-line-type` attribute
- [ ] `Layout.tsx` diff pane scroll container has `data-scroll-container="diff"` attribute
- [ ] `FileTree.tsx` file entry buttons have `data-file-path={filePath}` attribute
- [ ] No existing behavior is broken (mouse interactions, styling, scrolling)

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Use the existing `DiffLine` type's `type` field (`'added'`, `'removed'`, `'context'`) to derive `data-line-type` values (`addition`, `deletion`, `context`)
- The scroll container is the `div.overflow-y-auto` wrapping `DiffViewer` in `Layout.tsx` (currently line 23)
- FileTree buttons already have `data-testid` — add `data-file-path` alongside it

## Input Dependencies

None — this is a foundation task.

## Output Artifacts

DOM elements with queryable `data-*` attributes used by tasks 4 and 5 (keyboard navigation hook and integration).

## Implementation Notes

<details>

### UnifiedView.tsx

In `src/renderer/components/DiffViewer/UnifiedView.tsx`, find the line wrapper div that has `data-line-number` and `data-line-side` attributes (around lines 111-116). Add a `data-line-type` attribute derived from the `DiffLine.type` field:

```tsx
// Map DiffLine.type to data-line-type value
const lineTypeMap = { added: 'addition', removed: 'deletion', context: 'context' };
// Add to the existing div:
data-line-type={lineTypeMap[line.type] || 'context'}
```

### SplitView.tsx

In `src/renderer/components/DiffViewer/SplitView.tsx`, apply the same `data-line-type` attribute to line divs (around lines 115-117). SplitView renders two halves per row — add the attribute to each half's container div based on the corresponding line's type.

### Layout.tsx

In `src/renderer/components/Layout.tsx`, find the `div` with `className='h-full overflow-y-auto bg-background'` (line 23) and add `data-scroll-container="diff"`.

### FileTree.tsx

In `src/renderer/components/FileTree.tsx`, find the file entry `<button>` element (around line 155-156) that already has `data-testid={file-entry-${filePath}}` and add `data-file-path={filePath}`.

</details>
